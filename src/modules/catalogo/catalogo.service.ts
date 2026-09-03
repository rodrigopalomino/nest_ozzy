//* src/modules/catalogo/catalogo.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EstadoProducto, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryOptionsDto } from 'src/common/dto/query-options.dto';
import {
  buildFilters,
  buildPagination,
  resolveLimit,
} from 'src/common/utils/prisma-query-builder';
import { CoreResponse } from 'src/common/utils/response.util';
import { handlePrismaFilterError } from 'src/common/utils/prisma-filter.util';
import {
  CATALOGO_INCLUDE,
  CATALOGO_INCLUDE_TARJETA,
  mapProductoCatalogo,
  mapProductoTarjeta,
} from '../producto/utils/catalogo.mapper';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { CONFIG_CLAVES } from '../configuracion/configuracion.constants';
import { construirJsonLdProducto } from './utils/jsonld.util';
import { parsearTablaGuia } from './utils/guia-tallas.util';

// ===================================================================================
// Catálogo público: sólo lectura y sólo productos publicados.
//
// El estado y el borrado lógico los fuerza el servidor con AND, así que el
// cliente no puede pedir OCULTO, ARCHIVADO ni eliminados manipulando los
// filtros.
// ===================================================================================

// Los campos de relación declaran la ruta por la que se filtra: el cliente
// manda `filtros[categorias]=polos` y aquí se traduce a la consulta anidada
// con `some`. Sin la ruta, Prisma rechaza el filtro.
const FILTROS_PERMITIDOS = [
  'nombre',
  'slug',
  'destacado',
  'precioDesde',
  'categorias[].categoria.slug',
  'colecciones[].coleccion.slug',
  'insignias[].insignia.slug',
  // Color y talla no son relaciones del producto: cuelgan de las variantes,
  // que es donde vive la combinación real. El alias que usa el cliente es el
  // primer segmento, así que `colores` y `tallas` se mapean a `variantes`.
  'colores:variantes[].color.nombre',
  'tallas:variantes[].talla.etiqueta',
];

// Las facetas se recalculan con cinco consultas agregadas y cambian una vez
// al día: se cachean en memoria.
const CACHE_FACETAS_MS = 5 * 60 * 1000;

@Injectable()
export class CatalogoService {
  private readonly logger = new Logger(CatalogoService.name);

  private cacheFacetas: { datos: unknown; expira: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfiguracionService,
  ) {}

  // ===================================================================================
  // Condición base de todo lo público: publicado y no eliminado.
  private get soloPublicados(): Prisma.ProductoWhereInput {
    return { estado: EstadoProducto.ACTIVO, deletedAt: null };
  }

  // ===================================================================================
  // Orden por defecto: primero los destacados, luego el orden manual y
  // finalmente los más recientes.
  private ordenPorDefecto(): Prisma.ProductoOrderByWithRelationInput[] {
    return [{ destacado: 'desc' }, { orden: 'asc' }, { createdAt: 'desc' }];
  }

  // ===================================================================================
  async listar(options: QueryOptionsDto, extra?: { busqueda?: string }) {
    try {
      const clientWhere = buildFilters<Prisma.ProductoWhereInput>(
        options.filtros,
        FILTROS_PERMITIDOS,
      );

      const condiciones: Prisma.ProductoWhereInput[] = [
        this.soloPublicados,
        clientWhere,
      ];

      // Búsqueda por texto: usa el índice FULLTEXT de MySQL en lugar de un
      // LIKE sin índice, que se arrastra con pocos cientos de productos.
      if (extra?.busqueda?.trim()) {
        condiciones.push({
          OR: [
            { nombre: { search: extra.busqueda.trim() } },
            { descripcion: { search: extra.busqueda.trim() } },
          ],
        });
      }

      const where: Prisma.ProductoWhereInput = { AND: condiciones };

      const { take, skip, orderBy } = buildPagination(options);

      const [total, productos] = await this.prisma.$transaction([
        this.prisma.producto.count({ where }),
        this.prisma.producto.findMany({
          where,
          take,
          skip,
          orderBy: orderBy ?? this.ordenPorDefecto(),
          // Listado: include ligero. La galería completa, los vídeos y la
          // descripción sólo se cargan en el detalle.
          include: CATALOGO_INCLUDE_TARJETA,
        }),
      ]);

      const ahora = new Date();

      return CoreResponse.paginated(
        'Catálogo obtenido correctamente',
        productos.map((p) => mapProductoTarjeta(p, ahora)),
        total,
        options.page ?? 1,
        resolveLimit(options),
      );
    } catch (err) {
      return handlePrismaFilterError(err);
    }
  }

  // ===================================================================================
  // Detalle por slug. Si el slug cambió, se resuelve por el histórico de
  // redirecciones en lugar de devolver 404 a los enlaces ya compartidos.
  async porSlug(slug: string, opciones: { contarVista?: boolean } = {}) {
    const producto = await this.prisma.producto.findFirst({
      where: { slug, ...this.soloPublicados },
      include: CATALOGO_INCLUDE,
    });

    if (!producto) {
      const redireccion = await this.prisma.redireccion.findUnique({
        where: { entidad_slugViejo: { entidad: 'producto', slugViejo: slug } },
        select: { slugNuevo: true },
      });

      if (redireccion) {
        return CoreResponse.success('Producto movido', {
          redirigirA: redireccion.slugNuevo,
        });
      }

      throw new NotFoundException('Producto no encontrado');
    }

    // El contador de vistas no debe retrasar la respuesta ni romperla.
    if (opciones.contarVista !== false) {
      this.prisma.producto
        .update({
          where: { id: producto.id },
          data: { vistas: { increment: 1 } },
        })
        .catch((e: Error) =>
          this.logger.warn(`No se pudo contar la vista: ${e.message}`),
        );
    }

    const datos = mapProductoCatalogo(producto);

    const ajustes = await this.config.getVarias([
      CONFIG_CLAVES.TIENDA_URL,
      CONFIG_CLAVES.TIENDA_NOMBRE,
      CONFIG_CLAVES.TIENDA_MONEDA,
    ]);

    return CoreResponse.success('Producto obtenido correctamente', {
      ...datos,
      // SEO servido desde la API: el front sólo lo inyecta en la página.
      seo: {
        titulo: producto.metaTitulo ?? producto.nombre,
        descripcion:
          producto.metaDescripcion ??
          producto.descripcion?.slice(0, 160) ??
          null,
        ogImagen: producto.ogImagen ?? datos.imagenPrincipal,
        canonica: `${ajustes[CONFIG_CLAVES.TIENDA_URL].replace(/\/+$/, '')}/producto/${producto.slug}`,
      },
      // JSON-LD de Product: es lo que hace que Google muestre el precio
      // y la disponibilidad en los resultados de búsqueda.
      jsonLd: construirJsonLdProducto(datos, {
        urlTienda: ajustes[CONFIG_CLAVES.TIENDA_URL],
        nombreTienda: ajustes[CONFIG_CLAVES.TIENDA_NOMBRE],
        moneda: ajustes[CONFIG_CLAVES.TIENDA_MONEDA],
      }),
    });
  }

  // ===================================================================================
  async porCategoria(slug: string, options: QueryOptionsDto) {
    const categoria = await this.prisma.categoria.findFirst({
      where: { slug, activo: true },
      select: {
        id: true,
        nombre: true,
        slug: true,
        metaTitulo: true,
        metaDescripcion: true,
      },
    });

    if (!categoria) throw new NotFoundException('Categoría no encontrada');

    const where: Prisma.ProductoWhereInput = {
      AND: [
        this.soloPublicados,
        { categorias: { some: { categoria_id: categoria.id } } },
      ],
    };

    const { take, skip, orderBy } = buildPagination(options);

    const [total, productos] = await this.prisma.$transaction([
      this.prisma.producto.count({ where }),
      this.prisma.producto.findMany({
        where,
        take,
        skip,
        orderBy: orderBy ?? this.ordenPorDefecto(),
        include: CATALOGO_INCLUDE_TARJETA,
      }),
    ]);

    const ahora = new Date();

    return CoreResponse.paginated(
      'Productos de la categoría obtenidos correctamente',
      productos.map((p) => mapProductoTarjeta(p, ahora)),
      total,
      options.page ?? 1,
      resolveLimit(options),
      { categoria },
    );
  }

  // ===================================================================================
  async porColeccion(slug: string, options: QueryOptionsDto) {
    const ahora = new Date();

    // La colección respeta su ventana temporal: una caducada deja de
    // mostrarse en lugar de seguir accesible.
    const coleccion = await this.prisma.coleccion.findFirst({
      where: {
        slug,
        activo: true,
        AND: [
          { OR: [{ iniciaEn: null }, { iniciaEn: { lte: ahora } }] },
          { OR: [{ terminaEn: null }, { terminaEn: { gte: ahora } }] },
        ],
      },
      select: {
        id: true,
        nombre: true,
        slug: true,
        descripcion: true,
        imagenPortada: true,
        iniciaEn: true,
        terminaEn: true,
        metaTitulo: true,
        metaDescripcion: true,
      },
    });

    if (!coleccion) {
      throw new NotFoundException('Colección no encontrada o no vigente');
    }

    const where: Prisma.ProductoWhereInput = {
      AND: [
        this.soloPublicados,
        { colecciones: { some: { coleccion_id: coleccion.id } } },
      ],
    };

    const { take, skip, orderBy } = buildPagination(options);

    const [total, productos] = await this.prisma.$transaction([
      this.prisma.producto.count({ where }),
      this.prisma.producto.findMany({
        where,
        take,
        skip,
        orderBy: orderBy ?? this.ordenPorDefecto(),
        include: CATALOGO_INCLUDE_TARJETA,
      }),
    ]);

    return CoreResponse.paginated(
      'Productos de la colección obtenidos correctamente',
      productos.map((p) => mapProductoTarjeta(p, ahora)),
      total,
      options.page ?? 1,
      resolveLimit(options),
      { coleccion },
    );
  }

  // ===================================================================================
  // Destacados para el home, en el orden manual del panel.
  async destacados(limite = 8) {
    const productos = await this.prisma.producto.findMany({
      where: { ...this.soloPublicados, destacado: true },
      take: Math.min(Math.max(limite, 1), 24),
      orderBy: [{ orden: 'asc' }, { createdAt: 'desc' }],
      include: CATALOGO_INCLUDE_TARJETA,
    });

    const ahora = new Date();

    return CoreResponse.success(
      'Productos destacados obtenidos correctamente',
      productos.map((p) => mapProductoTarjeta(p, ahora)),
    );
  }

  // ===================================================================================
  async novedades(limite = 8) {
    const productos = await this.prisma.producto.findMany({
      where: this.soloPublicados,
      take: Math.min(Math.max(limite, 1), 24),
      orderBy: { createdAt: 'desc' },
      include: CATALOGO_INCLUDE_TARJETA,
    });

    const ahora = new Date();

    return CoreResponse.success(
      'Novedades obtenidas correctamente',
      productos.map((p) => mapProductoTarjeta(p, ahora)),
    );
  }

  // ===================================================================================
  // Más consultados: se ordena por leads reales, no por vistas, porque el
  // lead es la señal de intención de compra.
  async masVendidos(limite = 8) {
    const top = await this.prisma.leadWhatsApp.groupBy({
      by: ['producto_id'],
      _count: { _all: true },
      orderBy: { _count: { producto_id: 'desc' } },
      take: Math.min(Math.max(limite, 1), 24),
    });

    if (top.length === 0) {
      // Sin historial de leads, las novedades son mejor respuesta que una
      // lista vacía en el home.
      return this.novedades(limite);
    }

    const productos = await this.prisma.producto.findMany({
      where: {
        ...this.soloPublicados,
        id: { in: top.map((t) => t.producto_id) },
      },
      include: CATALOGO_INCLUDE_TARJETA,
    });

    // Se respeta el orden del ranking, que findMany no preserva.
    const posicion = new Map(top.map((t, i) => [t.producto_id, i]));
    productos.sort(
      (a, b) => (posicion.get(a.id) ?? 999) - (posicion.get(b.id) ?? 999),
    );

    const ahora = new Date();

    return CoreResponse.success(
      'Productos más consultados obtenidos correctamente',
      productos.map((p) => mapProductoTarjeta(p, ahora)),
    );
  }

  // ===================================================================================
  // Relacionados: primero los curados a mano, y se completa con los de la
  // misma categoría hasta alcanzar el límite.
  async relacionados(slug: string, limite = 8) {
    const producto = await this.prisma.producto.findFirst({
      where: { slug, ...this.soloPublicados },
      select: {
        id: true,
        categorias: { select: { categoria_id: true } },
        relacionadosDe: {
          orderBy: { orden: 'asc' },
          select: { relacionado_id: true },
        },
      },
    });

    if (!producto) throw new NotFoundException('Producto no encontrado');

    const tope = Math.min(Math.max(limite, 1), 24);
    const curadosIds = producto.relacionadosDe.map((r) => r.relacionado_id);

    const curados =
      curadosIds.length > 0
        ? await this.prisma.producto.findMany({
            where: { ...this.soloPublicados, id: { in: curadosIds } },
            include: CATALOGO_INCLUDE_TARJETA,
          })
        : [];

    // Se preserva el orden elegido en el panel.
    const posicion = new Map(curadosIds.map((id, i) => [id, i]));
    curados.sort(
      (a, b) => (posicion.get(a.id) ?? 999) - (posicion.get(b.id) ?? 999),
    );

    const faltan = tope - curados.length;
    const categoriaIds = producto.categorias.map((c) => c.categoria_id);

    const automaticos =
      faltan > 0
        ? await this.prisma.producto.findMany({
            where: {
              ...this.soloPublicados,
              id: { notIn: [producto.id, ...curadosIds] },
              ...(categoriaIds.length > 0
                ? {
                    categorias: {
                      some: { categoria_id: { in: categoriaIds } },
                    },
                  }
                : {}),
            },
            take: faltan,
            orderBy: [{ destacado: 'desc' }, { createdAt: 'desc' }],
            include: CATALOGO_INCLUDE_TARJETA,
          })
        : [];

    const ahora = new Date();

    return CoreResponse.success(
      'Productos relacionados obtenidos correctamente',
      [...curados, ...automaticos].map((p) => mapProductoTarjeta(p, ahora)),
    );
  }

  // ===================================================================================
  async facetas() {
    if (this.cacheFacetas && Date.now() < this.cacheFacetas.expira) {
      return CoreResponse.success(
        'Facetas obtenidas correctamente',
        this.cacheFacetas.datos,
      );
    }

    const ahora = new Date();
    const productoPublicado = { producto: this.soloPublicados };

    const [categorias, colecciones, insignias, colores, tallas, rango] =
      await this.prisma.$transaction([
        this.prisma.categoria.findMany({
          where: { activo: true, productos: { some: productoPublicado } },
          select: {
            id: true,
            nombre: true,
            slug: true,
            _count: { select: { productos: true } },
          },
          orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        }),
        this.prisma.coleccion.findMany({
          where: {
            activo: true,
            productos: { some: productoPublicado },
            AND: [
              { OR: [{ iniciaEn: null }, { iniciaEn: { lte: ahora } }] },
              { OR: [{ terminaEn: null }, { terminaEn: { gte: ahora } }] },
            ],
          },
          select: {
            id: true,
            nombre: true,
            slug: true,
            imagenPortada: true,
            destacada: true,
            _count: { select: { productos: true } },
          },
          orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        }),
        this.prisma.insignia.findMany({
          where: { activo: true, productos: { some: productoPublicado } },
          select: {
            id: true,
            nombre: true,
            slug: true,
            color: true,
            _count: { select: { productos: true } },
          },
          orderBy: { nombre: 'asc' },
        }),
        this.prisma.color.findMany({
          where: {
            activo: true,
            variantes: { some: { activo: true, ...productoPublicado } },
          },
          select: { id: true, nombre: true, hex: true },
          orderBy: { nombre: 'asc' },
        }),
        this.prisma.talla.findMany({
          where: {
            activo: true,
            variantes: { some: { activo: true, ...productoPublicado } },
          },
          select: { id: true, etiqueta: true },
          orderBy: { id: 'asc' },
        }),
        // Rango real de precios, para acotar el control deslizante del front.
        this.prisma.producto.aggregate({
          where: { ...this.soloPublicados, precioDesde: { not: null } },
          _min: { precioDesde: true },
          _max: { precioDesde: true },
        }),
      ]);

    // Conteo por color y talla: cuenta PRODUCTOS distintos, no variantes.
    // Un producto con cinco tallas en negro es un producto, no cinco, así
    // que `_count` sobre la relación daría un número inflado.
    const [porColor, porTalla] = await Promise.all([
      this.prisma.varianteProducto.groupBy({
        by: ['color_id', 'producto_id'],
        where: { activo: true, ...productoPublicado },
      }),
      this.prisma.varianteProducto.groupBy({
        by: ['talla_id', 'producto_id'],
        where: { activo: true, ...productoPublicado },
      }),
    ]);

    const conteoColor = new Map<number, number>();
    for (const fila of porColor) {
      conteoColor.set(fila.color_id, (conteoColor.get(fila.color_id) ?? 0) + 1);
    }

    const conteoTalla = new Map<number, number>();
    for (const fila of porTalla) {
      conteoTalla.set(fila.talla_id, (conteoTalla.get(fila.talla_id) ?? 0) + 1);
    }

    const datos = {
      categorias: categorias.map(({ _count, ...c }) => ({
        ...c,
        productos: _count.productos,
      })),
      colecciones: colecciones.map(({ _count, ...c }) => ({
        ...c,
        productos: _count.productos,
      })),
      insignias: insignias.map(({ _count, ...i }) => ({
        ...i,
        productos: _count.productos,
      })),
      colores: colores.map((c) => ({
        ...c,
        productos: conteoColor.get(c.id) ?? 0,
      })),
      tallas: tallas.map((t) => ({
        ...t,
        productos: conteoTalla.get(t.id) ?? 0,
      })),
      precio: {
        min: rango._min.precioDesde ? Number(rango._min.precioDesde) : 0,
        max: rango._max.precioDesde ? Number(rango._max.precioDesde) : 0,
      },
    };

    this.cacheFacetas = { datos, expira: Date.now() + CACHE_FACETAS_MS };

    return CoreResponse.success('Facetas obtenidas correctamente', datos);
  }

  // ===================================================================================
  // Invalida la caché de facetas. Lo llaman los servicios de escritura.
  invalidarFacetas() {
    this.cacheFacetas = null;
  }

  // ===================================================================================
  async guiaTallas(slug: string) {
    const producto = await this.prisma.producto.findFirst({
      where: { slug, ...this.soloPublicados },
      select: {
        id: true,
        guiaTallas: true,
        categorias: {
          select: {
            categoria: {
              select: { guiaTallas: { take: 1 } },
            },
          },
        },
      },
    });

    if (!producto) throw new NotFoundException('Producto no encontrado');

    // La guía propia del producto gana sobre la de su categoría.
    const guia =
      producto.guiaTallas ??
      producto.categorias.flatMap((c) => c.categoria.guiaTallas)[0] ??
      null;

    if (!guia) {
      return CoreResponse.success(
        'Este producto no tiene guía de tallas',
        null,
      );
    }

    // El alta valida la forma, pero una guía escrita antes de esa validación
    // (o por otra vía) podría no cumplirla. Se comprueba al leer para que el
    // front reciba una tabla utilizable o `null`, nunca algo a medias que
    // rompa el render.
    const datos = parsearTablaGuia(guia.datos);

    if (!datos) {
      this.logger.warn(
        `La guía de tallas ${guia.id} tiene datos con forma inválida`,
      );
    }

    return CoreResponse.success('Guía de tallas obtenida correctamente', {
      id: guia.id,
      nombre: guia.nombre,
      nota: guia.nota,
      // Ya parseado y comprobado: el front no tiene que validar de nuevo.
      datos,
    });
  }

  // ===================================================================================
  async sitemap() {
    const [productos, categorias, colecciones] = await this.prisma.$transaction(
      [
        this.prisma.producto.findMany({
          where: this.soloPublicados,
          select: { slug: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
        }),
        this.prisma.categoria.findMany({
          where: { activo: true },
          select: { slug: true, updatedAt: true },
        }),
        this.prisma.coleccion.findMany({
          where: { activo: true },
          select: { slug: true, updatedAt: true },
        }),
      ],
    );

    const urlTienda = (await this.config.get(CONFIG_CLAVES.TIENDA_URL)).replace(
      /\/+$/,
      '',
    );

    return CoreResponse.success('Sitemap obtenido correctamente', {
      urlBase: urlTienda,
      productos,
      categorias,
      colecciones,
    });
  }
}
