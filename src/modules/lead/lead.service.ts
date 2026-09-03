//* src/modules/lead/lead.service.ts

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { EstadoLead, EstadoProducto, OrigenLead, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryOptionsSchemaType } from 'src/common/schema/query-options.schema';
import {
  buildFilters,
  buildPagination,
  resolveLimit,
} from 'src/common/utils/prisma-query-builder';
import { CoreResponse } from 'src/common/utils/response.util';
import { handlePrismaFilterError } from 'src/common/utils/prisma-filter.util';

// ===================================================================================
// Leads de WhatsApp: es la única métrica de conversión del catálogo.
//
// La creación es pública (la dispara el visitante al pulsar "Comprar por
// WhatsApp"); la lectura es sólo para el admin, porque expone teléfonos.
// ===================================================================================

const FILTROS_ADMIN = [
  'id',
  'producto_id',
  'variante_id',
  'origen',
  'estado',
  'telefono',
  'createdAt',
];

// Ventana de deduplicación de leads del mismo visitante.
const VENTANA_DEDUPE_MS = 5 * 60 * 1000;

@Injectable()
export class LeadService {
  constructor(private readonly prisma: PrismaService) {}

  // ===================================================================================
  async registrar(dto: {
    producto_id: number;
    variante_id?: number | null;
    telefono?: string | null;
    mensaje: string;
    origen: OrigenLead;
    ip?: string | null;
  }) {
    // Sólo se aceptan leads de productos que el visitante podía ver.
    const producto = await this.prisma.producto.findFirst({
      where: {
        id: dto.producto_id,
        estado: EstadoProducto.ACTIVO,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!producto) throw new NotFoundException('Producto no encontrado');

    // La variante, si viene, debe pertenecer a ese producto.
    if (dto.variante_id != null) {
      const variante = await this.prisma.varianteProducto.findFirst({
        where: { id: dto.variante_id, producto_id: dto.producto_id },
        select: { id: true },
      });

      if (!variante) {
        throw new BadRequestException(
          'La variante no pertenece a este producto',
        );
      }
    }

    // Deduplicación: dos pulsaciones del mismo visitante sobre el mismo
    // producto en pocos minutos son un solo lead, no dos.
    const huella = createHash('sha256')
      .update(
        `${dto.producto_id}:${dto.variante_id ?? 0}:${dto.ip ?? 'sin-ip'}`,
      )
      .digest('hex')
      .slice(0, 32);

    const reciente = await this.prisma.leadWhatsApp.findFirst({
      where: {
        huella,
        createdAt: { gte: new Date(Date.now() - VENTANA_DEDUPE_MS) },
      },
      select: { id: true, createdAt: true },
    });

    if (reciente) {
      return CoreResponse.success('Lead ya registrado', {
        ...reciente,
        duplicado: true,
      });
    }

    const created = await this.prisma.leadWhatsApp.create({
      data: {
        producto_id: dto.producto_id,
        variante_id: dto.variante_id ?? null,
        telefono: dto.telefono ?? null,
        mensaje: dto.mensaje,
        origen: dto.origen,
        huella,
      },
      // No se devuelve el teléfono: el visitante ya lo conoce y así el
      // endpoint público no reexpone datos.
      select: { id: true, createdAt: true },
    });

    return CoreResponse.created('Lead registrado correctamente', {
      ...created,
      duplicado: false,
    });
  }

  // ===================================================================================
  // Listado de admin: incluye teléfono y datos del producto.
  async listar(options: QueryOptionsSchemaType) {
    try {
      const where = buildFilters<Prisma.LeadWhatsAppWhereInput>(
        options.filtros,
        FILTROS_ADMIN,
      );

      const { take, skip, orderBy } = buildPagination(options);

      const [total, data] = await this.prisma.$transaction([
        this.prisma.leadWhatsApp.count({ where }),
        this.prisma.leadWhatsApp.findMany({
          where,
          take,
          skip,
          orderBy: orderBy ?? [{ createdAt: 'desc' }],
          include: {
            producto: { select: { id: true, nombre: true, slug: true } },
            variante: {
              select: {
                id: true,
                sku: true,
                talla: { select: { id: true, etiqueta: true } },
                color: { select: { id: true, nombre: true } },
              },
            },
          },
        }),
      ]);

      return CoreResponse.paginated(
        'Leads obtenidos correctamente',
        data,
        total,
        options.page ?? 1,
        resolveLimit(options),
      );
    } catch (err) {
      return handlePrismaFilterError(err);
    }
  }

  // ===================================================================================
  // Métricas para el dashboard: totales, desglose por origen y ranking
  // de productos más consultados.
  async metricas(dias = 30) {
    const ventana = Math.min(Math.max(dias, 1), 365);

    const desde = new Date();
    desde.setDate(desde.getDate() - ventana);

    // groupBy no se agrupa en $transaction: dentro del array pierde el
    // tipado de _count.
    const [total, enVentana] = await this.prisma.$transaction([
      this.prisma.leadWhatsApp.count(),
      this.prisma.leadWhatsApp.count({ where: { createdAt: { gte: desde } } }),
    ]);

    const porOrigen = await this.prisma.leadWhatsApp.groupBy({
      by: ['origen'],
      _count: { _all: true },
      where: { createdAt: { gte: desde } },
      orderBy: { origen: 'asc' },
    });

    const topProductos = await this.prisma.leadWhatsApp.groupBy({
      by: ['producto_id'],
      _count: { _all: true },
      where: { createdAt: { gte: desde } },
      orderBy: { _count: { producto_id: 'desc' } },
      take: 10,
    });

    // groupBy no puede incluir relaciones: se resuelven los nombres aparte.
    const productos = await this.prisma.producto.findMany({
      where: { id: { in: topProductos.map((p) => p.producto_id) } },
      select: { id: true, nombre: true, slug: true },
    });

    const nombrePorId = new Map(productos.map((p) => [p.id, p]));

    return CoreResponse.success('Métricas obtenidas correctamente', {
      ventanaDias: ventana,
      total,
      enVentana,
      porOrigen: porOrigen.map((o) => ({
        origen: o.origen,
        leads: o._count._all,
      })),
      topProductos: topProductos.map((p) => ({
        producto: nombrePorId.get(p.producto_id) ?? null,
        leads: p._count._all,
      })),
    });
  }
  // ===================================================================================
  // Seguimiento comercial: mover el lead por el embudo y anotar el resultado.
  async actualizar(
    id: number,
    dto: {
      estado?: EstadoLead;
      nota?: string | null;
      telefono?: string | null;
    },
  ) {
    const existe = await this.prisma.leadWhatsApp.findUnique({
      where: { id },
      select: { id: true, estado: true, cupon_id: true },
    });

    if (!existe) throw new NotFoundException('Lead no encontrado');

    const actualizado = await this.prisma.leadWhatsApp.update({
      where: { id },
      data: {
        ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
        ...(dto.nota !== undefined ? { nota: dto.nota } : {}),
        ...(dto.telefono !== undefined ? { telefono: dto.telefono } : {}),
      },
      include: {
        producto: { select: { id: true, nombre: true, slug: true } },
      },
    });

    // Marcar el lead como VENDIDO consume el cupón que traía: es el único
    // momento en que se sabe que la venta se cerró.
    if (
      dto.estado === EstadoLead.VENDIDO &&
      existe.estado !== EstadoLead.VENDIDO &&
      existe.cupon_id
    ) {
      await this.prisma.cupon
        .update({
          where: { id: existe.cupon_id },
          data: { usos: { increment: 1 } },
        })
        .catch(() => undefined);
    }

    return CoreResponse.updated('Lead actualizado correctamente', actualizado);
  }

  // ===================================================================================
  async detalle(id: number) {
    const lead = await this.prisma.leadWhatsApp.findUnique({
      where: { id },
      include: {
        producto: {
          select: { id: true, nombre: true, slug: true, precioDesde: true },
        },
        variante: {
          select: {
            id: true,
            sku: true,
            stock: true,
            talla: { select: { id: true, etiqueta: true } },
            color: { select: { id: true, nombre: true } },
          },
        },
        cupon: { select: { id: true, codigo: true } },
      },
    });

    if (!lead) throw new NotFoundException('Lead no encontrado');

    return CoreResponse.success('Lead obtenido correctamente', lead);
  }

  // ===================================================================================
  // Embudo de conversión: cuántos leads hay en cada estado y qué porcentaje
  // acaba en venta.
  async embudo(dias = 30) {
    const ventana = Math.min(Math.max(dias, 1), 365);
    const desde = new Date();
    desde.setDate(desde.getDate() - ventana);

    const porEstado = await this.prisma.leadWhatsApp.groupBy({
      by: ['estado'],
      _count: { _all: true },
      where: { createdAt: { gte: desde } },
      orderBy: { estado: 'asc' },
    });

    const total = porEstado.reduce((suma, e) => suma + e._count._all, 0);
    const vendidos =
      porEstado.find((e) => e.estado === EstadoLead.VENDIDO)?._count._all ?? 0;

    return CoreResponse.success('Embudo obtenido correctamente', {
      ventanaDias: ventana,
      total,
      porEstado: porEstado.map((e) => ({
        estado: e.estado,
        leads: e._count._all,
        porcentaje: total > 0 ? Math.round((e._count._all / total) * 100) : 0,
      })),
      tasaCierre: total > 0 ? Math.round((vendidos / total) * 100) : 0,
    });
  }

  // ===================================================================================
  // Conversión por producto: vistas frente a leads. Es el dato que indica
  // qué ficha necesita mejor foto o mejor precio.
  async conversionPorProducto(limite = 20) {
    const productos = await this.prisma.producto.findMany({
      where: { deletedAt: null, vistas: { gt: 0 } },
      take: Math.min(Math.max(limite, 1), 100),
      orderBy: { vistas: 'desc' },
      select: {
        id: true,
        nombre: true,
        slug: true,
        vistas: true,
        _count: { select: { leadsWhatsApp: true } },
      },
    });

    return CoreResponse.success('Conversión obtenida correctamente', {
      productos: productos.map(({ _count, ...p }) => ({
        ...p,
        leads: _count.leadsWhatsApp,
        // Porcentaje de visitas que acabaron en un contacto.
        conversion:
          p.vistas > 0
            ? Math.round((_count.leadsWhatsApp / p.vistas) * 1000) / 10
            : 0,
      })),
    });
  }
}
