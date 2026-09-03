//* src/modules/producto-admin/exportacion.service.ts

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EstadoProducto, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CoreResponse } from 'src/common/utils/response.util';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { CONFIG_CLAVES } from '../configuracion/configuracion.constants';
import { MantenimientoService } from '../mantenimiento/mantenimiento.service';
import { calcularPrecioEfectivo } from '../producto/utils/precio.util';
import { aBooleano, aNumero, generarCsv, parsearCsv } from './utils/csv.util';

// ===================================================================================
// Importación y exportación en CSV, y feed de producto para Google Merchant
// y el catálogo de Instagram y WhatsApp Business.
// ===================================================================================

// Una fila por variante: es el grano que necesitan tanto el CSV de trabajo
// como los feeds de publicidad.
const COLUMNAS_CSV = [
  'producto_id',
  'nombre',
  'slug',
  'descripcion',
  'estado',
  'destacado',
  'precioBase',
  'talla',
  'color',
  'sku',
  'precioVariante',
  'stock',
  'activo',
  'categorias',
  'colecciones',
  'insignias',
];

@Injectable()
export class ExportacionService {
  private readonly logger = new Logger(ExportacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfiguracionService,
    private readonly mantenimiento: MantenimientoService,
  ) {}

  // ===================================================================================
  async exportarCsv(): Promise<string> {
    const productos = await this.prisma.producto.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
      include: {
        variantes: {
          include: { talla: true, color: true },
          orderBy: [{ color_id: 'asc' }, { talla_id: 'asc' }],
        },
        categorias: { include: { categoria: true } },
        colecciones: { include: { coleccion: true } },
        insignias: { include: { insignia: true } },
      },
    });

    const filas: unknown[][] = [];

    for (const p of productos) {
      const categorias = p.categorias.map((c) => c.categoria.slug).join('|');
      const colecciones = p.colecciones.map((c) => c.coleccion.slug).join('|');
      const insignias = p.insignias.map((i) => i.insignia.slug).join('|');

      const comunes = [
        p.id,
        p.nombre,
        p.slug,
        p.descripcion ?? '',
        p.estado,
        p.destacado ? '1' : '0',
        p.precioBase != null ? Number(p.precioBase) : '',
      ];

      // Un producto sin variantes ocupa igualmente una fila, para que al
      // reimportar no desaparezca.
      if (p.variantes.length === 0) {
        filas.push([
          ...comunes,
          '',
          '',
          '',
          '',
          '',
          '',
          categorias,
          colecciones,
          insignias,
        ]);
        continue;
      }

      for (const v of p.variantes) {
        filas.push([
          ...comunes,
          v.talla.etiqueta,
          v.color.nombre,
          v.sku ?? '',
          v.precio != null ? Number(v.precio) : '',
          v.stock ?? '',
          v.activo ? '1' : '0',
          categorias,
          colecciones,
          insignias,
        ]);
      }
    }

    return generarCsv(COLUMNAS_CSV, filas);
  }

  // ===================================================================================
  // Importación. `simular` permite validar el archivo antes de escribir.
  async importarCsv(contenido: string, simular = true) {
    const { columnas, filas } = parsearCsv(contenido);

    if (filas.length === 0) {
      throw new BadRequestException('El archivo no tiene filas de datos');
    }

    const obligatorias = ['nombre', 'slug'];
    const faltan = obligatorias.filter((c) => !columnas.includes(c));

    if (faltan.length > 0) {
      throw new BadRequestException({
        message: 'Faltan columnas obligatorias en el CSV.',
        faltan,
        recibidas: columnas,
      });
    }

    // Catálogos de referencia, para traducir etiquetas a identificadores.
    const [tallas, colores] = await Promise.all([
      this.prisma.talla.findMany({ select: { id: true, etiqueta: true } }),
      this.prisma.color.findMany({ select: { id: true, nombre: true } }),
    ]);

    const tallaPorEtiqueta = new Map(
      tallas.map((t) => [t.etiqueta.toLowerCase(), t.id]),
    );
    const colorPorNombre = new Map(
      colores.map((c) => [c.nombre.toLowerCase(), c.id]),
    );

    // Las filas del mismo slug se agrupan: cada una es una variante.
    const porSlug = new Map<string, Record<string, string>[]>();

    for (const fila of filas) {
      const slug = fila.slug?.trim();
      if (!slug) continue;

      const grupo = porSlug.get(slug) ?? [];
      grupo.push(fila);
      porSlug.set(slug, grupo);
    }

    const errores: { slug: string; motivo: string }[] = [];
    const resumen = { creados: 0, actualizados: 0, variantes: 0 };

    for (const [slug, grupo] of porSlug) {
      const tallasFaltan = grupo
        .filter((f) => f.talla?.trim())
        .filter((f) => !tallaPorEtiqueta.has(f.talla.trim().toLowerCase()))
        .map((f) => f.talla);

      const coloresFaltan = grupo
        .filter((f) => f.color?.trim())
        .filter((f) => !colorPorNombre.has(f.color.trim().toLowerCase()))
        .map((f) => f.color);

      if (tallasFaltan.length > 0 || coloresFaltan.length > 0) {
        errores.push({
          slug,
          motivo:
            `Referencias inexistentes. Tallas: ${[...new Set(tallasFaltan)].join(', ') || 'ninguna'}. ` +
            `Colores: ${[...new Set(coloresFaltan)].join(', ') || 'ninguno'}.`,
        });
        continue;
      }

      if (simular) {
        const existe = await this.prisma.producto.findUnique({
          where: { slug },
          select: { id: true },
        });

        if (existe) resumen.actualizados++;
        else resumen.creados++;

        resumen.variantes += grupo.filter((f) => f.talla?.trim()).length;
        continue;
      }

      try {
        await this.importarUno(slug, grupo, {
          tallaPorEtiqueta,
          colorPorNombre,
        });

        const existia = await this.prisma.producto.findUnique({
          where: { slug },
          select: { createdAt: true, updatedAt: true },
        });

        // Si createdAt y updatedAt difieren, el producto ya existía.
        if (
          existia &&
          existia.createdAt.getTime() !== existia.updatedAt.getTime()
        ) {
          resumen.actualizados++;
        } else {
          resumen.creados++;
        }

        resumen.variantes += grupo.filter((f) => f.talla?.trim()).length;
      } catch (e) {
        errores.push({ slug, motivo: (e as Error).message });
      }
    }

    const mensaje = simular
      ? 'Simulación completada. Repite con simular=false para aplicar.'
      : 'Importación completada';

    return CoreResponse.success(mensaje, {
      simulado: simular,
      filasLeidas: filas.length,
      productos: porSlug.size,
      ...resumen,
      errores,
    });
  }

  // ===================================================================================
  private async importarUno(
    slug: string,
    grupo: Record<string, string>[],
    catalogos: {
      tallaPorEtiqueta: Map<string, number>;
      colorPorNombre: Map<string, number>;
    },
  ) {
    const primera = grupo[0];

    const estado = ['ACTIVO', 'OCULTO', 'ARCHIVADO'].includes(
      primera.estado?.trim().toUpperCase(),
    )
      ? (primera.estado.trim().toUpperCase() as EstadoProducto)
      : EstadoProducto.ACTIVO;

    const precioBase = aNumero(primera.precioBase ?? '');

    const producto = await this.prisma.producto.upsert({
      where: { slug },
      update: {
        nombre: primera.nombre.trim(),
        descripcion: primera.descripcion?.trim() || null,
        estado,
        destacado: aBooleano(primera.destacado ?? '', false),
        ...(precioBase !== null
          ? { precioBase: new Prisma.Decimal(precioBase) }
          : {}),
      },
      create: {
        slug,
        nombre: primera.nombre.trim(),
        descripcion: primera.descripcion?.trim() || null,
        estado,
        destacado: aBooleano(primera.destacado ?? '', false),
        precioBase: precioBase !== null ? new Prisma.Decimal(precioBase) : null,
      },
      select: { id: true },
    });

    // Variantes: se crean o actualizan por (talla, color), sin borrar las
    // que no aparezcan en el archivo. Borrarlas destruiría stock y SKU de
    // quien exporte sólo una parte del catálogo.
    for (const fila of grupo) {
      const etiquetaTalla = fila.talla?.trim();
      const nombreColor = fila.color?.trim();

      if (!etiquetaTalla || !nombreColor) continue;

      const talla_id = catalogos.tallaPorEtiqueta.get(
        etiquetaTalla.toLowerCase(),
      )!;
      const color_id = catalogos.colorPorNombre.get(nombreColor.toLowerCase())!;

      const precio = aNumero(fila.precioVariante ?? '');
      const stock = aNumero(fila.stock ?? '');

      await this.prisma.varianteProducto.upsert({
        where: {
          producto_id_talla_id_color_id: {
            producto_id: producto.id,
            talla_id,
            color_id,
          },
        },
        update: {
          sku: fila.sku?.trim() || null,
          precio: precio !== null ? new Prisma.Decimal(precio) : null,
          stock: stock !== null ? Math.round(stock) : null,
          activo: aBooleano(fila.activo ?? ''),
        },
        create: {
          producto_id: producto.id,
          talla_id,
          color_id,
          sku: fila.sku?.trim() || null,
          precio: precio !== null ? new Prisma.Decimal(precio) : null,
          stock: stock !== null ? Math.round(stock) : null,
          activo: aBooleano(fila.activo ?? ''),
        },
      });
    }

    await this.conectarPorSlugs(producto.id, primera);
    await this.mantenimiento.recalcularPrecioDesde(producto.id);
  }

  // ===================================================================================
  // Las relaciones vienen como slugs separados por "|". Se ignoran los que
  // no existan en lugar de fallar toda la fila.
  private async conectarPorSlugs(
    productoId: number,
    fila: Record<string, string>,
  ) {
    const partir = (v?: string) =>
      (v ?? '')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);

    const [categorias, colecciones, insignias] = await Promise.all([
      this.prisma.categoria.findMany({
        where: { slug: { in: partir(fila.categorias) } },
        select: { id: true },
      }),
      this.prisma.coleccion.findMany({
        where: { slug: { in: partir(fila.colecciones) } },
        select: { id: true },
      }),
      this.prisma.insignia.findMany({
        where: { slug: { in: partir(fila.insignias) } },
        select: { id: true },
      }),
    ]);

    await this.prisma.$transaction([
      ...(categorias.length > 0
        ? [
            this.prisma.productoCategoria.createMany({
              data: categorias.map((c) => ({
                producto_id: productoId,
                categoria_id: c.id,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
      ...(colecciones.length > 0
        ? [
            this.prisma.productoColeccion.createMany({
              data: colecciones.map((c) => ({
                producto_id: productoId,
                coleccion_id: c.id,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
      ...(insignias.length > 0
        ? [
            this.prisma.productoInsignia.createMany({
              data: insignias.map((i) => ({
                producto_id: productoId,
                insignia_id: i.id,
              })),
              skipDuplicates: true,
            }),
          ]
        : []),
    ]);
  }

  // ===================================================================================
  // Feed para Google Merchant, catálogo de Instagram y WhatsApp Business.
  // Una fila por variante, con los nombres de campo que espera Google.
  async feedMerchant(formato: 'csv' | 'xml' = 'csv'): Promise<string> {
    const ajustes = await this.config.getVarias([
      CONFIG_CLAVES.TIENDA_URL,
      CONFIG_CLAVES.TIENDA_NOMBRE,
      CONFIG_CLAVES.TIENDA_MONEDA,
    ]);

    const urlBase = ajustes[CONFIG_CLAVES.TIENDA_URL].replace(/\/+$/, '');
    const moneda = ajustes[CONFIG_CLAVES.TIENDA_MONEDA];
    const tienda = ajustes[CONFIG_CLAVES.TIENDA_NOMBRE];

    const productos = await this.prisma.producto.findMany({
      where: { estado: EstadoProducto.ACTIVO, deletedAt: null },
      include: {
        precio: true,
        imagenes: {
          orderBy: [{ orden: 'asc' }, { id: 'asc' }],
        },
        variantes: {
          where: { activo: true },
          include: { talla: true, color: true },
        },
        categorias: { include: { categoria: true } },
      },
    });

    const ahora = new Date();
    const items: Record<string, string>[] = [];

    for (const p of productos) {
      const categoria = p.categorias[0]?.categoria.nombre ?? '';

      // Se prefiere la imagen del color de la variante; si no hay, la
      // principal del producto.
      const imagenGeneral =
        p.imagenes.find((i) => i.esPrincipal && i.color_id === null)?.url ??
        p.imagenes.find((i) => i.esPrincipal)?.url ??
        p.imagenes[0]?.url ??
        '';

      const descripcion = (p.descripcion ?? p.nombre)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 5000);

      if (p.variantes.length === 0) {
        const precio = calcularPrecioEfectivo({
          precioBase: p.precioBase,
          precio: p.precio,
          ahora,
        });

        items.push({
          id: `P${p.id}`,
          title: p.nombre.slice(0, 150),
          description: descripcion,
          link: `${urlBase}/producto/${p.slug}`,
          image_link: imagenGeneral,
          availability: 'in stock',
          price: `${precio.precio.toFixed(2)} ${moneda}`,
          brand: tienda,
          condition: 'new',
          ...(categoria ? { product_type: categoria } : {}),
        });
        continue;
      }

      for (const v of p.variantes) {
        const precio = calcularPrecioEfectivo({
          precioBase: p.precioBase,
          precio: p.precio,
          precioVariante: v.precio,
          ahora,
        });

        const imagenColor =
          p.imagenes.find((i) => i.color_id === v.color_id && i.esPrincipal)
            ?.url ??
          p.imagenes.find((i) => i.color_id === v.color_id)?.url ??
          imagenGeneral;

        const disponible = v.stock === null || v.stock > 0;

        items.push({
          id: v.sku?.trim() || `P${p.id}V${v.id}`,
          item_group_id: `P${p.id}`,
          title: `${p.nombre} - ${v.color.nombre} / ${v.talla.etiqueta}`.slice(
            0,
            150,
          ),
          description: descripcion,
          link: `${urlBase}/producto/${p.slug}`,
          image_link: imagenColor,
          availability: disponible ? 'in stock' : 'out of stock',
          price: `${(precio.precioAnterior ?? precio.precio).toFixed(2)} ${moneda}`,
          ...(precio.enOferta
            ? { sale_price: `${precio.precio.toFixed(2)} ${moneda}` }
            : {}),
          brand: tienda,
          condition: 'new',
          size: v.talla.etiqueta,
          color: v.color.nombre,
          ...(categoria ? { product_type: categoria } : {}),
        });
      }
    }

    if (formato === 'xml') return this.feedXml(items, tienda, urlBase);

    // Todas las claves que aparecen en algún item, para que ninguna fila
    // pierda columnas.
    const columnas = [...new Set(items.flatMap((i) => Object.keys(i)))];

    return generarCsv(
      columnas,
      items.map((i) => columnas.map((c) => i[c] ?? '')),
    );
  }

  // ===================================================================================
  private feedXml(
    items: Record<string, string>[],
    tienda: string,
    urlBase: string,
  ): string {
    const esc = (t: string) =>
      t
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const entradas = items
      .map((item) => {
        const campos = Object.entries(item)
          .map(
            ([clave, valor]) => `      <g:${clave}>${esc(valor)}</g:${clave}>`,
          )
          .join('\n');

        return `    <item>\n${campos}\n    </item>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${esc(tienda)}</title>
    <link>${esc(urlBase)}</link>
    <description>Catálogo de productos</description>
${entradas}
  </channel>
</rss>`;
  }
}
