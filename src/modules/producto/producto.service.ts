import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EstadoProducto, Prisma } from '@prisma/client';
import { CreateProductoDto } from './dto/createProductoDto';
import { UpdatePrecioProductoDto } from './dto/updatePrecioProducto.dto';
import { CreateVideoProductoDto } from './dto/createVideoProducto.dto';
import { UpdateVideoProductoDto } from './dto/updateVideoProducto.dto';
import { CreateVarianteProductoDto } from './dto/createVarianteProducto.dto';
import { UpdateVarianteProductoDto } from './dto/updateVarianteProducto.dto';
import { ConnectRelacionesProductoDto } from './dto/connectRelacionesProducto.dto';
import { DisconnectRelacionesProductoDto } from './dto/disconnectRelacionesProducto.dto';
import { SetProductoRelacionesDto } from './dto/set-producto-relaciones.dto';

type Pagination = { page?: number; limit?: number };

@Injectable()
export class ProductoService {
  constructor(private readonly prisma: PrismaService) {}

  // ===================================================================================
  async createProducto(dto: CreateProductoDto) {
    const slug = dto.slug?.trim();
    const nombre = dto.nombre?.trim();

    if (!slug) throw new BadRequestException('slug es obligatorio');
    if (!nombre) throw new BadRequestException('nombre es obligatorio');

    const precioBase =
      dto.precioBase == null || dto.precioBase === 0
        ? null
        : new Prisma.Decimal(Number(dto.precioBase));

    if (dto.precioBase != null && !Number.isFinite(Number(dto.precioBase))) {
      throw new BadRequestException('precioBase inválido');
    }

    try {
      const p = await this.prisma.producto.create({
        data: {
          nombre,
          slug,
          descripcion: dto.descripcion?.trim() ? dto.descripcion.trim() : null,
          estado: dto.estado ?? EstadoProducto.ACTIVO,
          precioBase,
        },
        select: {
          id: true,
          nombre: true,
          slug: true,
          estado: true,
          precioBase: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return {
        ...p,
        precioBase: p.precioBase != null ? Number(p.precioBase) : null,
      };
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (e?.code === 'P2002') {
        throw new ConflictException('El slug ya existe. Usa otro.');
      }
      throw e;
    }
  }

  // ===================================================================================
  async getProductos(
    params: { q?: string; estado?: EstadoProducto } & Pagination,
  ) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ProductoWhereInput = {
      ...(params.estado ? { estado: params.estado } : {}),
      ...(params.q?.trim()
        ? {
            OR: [
              { nombre: { contains: params.q.trim() } },
              { slug: { contains: params.q.trim() } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.producto.count({ where }),
      this.prisma.producto.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          nombre: true,
          slug: true,
          estado: true,
          createdAt: true,
          updatedAt: true,
          precioBase: true,

          imagenes: {
            select: { url: true, orden: true },
            orderBy: { orden: 'asc' },
            take: 1,
          },

          colecciones: {
            select: { coleccion: { select: { nombre: true } } },
          },
          categorias: {
            select: { categoria: { select: { nombre: true } } },
          },
          insignias: {
            select: { insignia: { select: { nombre: true } } },
          },

          precio: {
            select: {
              activo: true,
              porcentajeDescuento: true,
              precioOferta: true,
            },
          },

          variantes: {
            select: { stock: true, activo: true },
          },
        },
      }),
    ]);

    const data = rows.map((p) => {
      const stockTotal = (p.variantes ?? []).reduce(
        (acc, v) => acc + (v.stock ?? 0),
        0,
      );
      const tieneOferta = Boolean(
        p.precio?.activo && (p.precio?.porcentajeDescuento ?? 0) > 0,
      );

      return {
        id: p.id,
        nombre: p.nombre,
        slug: p.slug,
        estado: p.estado,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        precioBase: p.precioBase != null ? Number(p.precioBase) : null,
        imagenUrl: p.imagenes?.[0]?.url ?? null,
        colecciones: (p.colecciones ?? []).map((x) => x.coleccion.nombre),
        categorias: (p.categorias ?? []).map((x) => x.categoria.nombre),
        insignias: (p.insignias ?? []).map((x) => x.insignia.nombre),
        stockTotal,
        tieneOferta,
      };
    });

    return {
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      data,
    };
  }

  // ===================================================================================
  async getProducto(id: number) {
    const p = await this.prisma.producto.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        slug: true,
        descripcion: true,
        estado: true,
        precioBase: true,
        createdAt: true,
        updatedAt: true,

        imagenes: {
          select: {
            id: true,
            url: true,
            alt: true,
            orden: true,
            tipo: true,
            createdAt: true,
          },
          orderBy: { orden: 'asc' },
        },

        videos: {
          select: {
            id: true,
            plataforma: true,
            url: true,
            etiqueta: true,
            orden: true,
            createdAt: true,
          },
          orderBy: { orden: 'asc' },
        },

        precio: {
          select: {
            producto_id: true,
            precioOriginal: true,
            porcentajeDescuento: true,
            precioOferta: true,
            iniciaEn: true,
            terminaEn: true,
            activo: true,
            createdAt: true,
            updatedAt: true,
          },
        },

        variantes: {
          select: {
            id: true,
            sku: true,
            precio: true,
            stock: true,
            activo: true,
            createdAt: true,
            updatedAt: true,
            talla: { select: { id: true, etiqueta: true, activo: true } },
            color: {
              select: { id: true, nombre: true, hex: true, activo: true },
            },
          },
          orderBy: [{ activo: 'desc' }, { createdAt: 'desc' }],
        },

        categorias: {
          select: {
            asignadoEn: true,
            categoria: {
              select: { id: true, nombre: true, slug: true, activo: true },
            },
          },
        },
        colecciones: {
          select: {
            asignadoEn: true,
            coleccion: {
              select: {
                id: true,
                nombre: true,
                slug: true,
                descripcion: true,
                imagenPortada: true,
                iniciaEn: true,
                terminaEn: true,
                activo: true,
              },
            },
          },
        },
        insignias: {
          select: {
            asignadoEn: true,
            insignia: {
              select: {
                id: true,
                nombre: true,
                slug: true,
                color: true,
                activo: true,
              },
            },
          },
        },
      },
    });

    if (!p) throw new NotFoundException('Producto no encontrado');

    return {
      ...p,
      precioBase: p.precioBase != null ? Number(p.precioBase) : null,
      precio: p.precio
        ? {
            ...p.precio,
            precioOriginal: Number(p.precio.precioOriginal),
            precioOferta:
              p.precio.precioOferta != null
                ? Number(p.precio.precioOferta)
                : null,
          }
        : null,
      variantes: p.variantes.map((v) => ({
        ...v,
        precio: v.precio != null ? Number(v.precio) : null,
      })),
    };
  }

  // ===================================================================================
  async upsertPrecioProducto(productoId: number, dto: UpdatePrecioProductoDto) {
    // producto existe
    const producto = await this.prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const precioOriginalN = Number(dto.precioOriginal);
    if (!Number.isFinite(precioOriginalN) || precioOriginalN <= 0) {
      throw new BadRequestException('precioOriginal debe ser un número > 0');
    }

    const porcentajeDescuento =
      dto.porcentajeDescuento == null
        ? 0
        : Math.trunc(Number(dto.porcentajeDescuento));

    if (
      !Number.isFinite(porcentajeDescuento) ||
      porcentajeDescuento < 0 ||
      porcentajeDescuento > 100
    ) {
      throw new BadRequestException(
        'porcentajeDescuento debe estar entre 0 y 100',
      );
    }

    const iniciaEn =
      dto.iniciaEn == null || dto.iniciaEn === ''
        ? null
        : (() => {
            const d = new Date(dto.iniciaEn);
            if (Number.isNaN(d.getTime()))
              throw new BadRequestException('iniciaEn inválido');
            return d;
          })();

    const terminaEn =
      dto.terminaEn == null || dto.terminaEn === ''
        ? null
        : (() => {
            const d = new Date(dto.terminaEn);
            if (Number.isNaN(d.getTime()))
              throw new BadRequestException('terminaEn inválido');
            return d;
          })();

    if (iniciaEn && terminaEn && terminaEn < iniciaEn) {
      throw new BadRequestException(
        'terminaEn no puede ser menor que iniciaEn',
      );
    }

    const precioOfertaN =
      dto.precioOferta == null || dto.precioOferta === 0
        ? null
        : Number(dto.precioOferta);

    if (
      precioOfertaN != null &&
      (!Number.isFinite(precioOfertaN) || precioOfertaN < 0)
    ) {
      throw new BadRequestException('precioOferta inválido');
    }

    if (
      porcentajeDescuento > 0 &&
      precioOfertaN != null &&
      precioOfertaN >= precioOriginalN
    ) {
      throw new BadRequestException(
        'precioOferta debe ser menor que precioOriginal cuando hay descuento',
      );
    }

    const activo = dto.activo ?? true;

    const row = await this.prisma.precioProducto.upsert({
      where: { producto_id: productoId }, // ✅ tu PK real
      create: {
        producto_id: productoId,
        precioOriginal: new Prisma.Decimal(precioOriginalN),
        porcentajeDescuento,
        precioOferta:
          precioOfertaN == null ? null : new Prisma.Decimal(precioOfertaN),
        iniciaEn,
        terminaEn,
        activo,
      },
      update: {
        precioOriginal: new Prisma.Decimal(precioOriginalN),
        porcentajeDescuento,
        precioOferta:
          precioOfertaN == null ? null : new Prisma.Decimal(precioOfertaN),
        iniciaEn,
        terminaEn,
        activo,
      },
      select: {
        producto_id: true,
        precioOriginal: true,
        porcentajeDescuento: true,
        precioOferta: true,
        iniciaEn: true,
        terminaEn: true,
        activo: true,
        updatedAt: true,
      },
    });

    return {
      ...row,
      precioOriginal: Number(row.precioOriginal),
      precioOferta: row.precioOferta != null ? Number(row.precioOferta) : null,
    };
  }

  async deletePrecioProducto(productoId: number) {
    const exists = await this.prisma.precioProducto.findUnique({
      where: { producto_id: productoId },
      select: { producto_id: true },
    });
    if (!exists)
      throw new NotFoundException('El producto no tiene precio/oferta');

    await this.prisma.precioProducto.delete({
      where: { producto_id: productoId },
    });
    return { ok: true };
  }

  // ===================================================================================
  async createVideoProducto(productoId: number, dto: CreateVideoProductoDto) {
    const producto = await this.prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true },
    });
    if (!producto) throw new NotFoundException('Producto no existe');

    return this.prisma.videoProducto.create({
      data: {
        producto_id: productoId,
        plataforma: dto.plataforma,
        url: dto.url,
        etiqueta: dto.etiqueta ?? null,
        orden: dto.orden ?? 0,
      },
    });
  }

  async updateVideoProducto(
    productoId: number,
    videoId: number,
    dto: UpdateVideoProductoDto,
  ) {
    const video = await this.prisma.videoProducto.findFirst({
      where: { id: videoId, producto_id: productoId },
      select: { id: true },
    });
    if (!video)
      throw new NotFoundException('Video no existe para este producto');

    return this.prisma.videoProducto.update({
      where: { id: videoId },
      data: {
        plataforma: dto.plataforma ?? undefined,
        url: dto.url ?? undefined,
        etiqueta: dto.etiqueta === undefined ? undefined : dto.etiqueta,
        orden: dto.orden ?? undefined,
      },
    });
  }

  async deleteVideoProducto(productoId: number, videoId: number) {
    const video = await this.prisma.videoProducto.findFirst({
      where: { id: videoId, producto_id: productoId },
      select: { id: true },
    });
    if (!video)
      throw new NotFoundException('Video no existe para este producto');

    await this.prisma.videoProducto.delete({ where: { id: videoId } });
    return { productoId, videoId, deleted: true };
  }

  // ===================================================================================
  async createVarianteProducto(
    productoId: number,
    dto: CreateVarianteProductoDto,
  ) {
    const producto = await this.prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true },
    });
    if (!producto) throw new NotFoundException('Producto no existe');

    try {
      return await this.prisma.varianteProducto.create({
        data: {
          producto_id: productoId,
          talla_id: dto.talla_id,
          color_id: dto.color_id,
          sku: dto.sku ?? null,
          precio:
            dto.precio == null || dto.precio === 0
              ? null
              : new Prisma.Decimal(Number(dto.precio)),
          stock: dto.stock ?? null,
          activo: dto.activo ?? true,
        },
        include: { talla: true, color: true },
      });
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (e?.code === 'P2002') {
        throw new ConflictException(
          'Ya existe una variante con esa talla y color (o SKU duplicado)',
        );
      }
      throw e;
    }
  }

  async updateVarianteProducto(
    productoId: number,
    varianteId: number,
    dto: UpdateVarianteProductoDto,
  ) {
    const variante = await this.prisma.varianteProducto.findFirst({
      where: { id: varianteId, producto_id: productoId },
      select: { id: true },
    });
    if (!variante)
      throw new NotFoundException('Variante no existe para este producto');

    try {
      return await this.prisma.varianteProducto.update({
        where: { id: varianteId },
        data: {
          talla_id: dto.talla_id ?? undefined,
          color_id: dto.color_id ?? undefined,
          sku: dto.sku === undefined ? undefined : dto.sku,
          precio:
            dto.precio === undefined
              ? undefined
              : dto.precio == null || dto.precio === 0
                ? null
                : new Prisma.Decimal(Number(dto.precio)),
          stock: dto.stock === undefined ? undefined : dto.stock,
          activo: dto.activo ?? undefined,
        },
        include: { talla: true, color: true },
      });
    } catch (e: any) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (e?.code === 'P2002') {
        throw new ConflictException(
          'Ya existe otra variante con esa talla+color (o SKU duplicado)',
        );
      }
      throw e;
    }
  }

  async deleteVarianteProducto(productoId: number, varianteId: number) {
    const variante = await this.prisma.varianteProducto.findFirst({
      where: { id: varianteId, producto_id: productoId },
      select: { id: true },
    });
    if (!variante)
      throw new NotFoundException('Variante no existe para este producto');

    await this.prisma.varianteProducto.delete({ where: { id: varianteId } });
    return { productoId, varianteId, deleted: true };
  }

  // ===================================================================================
  // ✅ SET (reemplazar todo)
  async setRelacionesProducto(
    productoId: number,
    dto: SetProductoRelacionesDto,
  ) {
    // valida producto
    const p = await this.prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true },
    });
    if (!p) throw new NotFoundException('Producto no encontrado');

    return this.prisma.$transaction(async (tx) => {
      await tx.productoCategoria.deleteMany({
        where: { producto_id: productoId },
      });
      await tx.productoColeccion.deleteMany({
        where: { producto_id: productoId },
      });
      await tx.productoInsignia.deleteMany({
        where: { producto_id: productoId },
      });

      if (dto.categoriaIds?.length) {
        await tx.productoCategoria.createMany({
          data: dto.categoriaIds.map((categoriaId) => ({
            producto_id: productoId,
            categoria_id: categoriaId,
          })),
          skipDuplicates: true,
        });
      }

      if (dto.coleccionIds?.length) {
        await tx.productoColeccion.createMany({
          data: dto.coleccionIds.map((coleccionId) => ({
            producto_id: productoId,
            coleccion_id: coleccionId,
          })),
          skipDuplicates: true,
        });
      }

      if (dto.insigniaIds?.length) {
        await tx.productoInsignia.createMany({
          data: dto.insigniaIds.map((insigniaId) => ({
            producto_id: productoId,
            insignia_id: insigniaId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.producto.findUnique({
        where: { id: productoId },
        include: {
          categorias: { include: { categoria: true } },
          colecciones: { include: { coleccion: true } },
          insignias: { include: { insignia: true } },
        },
      });
    });
  }

  // ✅ ADD (conectar) usando pivotes
  async connectRelacionesProducto(
    productoId: number,
    dto: ConnectRelacionesProductoDto,
  ) {
    const p = await this.prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true },
    });
    if (!p) throw new NotFoundException('Producto no encontrado');

    return this.prisma.$transaction(async (tx) => {
      if (dto.categoriaIds?.length) {
        await tx.productoCategoria.createMany({
          data: dto.categoriaIds.map((categoriaId) => ({
            producto_id: productoId,
            categoria_id: categoriaId,
          })),
          skipDuplicates: true,
        });
      }

      if (dto.coleccionIds?.length) {
        await tx.productoColeccion.createMany({
          data: dto.coleccionIds.map((coleccionId) => ({
            producto_id: productoId,
            coleccion_id: coleccionId,
          })),
          skipDuplicates: true,
        });
      }

      if (dto.insigniaIds?.length) {
        await tx.productoInsignia.createMany({
          data: dto.insigniaIds.map((insigniaId) => ({
            producto_id: productoId,
            insignia_id: insigniaId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.producto.findUnique({
        where: { id: productoId },
        include: {
          categorias: { include: { categoria: true } },
          colecciones: { include: { coleccion: true } },
          insignias: { include: { insignia: true } },
        },
      });
    });
  }

  // ✅ REMOVE (desconectar) usando pivotes
  async disconnectRelacionesProducto(
    productoId: number,
    dto: DisconnectRelacionesProductoDto,
  ) {
    const p = await this.prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true },
    });
    if (!p) throw new NotFoundException('Producto no encontrado');

    return this.prisma.$transaction(async (tx) => {
      if (dto.categoriaIds?.length) {
        await tx.productoCategoria.deleteMany({
          where: {
            producto_id: productoId,
            categoria_id: { in: dto.categoriaIds },
          },
        });
      }

      if (dto.coleccionIds?.length) {
        await tx.productoColeccion.deleteMany({
          where: {
            producto_id: productoId,
            coleccion_id: { in: dto.coleccionIds },
          },
        });
      }

      if (dto.insigniaIds?.length) {
        await tx.productoInsignia.deleteMany({
          where: {
            producto_id: productoId,
            insignia_id: { in: dto.insigniaIds },
          },
        });
      }

      return tx.producto.findUnique({
        where: { id: productoId },
        include: {
          categorias: { include: { categoria: true } },
          colecciones: { include: { coleccion: true } },
          insignias: { include: { insignia: true } },
        },
      });
    });
  }
}
