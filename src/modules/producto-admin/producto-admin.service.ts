//* src/modules/producto-admin/producto-admin.service.ts

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EstadoProducto, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CoreResponse } from 'src/common/utils/response.util';
import { aFecha } from 'src/common/schema/fecha.schema';
import { MantenimientoService } from '../mantenimiento/mantenimiento.service';
import {
  AccionLoteType,
  CrearProductoCompletoType,
  DuplicarProductoType,
  GuiaTallasType,
  RelacionadosCuradosType,
  ReordenarProductosType,
} from './schema/producto-admin.schema';

// ===================================================================================
// Operaciones de catálogo que trabajan sobre varios registros a la vez.
//
// Cargar cien productos de uno en uno por formulario no es viable, así que
// aquí viven el alta completa, el duplicado, las acciones en lote y la
// importación y exportación en CSV.
// ===================================================================================

@Injectable()
export class ProductoAdminService {
  private readonly logger = new Logger(ProductoAdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mantenimiento: MantenimientoService,
  ) {}

  // ===================================================================================
  // Alta completa y atómica: si algo falla no queda un producto a medias.
  async crearCompleto(dto: CrearProductoCompletoType) {
    const dup = await this.prisma.producto.findUnique({
      where: { slug: dto.slug },
      select: { id: true },
    });

    if (dup) throw new ConflictException('El slug ya existe. Usa otro.');

    // Las referencias se validan antes de abrir la transacción: así el
    // error es claro en lugar de una violación de clave ajena.
    if (dto.variantes?.length) {
      await this.validarReferenciasVariantes(dto.variantes);
    }

    const producto = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.producto.create({
        data: {
          nombre: dto.nombre,
          slug: dto.slug,
          descripcion: dto.descripcion ?? null,
          estado: dto.estado ?? EstadoProducto.ACTIVO,
          precioBase:
            dto.precioBase != null ? new Prisma.Decimal(dto.precioBase) : null,
          destacado: dto.destacado ?? false,
          metaTitulo: dto.metaTitulo ?? null,
          metaDescripcion: dto.metaDescripcion ?? null,
        },
      });

      if (dto.precio) {
        await tx.precioProducto.create({
          data: {
            producto_id: creado.id,
            precioOriginal: new Prisma.Decimal(dto.precio.precioOriginal),
            porcentajeDescuento: dto.precio.porcentajeDescuento ?? 0,
            precioOferta:
              dto.precio.precioOferta != null
                ? new Prisma.Decimal(dto.precio.precioOferta)
                : null,
            iniciaEn: aFecha(dto.precio.iniciaEn) ?? null,
            terminaEn: aFecha(dto.precio.terminaEn) ?? null,
            activo: dto.precio.activo ?? true,
          },
        });
      }

      if (dto.variantes?.length) {
        await tx.varianteProducto.createMany({
          data: dto.variantes.map((v) => ({
            producto_id: creado.id,
            talla_id: v.talla_id,
            color_id: v.color_id,
            sku: v.sku?.trim() || null,
            precio: v.precio != null ? new Prisma.Decimal(v.precio) : null,
            stock: v.stock ?? null,
            activo: v.activo ?? true,
          })),
        });
      }

      await this.conectarRelaciones(tx, creado.id, dto);

      return creado;
    });

    // precioDesde se calcula fuera de la transacción: es un campo derivado
    // y su recálculo no debe alargar el bloqueo.
    await this.mantenimiento.recalcularPrecioDesde(producto.id);

    return CoreResponse.created('Producto creado correctamente', {
      id: producto.id,
      slug: producto.slug,
      variantes: dto.variantes?.length ?? 0,
    });
  }

  // ===================================================================================
  private async validarReferenciasVariantes(
    variantes: { talla_id: number; color_id: number }[],
  ) {
    const tallaIds = [...new Set(variantes.map((v) => v.talla_id))];
    const colorIds = [...new Set(variantes.map((v) => v.color_id))];

    const [tallas, colores] = await Promise.all([
      this.prisma.talla.findMany({
        where: { id: { in: tallaIds } },
        select: { id: true },
      }),
      this.prisma.color.findMany({
        where: { id: { in: colorIds } },
        select: { id: true },
      }),
    ]);

    const tallasOk = new Set(tallas.map((t) => t.id));
    const coloresOk = new Set(colores.map((c) => c.id));

    const tallasFaltan = tallaIds.filter((id) => !tallasOk.has(id));
    const coloresFaltan = colorIds.filter((id) => !coloresOk.has(id));

    if (tallasFaltan.length > 0 || coloresFaltan.length > 0) {
      throw new BadRequestException({
        message: 'Hay referencias inválidas en las variantes.',
        tallasInexistentes: tallasFaltan,
        coloresInexistentes: coloresFaltan,
      });
    }

    // La combinación talla+color es única por producto.
    const combos = variantes.map((v) => `${v.talla_id}-${v.color_id}`);

    if (new Set(combos).size !== combos.length) {
      throw new BadRequestException(
        'Hay variantes repetidas con la misma talla y color',
      );
    }
  }

  // ===================================================================================
  private async conectarRelaciones(
    tx: Prisma.TransactionClient,
    productoId: number,
    dto: {
      categoriaIds?: number[];
      coleccionIds?: number[];
      insigniaIds?: number[];
    },
  ) {
    if (dto.categoriaIds?.length) {
      await tx.productoCategoria.createMany({
        data: dto.categoriaIds.map((categoria_id) => ({
          producto_id: productoId,
          categoria_id,
        })),
        skipDuplicates: true,
      });
    }

    if (dto.coleccionIds?.length) {
      await tx.productoColeccion.createMany({
        data: dto.coleccionIds.map((coleccion_id) => ({
          producto_id: productoId,
          coleccion_id,
        })),
        skipDuplicates: true,
      });
    }

    if (dto.insigniaIds?.length) {
      await tx.productoInsignia.createMany({
        data: dto.insigniaIds.map((insignia_id) => ({
          producto_id: productoId,
          insignia_id,
        })),
        skipDuplicates: true,
      });
    }
  }

  // ===================================================================================
  // Duplicar: la mayoría de los productos son variaciones del anterior.
  async duplicar(id: number, dto: DuplicarProductoType) {
    const original = await this.prisma.producto.findUnique({
      where: { id },
      include: {
        precio: true,
        variantes: true,
        imagenes: true,
        categorias: true,
        colecciones: true,
        insignias: true,
      },
    });

    if (!original) throw new NotFoundException('Producto no encontrado');

    const nombre = dto.nombre ?? `${original.nombre} (copia)`;
    const slug = dto.slug ?? (await this.slugLibre(`${original.slug}-copia`));

    const copia = await this.prisma.$transaction(async (tx) => {
      const creado = await tx.producto.create({
        data: {
          nombre,
          slug,
          descripcion: original.descripcion,
          // La copia nace oculta: se revisa antes de publicarla.
          estado: EstadoProducto.OCULTO,
          precioBase: original.precioBase,
          metaTitulo: original.metaTitulo,
          metaDescripcion: original.metaDescripcion,
        },
      });

      if (original.precio) {
        await tx.precioProducto.create({
          data: {
            producto_id: creado.id,
            precioOriginal: original.precio.precioOriginal,
            porcentajeDescuento: original.precio.porcentajeDescuento,
            precioOferta: original.precio.precioOferta,
            iniciaEn: original.precio.iniciaEn,
            terminaEn: original.precio.terminaEn,
            activo: original.precio.activo,
          },
        });
      }

      if (dto.copiarVariantes !== false && original.variantes.length > 0) {
        await tx.varianteProducto.createMany({
          data: original.variantes.map((v) => ({
            producto_id: creado.id,
            talla_id: v.talla_id,
            color_id: v.color_id,
            // El SKU es único: no se copia, se asigna al revisar la copia.
            sku: null,
            precio: v.precio,
            stock: v.stock,
            activo: v.activo,
          })),
        });
      }

      // Las imágenes se comparten por URL: recopiarlas al bucket duplicaría
      // el almacenamiento sin ninguna ganancia.
      if (dto.copiarImagenes !== false && original.imagenes.length > 0) {
        await tx.imagenProducto.createMany({
          data: original.imagenes.map((i) => ({
            producto_id: creado.id,
            color_id: i.color_id,
            url: i.url,
            urlSm: i.urlSm,
            urlMd: i.urlMd,
            urlLg: i.urlLg,
            ancho: i.ancho,
            alto: i.alto,
            blurData: i.blurData,
            alt: i.alt,
            orden: i.orden,
            esPrincipal: i.esPrincipal,
            esHover: i.esHover,
          })),
        });
      }

      await this.conectarRelaciones(tx, creado.id, {
        categoriaIds: original.categorias.map((c) => c.categoria_id),
        coleccionIds: original.colecciones.map((c) => c.coleccion_id),
        insigniaIds: original.insignias.map((i) => i.insignia_id),
      });

      return creado;
    });

    await this.mantenimiento.recalcularPrecioDesde(copia.id);

    return CoreResponse.created('Producto duplicado correctamente', {
      id: copia.id,
      nombre: copia.nombre,
      slug: copia.slug,
      estado: copia.estado,
    });
  }

  // ===================================================================================
  private async slugLibre(base: string): Promise<string> {
    let intento = base;

    for (let n = 2; n < 100; n++) {
      const existe = await this.prisma.producto.findUnique({
        where: { slug: intento },
        select: { id: true },
      });

      if (!existe) return intento;

      intento = `${base}-${n}`;
    }

    // Con cien copias del mismo producto, el sufijo aleatorio evita el
    // bucle infinito sin fallar la operación.
    return `${base}-${Date.now()}`;
  }

  // ===================================================================================
  async accionEnLote(dto: AccionLoteType) {
    const existentes = await this.prisma.producto.findMany({
      where: { id: { in: dto.productoIds }, deletedAt: null },
      select: { id: true, precioBase: true },
    });

    if (existentes.length === 0) {
      throw new BadRequestException('Ninguno de los productos existe');
    }

    const ids = existentes.map((p) => p.id);

    // Estado y destacado se aplican en una sola sentencia.
    if (dto.estado !== undefined || dto.destacado !== undefined) {
      await this.prisma.producto.updateMany({
        where: { id: { in: ids } },
        data: {
          ...(dto.estado !== undefined ? { estado: dto.estado } : {}),
          ...(dto.destacado !== undefined ? { destacado: dto.destacado } : {}),
        },
      });
    }

    // El ajuste de precio es por producto: cada uno parte de su propio
    // precio base.
    if (dto.ajustePrecioPorcentaje !== undefined) {
      const factor = 1 + dto.ajustePrecioPorcentaje / 100;

      await this.prisma.$transaction(
        existentes
          .filter((p) => p.precioBase != null)
          .map((p) =>
            this.prisma.producto.update({
              where: { id: p.id },
              data: {
                precioBase: new Prisma.Decimal(
                  (Number(p.precioBase) * factor).toFixed(2),
                ),
              },
            }),
          ),
      );

      for (const id of ids) {
        await this.mantenimiento.recalcularPrecioDesde(id);
      }
    }

    return CoreResponse.updated('Acción aplicada correctamente', {
      afectados: ids.length,
      noEncontrados: dto.productoIds.filter((id) => !ids.includes(id)),
    });
  }

  // ===================================================================================
  async reordenar(dto: ReordenarProductosType) {
    const existentes = await this.prisma.producto.findMany({
      where: { id: { in: dto.productoIds } },
      select: { id: true },
    });

    if (existentes.length !== dto.productoIds.length) {
      const validos = new Set(existentes.map((p) => p.id));

      throw new BadRequestException({
        message: 'Algunos productos no existen.',
        invalidos: dto.productoIds.filter((id) => !validos.has(id)),
      });
    }

    await this.prisma.$transaction(
      dto.productoIds.map((id, index) =>
        this.prisma.producto.update({
          where: { id },
          data: { orden: index },
        }),
      ),
    );

    return CoreResponse.updated('Orden actualizado correctamente', {
      ordenados: dto.productoIds.length,
    });
  }

  // ===================================================================================
  async fijarRelacionados(id: number, dto: RelacionadosCuradosType) {
    const producto = await this.prisma.producto.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!producto) throw new NotFoundException('Producto no encontrado');

    if (dto.relacionadoIds.includes(id)) {
      throw new BadRequestException(
        'Un producto no puede estar relacionado consigo mismo',
      );
    }

    const existentes = await this.prisma.producto.findMany({
      where: { id: { in: dto.relacionadoIds } },
      select: { id: true },
    });

    if (existentes.length !== dto.relacionadoIds.length) {
      const validos = new Set(existentes.map((p) => p.id));

      throw new BadRequestException({
        message: 'Algunos productos relacionados no existen.',
        invalidos: dto.relacionadoIds.filter((rid) => !validos.has(rid)),
      });
    }

    // Se reemplaza el conjunto completo: es más simple de razonar desde el
    // panel que un alta y baja por elemento.
    await this.prisma.$transaction([
      this.prisma.productoRelacionado.deleteMany({
        where: { producto_id: id },
      }),
      ...(dto.relacionadoIds.length > 0
        ? [
            this.prisma.productoRelacionado.createMany({
              data: dto.relacionadoIds.map((relacionado_id, orden) => ({
                producto_id: id,
                relacionado_id,
                orden,
              })),
            }),
          ]
        : []),
    ]);

    return CoreResponse.updated('Productos relacionados actualizados', {
      total: dto.relacionadoIds.length,
    });
  }

  // ===================================================================================
  async guardarGuiaTallas(dto: GuiaTallasType) {
    if (!dto.categoria_id && !dto.producto_id) {
      throw new BadRequestException(
        'Indica una categoría o un producto para la guía',
      );
    }

    // Todas las filas deben tener tantas celdas como columnas, o la tabla
    // se renderiza descuadrada en el front.
    const columnas = dto.datos.columnas.length;
    const filaMala = dto.datos.filas.findIndex((f) => f.length !== columnas);

    if (filaMala >= 0) {
      throw new BadRequestException({
        message: `La fila ${filaMala + 1} no tiene ${columnas} celdas.`,
        columnas,
      });
    }

    const datos = JSON.stringify(dto.datos);

    // Una guía por producto (relación 1-1) y varias por categoría.
    if (dto.producto_id) {
      const guia = await this.prisma.guiaTallas.upsert({
        where: { producto_id: dto.producto_id },
        update: { nombre: dto.nombre, datos, nota: dto.nota ?? null },
        create: {
          producto_id: dto.producto_id,
          nombre: dto.nombre,
          datos,
          nota: dto.nota ?? null,
        },
      });

      return CoreResponse.updated('Guía de tallas guardada', {
        id: guia.id,
      });
    }

    const guia = await this.prisma.guiaTallas.create({
      data: {
        categoria_id: dto.categoria_id,
        nombre: dto.nombre,
        datos,
        nota: dto.nota ?? null,
      },
    });

    return CoreResponse.created('Guía de tallas creada', { id: guia.id });
  }

  // ===================================================================================
  async eliminarGuiaTallas(id: number) {
    const guia = await this.prisma.guiaTallas.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!guia) throw new NotFoundException('Guía no encontrada');

    await this.prisma.guiaTallas.delete({ where: { id } });

    return CoreResponse.deleted('Guía de tallas eliminada');
  }
}
