import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';

// @nestjs/schedule se distribuye como ESM y jest no lo transforma. La
// prueba no ejerce ningún cron, así que basta con neutralizar sus
// decoradores para poder importar la cadena de servicios.
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: {},
}));

import { SuscripcionStockService } from './suscripcion-stock.service';

// ===================================================================================
// Estas pruebas fijan la propiedad de seguridad del aviso de reposición:
// el token de baja nunca sale en una respuesta HTTP y en la base sólo se
// guarda su hash. El endpoint de suscripción es público, así que devolver
// el token permitiría suscribir el correo de otra persona y obtener con
// qué cancelar su aviso.
// ===================================================================================

const VARIANTE_AGOTADA = {
  id: 10,
  producto_id: 1,
  stock: 0,
};

interface UpsertArgs {
  create: { tokenBajaHash: string; email: string };
}

interface FindUniqueArgs {
  where: { tokenBajaHash: string };
}

function crearServicio(overrides: Record<string, unknown> = {}) {
  const guardado: { tokenBajaHash?: string } = {};

  const prisma = {
    varianteProducto: {
      findFirst: jest.fn().mockResolvedValue(VARIANTE_AGOTADA),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    suscripcionStock: {
      upsert: jest.fn<Promise<unknown>, [UpsertArgs]>((args) => {
        guardado.tokenBajaHash = args.create.tokenBajaHash;
        return Promise.resolve({
          id: 1,
          email: 'ana@example.com',
          createdAt: new Date('2026-09-02'),
        });
      }),
      findUnique: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    ...overrides,
  };

  const notificacion = {
    enviarStockDisponible: jest.fn().mockResolvedValue({}),
  };

  const servicio = new SuscripcionStockService(
    prisma as never,
    notificacion as never,
  );

  return { servicio, prisma, notificacion, guardado };
}

describe('SuscripcionStockService.suscribir', () => {
  it('no devuelve el token de baja en la respuesta', async () => {
    const { servicio } = crearServicio();

    const r = await servicio.suscribir({
      varianteId: 10,
      email: 'ana@example.com',
    });

    // El endpoint es público: el token en la respuesta sería explotable.
    expect(JSON.stringify(r)).not.toMatch(/token/i);
    expect(r.data).toEqual({
      id: 1,
      email: 'ana@example.com',
      createdAt: new Date('2026-09-02'),
    });
  });

  it('guarda el token hasheado, nunca en claro', async () => {
    const { servicio, guardado } = crearServicio();

    await servicio.suscribir({ varianteId: 10, email: 'ana@example.com' });

    // Un SHA-256 en hexadecimal: 64 caracteres.
    expect(guardado.tokenBajaHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('genera un token distinto en cada suscripción', async () => {
    const a = crearServicio();
    await a.servicio.suscribir({ varianteId: 10, email: 'ana@example.com' });

    const b = crearServicio();
    await b.servicio.suscribir({ varianteId: 10, email: 'ana@example.com' });

    // Un token derivado del correo sería igual siempre y no se podría
    // rotar ni invalidar.
    expect(a.guardado.tokenBajaHash).not.toBe(b.guardado.tokenBajaHash);
  });

  it('normaliza el correo a minúsculas', async () => {
    const { servicio, prisma } = crearServicio();

    await servicio.suscribir({ varianteId: 10, email: '  Ana@Example.COM ' });

    const [args] = prisma.suscripcionStock.upsert.mock.calls[0];

    expect(args.create.email).toBe('ana@example.com');
  });

  it('rechaza suscribirse a una variante que ya tiene stock', async () => {
    const { servicio } = crearServicio({
      varianteProducto: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ ...VARIANTE_AGOTADA, stock: 5 }),
        findUnique: jest.fn(),
      },
    });

    await expect(
      servicio.suscribir({ varianteId: 10, email: 'ana@example.com' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza una variante inexistente o no publicada', async () => {
    const { servicio } = crearServicio({
      varianteProducto: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
      },
    });

    await expect(
      servicio.suscribir({ varianteId: 999, email: 'ana@example.com' }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('SuscripcionStockService.cancelar', () => {
  it('rechaza un token vacío o demasiado corto sin consultar la base', async () => {
    const { servicio, prisma } = crearServicio();

    await expect(servicio.cancelar('')).rejects.toThrow(BadRequestException);
    await expect(servicio.cancelar('corto')).rejects.toThrow(
      BadRequestException,
    );

    expect(prisma.suscripcionStock.findUnique).not.toHaveBeenCalled();
  });

  it('rechaza un token que no corresponde a ninguna suscripción', async () => {
    const { servicio } = crearServicio();

    await expect(servicio.cancelar('a'.repeat(43))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('busca por el hash del token, no por el token en claro', async () => {
    const token = 'b'.repeat(43);
    const findUnique = jest.fn<Promise<unknown>, [FindUniqueArgs]>(() =>
      Promise.resolve({ id: 7, email: 'ana@example.com' }),
    );

    const { servicio } = crearServicio({
      suscripcionStock: {
        findUnique,
        delete: jest.fn().mockResolvedValue({}),
        upsert: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    });

    await servicio.cancelar(token);

    const [args] = findUnique.mock.calls[0];

    expect(args.where.tokenBajaHash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
    expect(args.where.tokenBajaHash).not.toContain(token);
  });

  it('elimina la suscripción cuando el token es válido', async () => {
    const { servicio, prisma } = crearServicio({
      suscripcionStock: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 7, email: 'ana@example.com' }),
        delete: jest.fn().mockResolvedValue({}),
        upsert: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    });

    const r = await servicio.cancelar('c'.repeat(43));

    expect(prisma.suscripcionStock.delete).toHaveBeenCalledWith({
      where: { id: 7 },
    });
    expect(r.status).toBe('deleted');
  });
});
