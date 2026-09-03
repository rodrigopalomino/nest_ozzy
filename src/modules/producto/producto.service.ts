import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EstadoProducto, Prisma } from '@prisma/client';
import { CreateProductoDto } from './dto/createProductoDto';
import { UpdateProductoType } from './schema/updateProducto.schema';
import { UpdatePrecioProductoDto } from './dto/updatePrecioProducto.dto';
import { CreateVideoProductoDto } from './dto/createVideoProducto.dto';
import { UpdateVideoProductoDto } from './dto/updateVideoProducto.dto';
import { UpdateVarianteProductoDto } from './dto/updateVarianteProducto.dto';
import { ConnectRelacionesProductoDto } from './dto/connectRelacionesProducto.dto';
import { DisconnectRelacionesProductoDto } from './dto/disconnectRelacionesProducto.dto';
import { QueryOptionsSchemaType } from 'src/common/schema/query-options.schema';
import {
  buildInclude,
  prismaQueryBuilder,
  resolveLimit,
} from 'src/common/utils/prisma-query-builder';
import { buildPaginatedResponse } from 'src/common/utils/paginate-response';
import { handlePrismaFilterError } from 'src/common/utils/prisma-filter.util';
import { CoreResponse } from 'src/common/utils/response.util';
import { MantenimientoService } from '../mantenimiento/mantenimiento.service';
import { SuscripcionStockService } from '../cliente/suscripcion-stock.service';
import { SetProductoRelacionesType } from './schema/set-producto-relaciones.schema';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { CreateVarianteProductoType } from './schema/createVarianteProducto.schema';

@Injectable()
export class ProductoService {
  private readonly logger = new Logger(ProductoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mantenimiento: MantenimientoService,
    private readonly suscripciones: SuscripcionStockService,
  ) {}

  // ===================================================================================
  async getProductos(options: QueryOptionsSchemaType) {
    try {
      const query = prismaQueryBuilder<
        Prisma.ProductoWhereInput,
        Prisma.ProductoInclude
      >(options, {
        allowedIncludes: [
          'imagenes',
          'videos',
          'precio',
          'insignias',
          'categorias',
          'colecciones',
          'variantes',
          'variantes.color',
          'variantes.talla',
        ],
        allowedFilters: [
          'id',
          'nombre',
          'slug',
          'descripcion',
          'estado',
          'precioBase',
          'createdAt',
          'updatedAt',
          'categorias',
          'colecciones',
          'insignias',
          'variantes',
          'precio',
          // Rutas anidadas para la busqueda global del panel. Deben ir
          // completas (la whitelist no acepta prefijos) y marcar con "[]"
          // los segmentos que son relaciones de lista.
          'variantes[].sku',
          'variantes[].color.nombre',
          'variantes[].talla.etiqueta',
          'categorias[].categoria.nombre',
          'colecciones[].coleccion.nombre',
        ],
      });

      const page = options.page ? Number(options.page) : 1;
      const limit = resolveLimit(options);

      // La papelera se consulta aparte: no debe aparecer en el listado.
      const where = { AND: [{ deletedAt: null }, query.where] };

      const [total, data] = await this.prisma.$transaction([
        this.prisma.producto.count({ where }),
        this.prisma.producto.findMany({ ...query, where }),
      ]);

      return buildPaginatedResponse(data, total, page, limit);
    } catch (err) {
      return handlePrismaFilterError(err);
    }
  }

  // ===================================================================================
  // ===================================================================================
  async getProducto(producto_id: number, options: QueryOptionsSchemaType) {
    const query = {
      include: buildInclude(options.include, [
        'imagenes',
        'videos',
        'variantes',
        'precio',
        'insignias',
        'categorias',
        'colecciones',

        'variantes.color',
        'variantes.talla',
      ]),
    };

    const producto = await this.prisma.producto.findUnique({
      where: { id: producto_id },
      ...query,
    });

    if (!producto) throw new NotFoundException('Producto no encontrado');

    return CoreResponse.success('Producto obtenido correctamente', producto);
  }

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

      return CoreResponse.created('Producto creado correctamente', {
        ...p,
        precioBase: p.precioBase != null ? Number(p.precioBase) : null,
      });
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (e?.code === 'P2002') {
        throw new ConflictException('El slug ya existe. Usa otro.');
      }
      throw e;
    }
  }

  // ===================================================================================
  async updateProducto(id: number, dto: UpdateProductoType) {
    const exists = await this.prisma.producto.findUnique({
      where: { id },
      select: { id: true, slug: true, version: true },
    });

    if (!exists) throw new NotFoundException('Producto no encontrado');

    // Concurrencia optimista: si el cliente envía la versión que leyó y ya
    // no coincide, otro administrador guardó primero.
    if (dto.version !== undefined && dto.version !== exists.version) {
      throw new ConflictException({
        message:
          'El producto fue modificado por otra persona. Recarga y vuelve a intentarlo.',
        versionEnviada: dto.version,
        versionActual: exists.version,
      });
    }

    const cambiaSlug = Boolean(dto.slug && dto.slug !== exists.slug);

    if (cambiaSlug) {
      const dup = await this.prisma.producto.findUnique({
        where: { slug: dto.slug! },
        select: { id: true },
      });

      if (dup) throw new ConflictException('El slug ya existe. Usa otro.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const producto = await tx.producto.update({
        where: { id },
        data: {
          ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
          ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
          ...(dto.descripcion !== undefined
            ? { descripcion: dto.descripcion }
            : {}),
          ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
          ...(dto.destacado !== undefined ? { destacado: dto.destacado } : {}),
          ...(dto.orden !== undefined ? { orden: dto.orden } : {}),
          ...(dto.metaTitulo !== undefined
            ? { metaTitulo: dto.metaTitulo }
            : {}),
          ...(dto.metaDescripcion !== undefined
            ? { metaDescripcion: dto.metaDescripcion }
            : {}),
          ...(dto.ogImagen !== undefined ? { ogImagen: dto.ogImagen } : {}),
          ...(dto.precioBase !== undefined
            ? {
                precioBase:
                  dto.precioBase === null
                    ? null
                    : new Prisma.Decimal(dto.precioBase),
              }
            : {}),
          // Cada guardado sube la versión, para que el siguiente choque se
          // detecte.
          version: { increment: 1 },
        },
        select: {
          id: true,
          nombre: true,
          slug: true,
          descripcion: true,
          estado: true,
          precioBase: true,
          destacado: true,
          orden: true,
          metaTitulo: true,
          metaDescripcion: true,
          ogImagen: true,
          version: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // El slug viejo se guarda para que los enlaces ya compartidos sigan
      // resolviendo en lugar de devolver 404.
      if (cambiaSlug) {
        await tx.redireccion.upsert({
          where: {
            entidad_slugViejo: {
              entidad: 'producto',
              slugViejo: exists.slug,
            },
          },
          update: { slugNuevo: producto.slug },
          create: {
            entidad: 'producto',
            slugViejo: exists.slug,
            slugNuevo: producto.slug,
          },
        });

        // Las redirecciones en cadena se aplanan: si A apuntaba a B y B
        // pasa a C, A debe apuntar directamente a C.
        await tx.redireccion.updateMany({
          where: { entidad: 'producto', slugNuevo: exists.slug },
          data: { slugNuevo: producto.slug },
        });
      }

      return producto;
    });

    // precioBase influye en precioDesde, que es el campo por el que se
    // ordena y filtra en el catálogo.
    if (dto.precioBase !== undefined) {
      await this.mantenimiento.recalcularPrecioDesde(id);
    }

    return CoreResponse.updated('Producto actualizado correctamente', {
      ...updated,
      precioBase:
        updated.precioBase != null ? Number(updated.precioBase) : null,
    });
  }

  // ===================================================================================
  // Borrado definitivo. Las imágenes, videos, variantes, precio y relaciones
  // caen por onDelete: Cascade; los leads también, así que se avisa cuántos
  // se perderían y se exige confirmación explícita.
  async deleteProducto(
    id: number,
    opciones: { confirmar?: boolean; definitivo?: boolean } = {},
  ) {
    const producto = await this.prisma.producto.findUnique({
      where: { id },
      select: {
        id: true,
        nombre: true,
        deletedAt: true,
        _count: { select: { leadsWhatsApp: true } },
      },
    });

    if (!producto) throw new NotFoundException('Producto no encontrado');

    // Por defecto se archiva en la papelera: reversible y conserva los
    // leads. El borrado definitivo hay que pedirlo explícitamente.
    if (!opciones.definitivo) {
      if (producto.deletedAt) {
        return CoreResponse.success('El producto ya estaba en la papelera', {
          id: producto.id,
          deletedAt: producto.deletedAt,
        });
      }

      const archivado = await this.prisma.producto.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          estado: EstadoProducto.ARCHIVADO,
        },
        select: { id: true, nombre: true, deletedAt: true },
      });

      return CoreResponse.deleted(
        'Producto movido a la papelera. Puedes restaurarlo desde ahí.',
      );
    }

    const leads = producto._count.leadsWhatsApp;

    if (leads > 0 && !opciones.confirmar) {
      throw new ConflictException({
        message:
          'El producto tiene leads asociados que se borrarían con él. ' +
          'Repite la llamada con ?confirmar=true, o déjalo en la papelera ' +
          'para conservar el historial.',
        leads,
      });
    }

    await this.prisma.producto.delete({ where: { id } });

    return CoreResponse.deleted('Producto eliminado definitivamente');
  }

  // ===================================================================================
  // Devuelve un producto de la papelera al catálogo, oculto para poder
  // revisarlo antes de publicarlo.
  async restaurarProducto(id: number) {
    const producto = await this.prisma.producto.findUnique({
      where: { id },
      select: { id: true, deletedAt: true },
    });

    if (!producto) throw new NotFoundException('Producto no encontrado');

    if (!producto.deletedAt) {
      throw new BadRequestException('El producto no está en la papelera');
    }

    const restaurado = await this.prisma.producto.update({
      where: { id },
      data: { deletedAt: null, estado: EstadoProducto.OCULTO },
      select: { id: true, nombre: true, slug: true, estado: true },
    });

    return CoreResponse.updated(
      'Producto restaurado. Está oculto: publícalo cuando lo revises.',
      restaurado,
    );
  }

  // ===================================================================================
  async listarPapelera() {
    const productos = await this.prisma.producto.findMany({
      where: { deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      select: {
        id: true,
        nombre: true,
        slug: true,
        deletedAt: true,
        _count: { select: { leadsWhatsApp: true, variantes: true } },
      },
    });

    return CoreResponse.success('Papelera obtenida correctamente', {
      productos: productos.map(({ _count, ...p }) => ({
        ...p,
        leads: _count.leadsWhatsApp,
        variantes: _count.variantes,
      })),
    });
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

    await this.mantenimiento.recalcularPrecioDesde(productoId);

    return CoreResponse.updated('Precio actualizado correctamente', {
      ...row,
      precioOriginal: Number(row.precioOriginal),
      precioOferta: row.precioOferta != null ? Number(row.precioOferta) : null,
    });
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

    await this.mantenimiento.recalcularPrecioDesde(productoId);

    return CoreResponse.deleted('Precio eliminado correctamente');
  }

  // ===================================================================================
  async createVideoProducto(productoId: number, dto: CreateVideoProductoDto) {
    const producto = await this.prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true },
    });
    if (!producto) throw new NotFoundException('Producto no existe');

    const created = await this.prisma.videoProducto.create({
      data: {
        producto_id: productoId,
        plataforma: dto.plataforma,
        url: dto.url,
        etiqueta: dto.etiqueta ?? null,
        orden: dto.orden ?? 0,
      },
    });

    return CoreResponse.created('Video creado correctamente', created);
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

    const updated = await this.prisma.videoProducto.update({
      where: { id: videoId },
      data: {
        plataforma: dto.plataforma ?? undefined,
        url: dto.url ?? undefined,
        etiqueta: dto.etiqueta === undefined ? undefined : dto.etiqueta,
        orden: dto.orden ?? undefined,
      },
    });

    return CoreResponse.updated('Video actualizado correctamente', updated);
  }

  async deleteVideoProducto(productoId: number, videoId: number) {
    const video = await this.prisma.videoProducto.findFirst({
      where: { id: videoId, producto_id: productoId },
      select: { id: true },
    });
    if (!video)
      throw new NotFoundException('Video no existe para este producto');

    await this.prisma.videoProducto.delete({ where: { id: videoId } });
    return CoreResponse.deleted('Video eliminado correctamente');
  }

  // ===================================================================================
  async createVarianteProducto(
    productoId: number,
    dto: CreateVarianteProductoType,
  ) {
    // 1) valida producto
    const producto = await this.prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true },
    });
    if (!producto) throw new NotFoundException('Producto no existe');

    // 2) valida talla / color (opcional pero recomendable)
    const [talla, color] = await Promise.all([
      this.prisma.talla.findUnique({
        where: { id: dto.talla_id },
        select: { id: true },
      }),
      this.prisma.color.findUnique({
        where: { id: dto.color_id },
        select: { id: true },
      }),
    ]);

    if (!talla) throw new BadRequestException('Talla no existe');
    if (!color) throw new BadRequestException('Color no existe');

    // 3) normaliza precio (null si viene vacío/undefined/null/"")
    const precioValue =
      dto.precio === undefined || dto.precio === null
        ? null
        : new Prisma.Decimal(dto.precio);

    if (precioValue !== null && !precioValue.isFinite()) {
      throw new BadRequestException('Precio inválido');
    }

    try {
      const created = await this.prisma.varianteProducto.create({
        data: {
          producto_id: productoId,
          talla_id: dto.talla_id,
          color_id: dto.color_id,
          sku: dto.sku?.trim() ? dto.sku.trim() : null,
          precio: precioValue,
          stock: dto.stock ?? null,
          activo: dto.activo ?? true,
        },
        include: { talla: true, color: true },
      });

      await this.mantenimiento.recalcularPrecioDesde(productoId);

      return CoreResponse.created('Variante creada correctamente', created);
    } catch (e) {
      // Prisma tipado
      if (e instanceof PrismaClientKnownRequestError) {
        // Unique constraint
        if (e.code === 'P2002') {
          throw new ConflictException(
            'Ya existe una variante con esa talla y color (o SKU duplicado).',
          );
        }
        // FK constraint
        if (e.code === 'P2003') {
          throw new BadRequestException('Talla o color inválidos.');
        }
      }
      throw e;
    }
  }

  async updateVarianteProducto(
    productoId: number,
    varianteId: number,
    dto: UpdateVarianteProductoDto,
  ) {
    const antes = await this.prisma.varianteProducto.findFirst({
      where: { id: varianteId, producto_id: productoId },
      select: { id: true, stock: true },
    });
    if (!antes)
      throw new NotFoundException('Variante no existe para este producto');

    try {
      const updated = await this.prisma.varianteProducto.update({
        where: { id: varianteId },
        data: {
          talla_id: dto.talla_id ?? undefined,
          color_id: dto.color_id ?? undefined,
          sku: dto.sku === undefined ? undefined : dto.sku,
          // precio 0 es un precio válido (producto gratuito o de regalo).
          // Sólo null borra el precio propio de la variante para que herede
          // el del producto; antes un 0 se guardaba como null.
          precio:
            dto.precio === undefined
              ? undefined
              : dto.precio === null
                ? null
                : new Prisma.Decimal(Number(dto.precio)),
          stock: dto.stock === undefined ? undefined : dto.stock,
          activo: dto.activo ?? undefined,
        },
        include: { talla: true, color: true },
      });

      // Si el stock pasó de agotado a disponible, se avisa a quien lo
      // pidió. Es el momento exacto en que la reposición ocurre.
      const seRepuso =
        antes.stock !== null &&
        antes.stock <= 0 &&
        updated.stock !== null &&
        updated.stock > 0;

      if (seRepuso) {
        await this.suscripciones
          .notificarReposicion(varianteId)
          .catch((e: Error) =>
            this.logger.warn(
              `No se pudieron encolar los avisos de reposición: ${e.message}`,
            ),
          );
      }

      // El precio de la variante entra en el precioDesde del producto.
      if (dto.precio !== undefined || dto.activo !== undefined) {
        await this.mantenimiento.recalcularPrecioDesde(productoId);
      }

      return CoreResponse.updated(
        'Variante actualizada correctamente',
        updated,
      );
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
    return CoreResponse.deleted('Variante eliminada correctamente');
  }

  // ===================================================================================
  // ✅ SET (reemplazar todo)
  // async setRelacionesProducto(
  //   productoId: number,
  //   dto: SetProductoRelacionesType,
  // ) {
  //   console.log('entero');

  //   try {
  //     // valida producto
  //     const p = await this.prisma.producto.findUnique({
  //       where: { id: productoId },
  //       select: { id: true },
  //     });
  //     if (!p) throw new NotFoundException('Producto no encontrado');

  //     return this.prisma.$transaction(async (tx) => {
  //       await tx.productoCategoria.deleteMany({
  //         where: { producto_id: productoId },
  //       });
  //       await tx.productoColeccion.deleteMany({
  //         where: { producto_id: productoId },
  //       });
  //       await tx.productoInsignia.deleteMany({
  //         where: { producto_id: productoId },
  //       });

  //       if (dto.categoriaIds?.length) {
  //         await tx.productoCategoria.createMany({
  //           data: dto.categoriaIds.map((categoriaId) => ({
  //             producto_id: productoId,
  //             categoria_id: categoriaId,
  //           })),
  //           skipDuplicates: true,
  //         });
  //       }

  //       if (dto.coleccionIds?.length) {
  //         await tx.productoColeccion.createMany({
  //           data: dto.coleccionIds.map((coleccionId) => ({
  //             producto_id: productoId,
  //             coleccion_id: coleccionId,
  //           })),
  //           skipDuplicates: true,
  //         });
  //       }

  //       if (dto.insigniaIds?.length) {
  //         await tx.productoInsignia.createMany({
  //           data: dto.insigniaIds.map((insigniaId) => ({
  //             producto_id: productoId,
  //             insignia_id: insigniaId,
  //           })),
  //           skipDuplicates: true,
  //         });
  //       }

  //       return tx.producto.findUnique({
  //         where: { id: productoId },
  //         include: {
  //           categorias: { include: { categoria: true } },
  //           colecciones: { include: { coleccion: true } },
  //           insignias: { include: { insignia: true } },
  //         },
  //       });
  //     });
  //   } catch (error) {
  //     console.log('error => ', error);
  //   }
  // }
  async setRelacionesProducto(
    productoId: number,
    dto: SetProductoRelacionesType,
  ) {
    // valida producto fuera
    const p = await this.prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true },
    });
    if (!p) throw new NotFoundException('Producto no encontrado');

    // ✅ solo escrituras dentro del tx (rápido)
    await this.prisma.$transaction(async (tx) => {
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
    });

    // ✅ lectura fuera del tx (ya no puede “expirar” la tx)
    const producto = await this.prisma.producto.findUnique({
      where: { id: productoId },
      include: {
        categorias: { include: { categoria: true } },
        colecciones: { include: { coleccion: true } },
        insignias: { include: { insignia: true } },
      },
    });

    return CoreResponse.updated(
      'Relaciones actualizadas correctamente',
      producto,
    );
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

    const producto = await this.prisma.$transaction(async (tx) => {
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

    return CoreResponse.updated(
      'Relaciones conectadas correctamente',
      producto,
    );
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

    const producto = await this.prisma.$transaction(async (tx) => {
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

    return CoreResponse.updated(
      'Relaciones desconectadas correctamente',
      producto,
    );
  }
}
