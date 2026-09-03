//* src/modules/carrito/carrito.service.spec.ts

import { BadRequestException } from '@nestjs/common';
import { EstadoProducto } from '@prisma/client';
import { CarritoService } from './carrito.service';
import { CONFIG_CLAVES } from '../configuracion/configuracion.constants';

// @nestjs/schedule se distribuye como ESM y rompe la cadena de imports.
jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: {},
}));

// ===================================================================================
const AJUSTES: Record<string, string> = {
  [CONFIG_CLAVES.TIENDA_MONEDA]: 'PEN',
  [CONFIG_CLAVES.TIENDA_MONEDA_SIMBOLO]: 'S/',
  [CONFIG_CLAVES.TIENDA_URL]: 'https://ozzy.pe',
  [CONFIG_CLAVES.WHATSAPP_NUMERO]: '51987654321',
  [CONFIG_CLAVES.WHATSAPP_CARRITO_PLANTILLA]:
    'Hola! Quiero pedir:\n\n{{items}}\nTotal: {{total}}\n\n{{url}}',
  [CONFIG_CLAVES.WHATSAPP_CARRITO_LINEA]:
    '{{n}}) *{{producto}}*\n   Talla {{talla}} / {{color}}\n   {{cantidad}} x {{precio}} = {{subtotal}}\n',
};

const config = {
  getVarias: (claves: string[]) =>
    Promise.resolve(
      Object.fromEntries(claves.map((c) => [c, AJUSTES[c] ?? ''])),
    ),
} as never;

// ===================================================================================
interface OpcionesItem {
  varianteId?: number;
  cantidad?: number;
  precioBase?: string;
  precioVariante?: string | null;
  stock?: number | null;
  activo?: boolean;
  tallaActiva?: boolean;
  estado?: EstadoProducto;
  deletedAt?: Date | null;
  nombre?: string;
  talla?: string;
  color?: string;
}

function item(o: OpcionesItem = {}) {
  const varianteId = o.varianteId ?? 10;

  return {
    id: varianteId * 100,
    variante_id: varianteId,
    cantidad: o.cantidad ?? 1,
    createdAt: new Date('2026-01-01'),
    variante: {
      id: varianteId,
      precio: o.precioVariante ?? null,
      stock: o.stock === undefined ? 5 : o.stock,
      activo: o.activo ?? true,
      sku: null,
      talla: {
        id: 1,
        etiqueta: o.talla ?? 'M',
        activo: o.tallaActiva ?? true,
      },
      color: { id: 2, nombre: o.color ?? 'Negro', hex: '#000', activo: true },
      producto: {
        id: 7,
        nombre: o.nombre ?? 'Polo Oversize',
        slug: 'polo-oversize',
        estado: o.estado ?? EstadoProducto.ACTIVO,
        deletedAt: o.deletedAt ?? null,
        precioBase: o.precioBase ?? '59.00',
        precio: null,
        imagenes: [{ url: 'a.webp', urlSm: 'a-sm.webp', alt: null }],
      },
    },
  };
}

function carrito(items: ReturnType<typeof item>[]) {
  return { id: 1, cliente_id: null, dispositivo: 'abc12345', items };
}

// Sólo se stubean los métodos que el servicio usa en cada prueba.
function servicioCon(datos: ReturnType<typeof carrito> | null) {
  const prisma = {
    carrito: {
      findFirst: () => Promise.resolve(datos),
      create: () => Promise.resolve(carrito([])),
      update: () => Promise.resolve(datos),
    },
  } as never;

  return new CarritoService(prisma, config);
}

const DISPOSITIVO = { dispositivo: 'abc12345' };

// ===================================================================================
describe('CarritoService — identidad', () => {
  it('exige sesión o un id de dispositivo válido', async () => {
    const servicio = servicioCon(null);

    await expect(servicio.ver({})).rejects.toThrow(BadRequestException);
    await expect(servicio.ver({ dispositivo: 'corto' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('permite carrito sin sesión con id de dispositivo', async () => {
    const servicio = servicioCon(null);
    const r = await servicio.ver(DISPOSITIVO);

    expect(r.data.items).toEqual([]);
    expect(r.data.total).toBe(0);
  });

  it('el cliente autenticado manda sobre el dispositivo', async () => {
    const servicio = servicioCon(null);

    // Un dispositivo inválido no estorba si hay sesión.
    await expect(
      servicio.ver({ clienteId: 3, dispositivo: 'x' }),
    ).resolves.toBeDefined();
  });
});

// ===================================================================================
describe('CarritoService — total', () => {
  it('multiplica precio por cantidad y suma', async () => {
    const servicio = servicioCon(
      carrito([
        item({ varianteId: 10, cantidad: 2, precioBase: '59.00' }),
        item({ varianteId: 11, cantidad: 1, precioBase: '129.00' }),
      ]),
    );

    const r = await servicio.ver(DISPOSITIVO);

    expect(r.data.items[0].subtotal).toBe(118);
    expect(r.data.items[1].subtotal).toBe(129);
    expect(r.data.total).toBe(247);
    expect(r.data.cantidad).toBe(3);
  });

  it('usa el precio de la variante cuando lo tiene', async () => {
    const servicio = servicioCon(
      carrito([
        item({ cantidad: 2, precioBase: '59.00', precioVariante: '39.00' }),
      ]),
    );

    const r = await servicio.ver(DISPOSITIVO);

    expect(r.data.items[0].precio.precio).toBe(39);
    expect(r.data.total).toBe(78);
  });

  it('excluye del total las líneas no disponibles', async () => {
    const servicio = servicioCon(
      carrito([
        item({ varianteId: 10, cantidad: 1, precioBase: '50.00' }),
        // Producto oculto tras añadirlo al carrito.
        item({
          varianteId: 11,
          cantidad: 1,
          precioBase: '80.00',
          estado: EstadoProducto.OCULTO,
        }),
      ]),
    );

    const r = await servicio.ver(DISPOSITIVO);

    expect(r.data.items).toHaveLength(2);
    expect(r.data.items[1].disponible).toBe(false);
    // 80 no entra: el vendedor no lo va a cobrar.
    expect(r.data.total).toBe(50);
    expect(r.data.cantidad).toBe(1);
  });

  it('marca agotado sin quitar la línea', async () => {
    const servicio = servicioCon(carrito([item({ stock: 0 })]));

    const r = await servicio.ver(DISPOSITIVO);

    expect(r.data.items[0].agotado).toBe(true);
    expect(r.data.items[0].disponible).toBe(true);
  });

  it('stock null es sin control de stock, no agotado', async () => {
    const servicio = servicioCon(carrito([item({ stock: null })]));

    const r = await servicio.ver(DISPOSITIVO);

    expect(r.data.items[0].agotado).toBe(false);
  });

  it('una variante desactivada deja de ser pedible', async () => {
    const servicio = servicioCon(carrito([item({ activo: false })]));

    const r = await servicio.ver(DISPOSITIVO);

    expect(r.data.items[0].disponible).toBe(false);
    expect(r.data.total).toBe(0);
  });
});

// ===================================================================================
describe('CarritoService — mensaje de WhatsApp', () => {
  it('arma las líneas con talla, color, cantidad y total', async () => {
    const servicio = servicioCon(
      carrito([
        item({
          varianteId: 10,
          cantidad: 2,
          precioBase: '59.00',
          nombre: 'Polo Oversize Negro',
          talla: 'M',
          color: 'Negro',
        }),
        item({
          varianteId: 11,
          cantidad: 1,
          precioBase: '129.00',
          nombre: 'Casaca Denim',
          talla: 'L',
          color: 'Azul',
        }),
      ]),
    );

    const r = await servicio.generarEnlace(DISPOSITIVO);

    expect(r.data.mensaje).toContain('1) *Polo Oversize Negro*');
    expect(r.data.mensaje).toContain('Talla M / Negro');
    expect(r.data.mensaje).toContain('2 x S/ 59.00 = S/ 118.00');
    expect(r.data.mensaje).toContain('2) *Casaca Denim*');
    expect(r.data.mensaje).toContain('Total: S/ 247.00');

    expect(r.data.total).toBe(247);
    expect(r.data.numero).toBe('51987654321');
  });

  it('devuelve una url de wa.me con el mensaje codificado', async () => {
    const servicio = servicioCon(carrito([item({ cantidad: 1 })]));

    const r = await servicio.generarEnlace(DISPOSITIVO);

    expect(r.data.url).toMatch(/^https:\/\/wa\.me\/51987654321\?text=/);
    expect(decodeURIComponent(r.data.url.split('?text=')[1])).toBe(
      r.data.mensaje,
    );
  });

  it('omite del mensaje lo no disponible y lo reporta aparte', async () => {
    const servicio = servicioCon(
      carrito([
        item({ varianteId: 10, cantidad: 1, nombre: 'Disponible' }),
        item({
          varianteId: 11,
          cantidad: 1,
          nombre: 'Retirado',
          deletedAt: new Date(),
        }),
      ]),
    );

    const r = await servicio.generarEnlace(DISPOSITIVO);

    expect(r.data.mensaje).toContain('Disponible');
    expect(r.data.mensaje).not.toContain('Retirado');
    expect(r.data.omitidos).toEqual([
      { variante_id: 11, producto: 'Retirado' },
    ]);
  });

  it('falla si no queda nada pedible', async () => {
    const servicio = servicioCon(
      carrito([item({ estado: EstadoProducto.OCULTO })]),
    );

    await expect(servicio.generarEnlace(DISPOSITIVO)).rejects.toThrow(
      /vacío o sus productos ya no están disponibles/,
    );
  });

  it('falla con carrito vacío', async () => {
    const servicio = servicioCon(null);

    await expect(servicio.generarEnlace(DISPOSITIVO)).rejects.toThrow(
      BadRequestException,
    );
  });
});
