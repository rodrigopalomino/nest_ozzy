//* src/modules/cliente/favorito.service.ts

import { BadRequestException, Injectable } from '@nestjs/common';
import { EstadoProducto } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CoreResponse } from 'src/common/utils/response.util';
import {
  CATALOGO_INCLUDE_TARJETA,
  mapProductoTarjeta,
} from '../producto/utils/catalogo.mapper';

// ===================================================================================
// Lista de deseos.
//
// Funciona sin cuenta: el front genera un id de dispositivo y lo envía. Al
// entrar con Google, los favoritos de ese dispositivo se adoptan.
// ===================================================================================

// El identificador de dispositivo lo genera el navegador (crypto.randomUUID).
const DISPOSITIVO_REGEX = /^[a-zA-Z0-9-]{8,64}$/;

interface Identidad {
  clienteId?: number | null;
  dispositivo?: string | null;
}

@Injectable()
export class FavoritoService {
  constructor(private readonly prisma: PrismaService) {}

  // ===================================================================================
  private resolver(identidad: Identidad) {
    const { clienteId, dispositivo } = identidad;

    if (clienteId) return { cliente_id: clienteId, dispositivo: null };

    if (!dispositivo || !DISPOSITIVO_REGEX.test(dispositivo)) {
      throw new BadRequestException(
        'Se requiere iniciar sesión o enviar un identificador de dispositivo válido.',
      );
    }

    return { cliente_id: null, dispositivo };
  }

  // ===================================================================================
  async agregar(productoId: number, identidad: Identidad) {
    const producto = await this.prisma.producto.findFirst({
      where: {
        id: productoId,
        estado: EstadoProducto.ACTIVO,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!producto) throw new BadRequestException('Producto no disponible');

    const clave = this.resolver(identidad);

    // upsert manual: la unicidad depende de cuál de los dos campos se usa.
    const existente = await this.prisma.favorito.findFirst({
      where: { producto_id: productoId, ...clave },
      select: { id: true },
    });

    if (existente) {
      return CoreResponse.success('Ya estaba en favoritos', {
        id: existente.id,
      });
    }

    const favorito = await this.prisma.favorito.create({
      data: { producto_id: productoId, ...clave },
      select: { id: true, createdAt: true },
    });

    return CoreResponse.created('Agregado a favoritos', favorito);
  }

  // ===================================================================================
  async quitar(productoId: number, identidad: Identidad) {
    const clave = this.resolver(identidad);

    const { count } = await this.prisma.favorito.deleteMany({
      where: { producto_id: productoId, ...clave },
    });

    if (count === 0) {
      return CoreResponse.success('No estaba en favoritos', { quitados: 0 });
    }

    return CoreResponse.deleted('Quitado de favoritos');
  }

  // ===================================================================================
  async listar(identidad: Identidad) {
    const clave = this.resolver(identidad);

    const favoritos = await this.prisma.favorito.findMany({
      where: {
        ...clave,
        producto: { estado: EstadoProducto.ACTIVO, deletedAt: null },
      },
      orderBy: { createdAt: 'desc' },
      // La lista de favoritos es una grilla de tarjetas: include ligero.
      include: { producto: { include: CATALOGO_INCLUDE_TARJETA } },
    });

    const ahora = new Date();

    return CoreResponse.success('Favoritos obtenidos correctamente', {
      total: favoritos.length,
      productos: favoritos.map((f) => mapProductoTarjeta(f.producto, ahora)),
    });
  }

  // ===================================================================================
  // Al iniciar sesión, los favoritos guardados en el dispositivo pasan a la
  // cuenta. Los que ya estaban en la cuenta se descartan del dispositivo
  // para no violar la unicidad.
  async adoptarDeDispositivo(clienteId: number, dispositivo: string) {
    if (!DISPOSITIVO_REGEX.test(dispositivo)) {
      throw new BadRequestException('Identificador de dispositivo inválido');
    }

    const [delDispositivo, delCliente] = await Promise.all([
      this.prisma.favorito.findMany({
        where: { dispositivo },
        select: { id: true, producto_id: true },
      }),
      this.prisma.favorito.findMany({
        where: { cliente_id: clienteId },
        select: { producto_id: true },
      }),
    ]);

    const yaTiene = new Set(delCliente.map((f) => f.producto_id));

    const aMover = delDispositivo.filter((f) => !yaTiene.has(f.producto_id));
    const aBorrar = delDispositivo.filter((f) => yaTiene.has(f.producto_id));

    await this.prisma.$transaction([
      ...aMover.map((f) =>
        this.prisma.favorito.update({
          where: { id: f.id },
          data: { cliente_id: clienteId, dispositivo: null },
        }),
      ),
      ...(aBorrar.length > 0
        ? [
            this.prisma.favorito.deleteMany({
              where: { id: { in: aBorrar.map((f) => f.id) } },
            }),
          ]
        : []),
    ]);

    return CoreResponse.success('Favoritos sincronizados', {
      adoptados: aMover.length,
      duplicadosDescartados: aBorrar.length,
    });
  }
}
