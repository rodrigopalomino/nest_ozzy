//* src/modules/producto/utils/catalogo.mapper.ts

import { EstadoProducto, PlataformaVideo, Prisma } from '@prisma/client';
import {
  calcularPrecioEfectivo,
  estaAgotado,
  PrecioEfectivo,
  toNumber,
} from './precio.util';

// ===================================================================================
// Forma en que el catálogo público expone un producto.
//
// El front recibe todo resuelto: precio ya calculado, imágenes agrupadas por
// color y disponibilidad marcada. No necesita conocer PrecioProducto ni la
// tabla pivote de imágenes.
// ===================================================================================

export interface ImagenSalida {
  id: number;
  url: string;
  alt: string | null;
  orden: number;
  esPrincipal: boolean;
  esHover: boolean;

  // Miniaturas WebP y metadatos para next/image. Cuando la imagen se subió
  // antes del procesamiento, las variantes son null y el front usa `url`.
  urlSm: string | null;
  urlMd: string | null;
  urlLg: string | null;
  ancho: number | null;
  alto: number | null;
  blurData: string | null;
}

export interface TallaSalida {
  id: number;
  etiqueta: string;
  variante_id: number;
  sku: string | null;
  stock: number | null;
  agotado: boolean;
  precio: PrecioEfectivo;
}

// Un color del producto: sus imágenes propias y las tallas disponibles en él.
export interface ColorSalida {
  id: number;
  nombre: string;
  hex: string | null;
  imagenes: ImagenSalida[];
  imagenPrincipal: string | null;
  imagenHover: string | null;
  tallas: TallaSalida[];
  agotado: boolean;
  desde: PrecioEfectivo | null;
}

export interface ProductoCatalogoSalida {
  id: number;
  nombre: string;
  slug: string;
  descripcion: string | null;
  estado: EstadoProducto;
  destacado: boolean;

  // Precio de referencia del producto (el más bajo entre sus variantes).
  precio: PrecioEfectivo;
  agotado: boolean;

  // Galería genérica: imágenes sin color asignado.
  imagenes: ImagenSalida[];
  imagenPrincipal: string | null;
  imagenHover: string | null;

  colores: ColorSalida[];

  videos: {
    id: number;
    plataforma: PlataformaVideo;
    url: string;
    etiqueta: string | null;
    orden: number;
  }[];

  categorias: { id: number; nombre: string; slug: string }[];
  colecciones: { id: number; nombre: string; slug: string }[];
  insignias: {
    id: number;
    nombre: string;
    slug: string;
    color: string | null;
  }[];

  createdAt: Date;
  updatedAt: Date;
}

// ===================================================================================
// `include` que necesita el mapper. Se usa tanto en listado como en detalle
// para que ambos devuelvan exactamente la misma forma.
export const CATALOGO_INCLUDE = Prisma.validator<Prisma.ProductoInclude>()({
  precio: true,
  imagenes: {
    orderBy: [{ orden: 'asc' }, { id: 'asc' }],
    include: { color: true },
  },
  videos: { orderBy: [{ orden: 'asc' }, { id: 'asc' }] },
  variantes: {
    include: { talla: true, color: true },
    orderBy: [{ color_id: 'asc' }, { talla_id: 'asc' }],
  },
  categorias: { include: { categoria: true } },
  colecciones: { include: { coleccion: true } },
  insignias: { include: { insignia: true } },
});

// Tipo del producto tal como lo devuelve Prisma con CATALOGO_INCLUDE.
export type ProductoConCatalogo = Prisma.ProductoGetPayload<{
  include: typeof CATALOGO_INCLUDE;
}>;

// ===================================================================================
// Variante ligera del include, para el listado del catálogo.
//
// Una tarjeta sólo pinta nombre, precio, foto de portada, puntos de color e
// insignias. Traer además la descripción completa, los vídeos, las
// categorías y las colecciones de veinte productos mueve varias veces más
// datos de los que la vista usa.
export const CATALOGO_INCLUDE_TARJETA =
  Prisma.validator<Prisma.ProductoInclude>()({
    precio: true,
    imagenes: {
      // Sólo las portadas y las imágenes de hover: la galería completa se
      // carga al abrir el detalle.
      where: { OR: [{ esPrincipal: true }, { esHover: true }] },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        url: true,
        urlSm: true,
        urlMd: true,
        urlLg: true,
        ancho: true,
        alto: true,
        blurData: true,
        alt: true,
        orden: true,
        esPrincipal: true,
        esHover: true,
        color_id: true,
      },
    },
    variantes: {
      where: { activo: true },
      orderBy: [{ color_id: 'asc' }, { talla_id: 'asc' }],
      select: {
        id: true,
        precio: true,
        stock: true,
        talla: { select: { id: true, etiqueta: true, activo: true } },
        color: {
          select: { id: true, nombre: true, hex: true, activo: true },
        },
      },
    },
    insignias: {
      select: {
        insignia: {
          select: { id: true, nombre: true, slug: true, color: true },
        },
      },
    },
    // Sólo la categoría principal, para el chip y el breadcrumb de la
    // grilla: sin esto el front necesitaba una llamada por tarjeta.
    categorias: {
      take: 1,
      orderBy: { categoria: { orden: 'asc' } },
      select: { categoria: { select: { id: true, nombre: true, slug: true } } },
    },
  });

export type ProductoConTarjeta = Prisma.ProductoGetPayload<{
  include: typeof CATALOGO_INCLUDE_TARJETA;
}>;

// ===================================================================================

// ===================================================================================
// Se tipa por los campos que usa, no por el include: así sirve tanto para
// el detalle (que trae la relación color) como para la tarjeta (que no).
type ImagenMapeable = {
  id: number;
  url: string;
  alt: string | null;
  orden: number;
  esPrincipal: boolean;
  esHover: boolean;
  urlSm: string | null;
  urlMd: string | null;
  urlLg: string | null;
  ancho: number | null;
  alto: number | null;
  blurData: string | null;
};

function mapImagen(img: ImagenMapeable): ImagenSalida {
  return {
    id: img.id,
    url: img.url,
    alt: img.alt,
    orden: img.orden,
    esPrincipal: img.esPrincipal,
    esHover: img.esHover,
    urlSm: img.urlSm,
    urlMd: img.urlMd,
    urlLg: img.urlLg,
    ancho: img.ancho,
    alto: img.alto,
    blurData: img.blurData,
  };
}

// ===================================================================================
// El precio más bajo de una lista, para el "desde S/ X" de las tarjetas.
function precioMinimo(precios: PrecioEfectivo[]): PrecioEfectivo | null {
  if (precios.length === 0) return null;

  return precios.reduce((min, p) => (p.precio < min.precio ? p : min));
}

// ===================================================================================
export function mapProductoCatalogo(
  producto: ProductoConCatalogo,
  ahora: Date = new Date(),
): ProductoCatalogoSalida {
  // Sólo variantes activas con talla y color activos llegan al catálogo.
  const variantesVisibles = producto.variantes.filter(
    (v) => v.activo && v.talla.activo && v.color.activo,
  );

  const preciosVariante = new Map<number, PrecioEfectivo>();

  for (const v of variantesVisibles) {
    preciosVariante.set(
      v.id,
      calcularPrecioEfectivo({
        precioBase: producto.precioBase as never,
        precio: producto.precio as never,
        precioVariante: v.precio as never,
        ahora,
      }),
    );
  }

  // ===================================================================================
  // Imágenes: las que no tienen color son la galería genérica del producto.
  const genericas = producto.imagenes.filter((i) => i.color_id === null);

  const porColor = new Map<number, typeof producto.imagenes>();
  for (const img of producto.imagenes) {
    if (img.color_id === null) continue;
    const lista = porColor.get(img.color_id) ?? [];
    lista.push(img);
    porColor.set(img.color_id, lista);
  }

  // ===================================================================================
  // Colores: se derivan de las variantes, en el orden en que aparecen.
  const coloresMap = new Map<number, ColorSalida>();

  for (const v of variantesVisibles) {
    let color = coloresMap.get(v.color.id);

    if (!color) {
      const imgs = (porColor.get(v.color.id) ?? []).map(mapImagen);

      // Si el color no tiene fotos propias, hereda la galería genérica.
      const galeria = imgs.length > 0 ? imgs : genericas.map(mapImagen);

      color = {
        id: v.color.id,
        nombre: v.color.nombre,
        hex: v.color.hex,
        imagenes: galeria,
        imagenPrincipal:
          galeria.find((i) => i.esPrincipal)?.url ?? galeria[0]?.url ?? null,
        imagenHover: galeria.find((i) => i.esHover)?.url ?? null,
        tallas: [],
        agotado: true,
        desde: null,
      };

      coloresMap.set(v.color.id, color);
    }

    const agotado = estaAgotado(v.stock);
    const precio = preciosVariante.get(v.id)!;

    color.tallas.push({
      id: v.talla.id,
      etiqueta: v.talla.etiqueta,
      variante_id: v.id,
      sku: v.sku,
      stock: v.stock,
      agotado,
      precio,
    });
  }

  // Resumen por color: agotado sólo si TODAS sus tallas lo están.
  for (const color of coloresMap.values()) {
    color.agotado = color.tallas.every((t) => t.agotado);
    color.desde = precioMinimo(color.tallas.map((t) => t.precio));
  }

  const colores = [...coloresMap.values()];

  // ===================================================================================
  // Galería de la tarjeta del catálogo: las imágenes genéricas si existen;
  // si no, las del primer color, para que la portada sea determinista y no
  // mezcle fotos de colores distintos.
  const galeriaProducto =
    genericas.length > 0
      ? genericas.map(mapImagen)
      : (colores[0]?.imagenes ?? producto.imagenes.map(mapImagen));

  const imagenesProducto = galeriaProducto;

  // Precio del producto: el más bajo entre sus variantes; si no tiene
  // variantes, el precio del producto a secas.
  const precioProducto =
    precioMinimo([...preciosVariante.values()]) ??
    calcularPrecioEfectivo({
      precioBase: producto.precioBase as never,
      precio: producto.precio as never,
      ahora,
    });

  return {
    id: producto.id,
    nombre: producto.nombre,
    slug: producto.slug,
    descripcion: producto.descripcion,
    estado: producto.estado,
    destacado: producto.destacado,

    precio: precioProducto,
    // Sin variantes no hay control de stock: se considera disponible.
    agotado: colores.length > 0 && colores.every((c) => c.agotado),

    imagenes: imagenesProducto,
    imagenPrincipal:
      imagenesProducto.find((i) => i.esPrincipal)?.url ??
      imagenesProducto[0]?.url ??
      null,
    imagenHover: imagenesProducto.find((i) => i.esHover)?.url ?? null,

    colores,

    videos: producto.videos.map((v) => ({
      id: v.id,
      plataforma: v.plataforma,
      url: v.url,
      etiqueta: v.etiqueta,
      orden: v.orden,
    })),

    categorias: producto.categorias.map((c) => c.categoria),
    colecciones: producto.colecciones.map((c) => c.coleccion),
    insignias: producto.insignias.map((i) => i.insignia),

    createdAt: producto.createdAt,
    updatedAt: producto.updatedAt,
  };
}

// ===================================================================================
// ===================================================================================
// Forma reducida para las tarjetas del listado.
//
// Es un subconjunto de ProductoCatalogoSalida: el front puede tipar la
// tarjeta con esta interfaz y el detalle con la completa, sin ramas.
export interface ColorTarjetaSalida {
  id: number;
  nombre: string;
  hex: string | null;
  imagenPrincipal: string | null;
  imagenHover: string | null;
  agotado: boolean;
  desde: PrecioEfectivo | null;
}

export interface ProductoTarjetaSalida {
  id: number;
  nombre: string;
  slug: string;
  destacado: boolean;

  precio: PrecioEfectivo;
  agotado: boolean;

  // Sólo la portada y el hover, no la galería entera.
  imagenPrincipal: ImagenSalida | null;
  imagenHover: ImagenSalida | null;

  colores: ColorTarjetaSalida[];

  insignias: {
    id: number;
    nombre: string;
    slug: string;
    color: string | null;
  }[];

  // Categoría principal, para el chip y el breadcrumb. Null si el producto
  // no tiene ninguna asignada.
  categoria: { id: number; nombre: string; slug: string } | null;
}

// ===================================================================================
export function mapProductoTarjeta(
  producto: ProductoConTarjeta,
  ahora: Date = new Date(),
): ProductoTarjetaSalida {
  // Mismas reglas de visibilidad que en el detalle: una variante con talla
  // o color desactivados no cuenta.
  const variantesVisibles = producto.variantes.filter(
    (v) => v.talla.activo && v.color.activo,
  );

  const preciosVariante = new Map<number, PrecioEfectivo>();

  for (const v of variantesVisibles) {
    preciosVariante.set(
      v.id,
      calcularPrecioEfectivo({
        precioBase: producto.precioBase,
        precio: producto.precio,
        precioVariante: v.precio,
        ahora,
      }),
    );
  }

  // ===================================================================================
  const genericas = producto.imagenes.filter((i) => i.color_id === null);

  const porColor = new Map<number, typeof producto.imagenes>();
  for (const img of producto.imagenes) {
    if (img.color_id === null) continue;
    const lista = porColor.get(img.color_id) ?? [];
    lista.push(img);
    porColor.set(img.color_id, lista);
  }

  // ===================================================================================
  // Un color por variante, con su portada y su disponibilidad agregada.
  const coloresMap = new Map<
    number,
    ColorTarjetaSalida & { precios: PrecioEfectivo[]; agotadas: boolean[] }
  >();

  for (const v of variantesVisibles) {
    let color = coloresMap.get(v.color.id);

    if (!color) {
      const propias = porColor.get(v.color.id) ?? [];
      const galeria = propias.length > 0 ? propias : genericas;

      color = {
        id: v.color.id,
        nombre: v.color.nombre,
        hex: v.color.hex,
        imagenPrincipal:
          galeria.find((i) => i.esPrincipal)?.url ?? galeria[0]?.url ?? null,
        imagenHover: galeria.find((i) => i.esHover)?.url ?? null,
        agotado: true,
        desde: null,
        precios: [],
        agotadas: [],
      };

      coloresMap.set(v.color.id, color);
    }

    color.precios.push(preciosVariante.get(v.id)!);
    color.agotadas.push(estaAgotado(v.stock));
  }

  const colores: ColorTarjetaSalida[] = [...coloresMap.values()].map(
    ({ precios, agotadas, ...color }) => ({
      ...color,
      // Un color está agotado sólo si lo están todas sus tallas.
      agotado: agotadas.every(Boolean),
      desde: precioMinimo(precios),
    }),
  );

  // ===================================================================================
  // Portada del producto: las genéricas si existen, y si no las del primer
  // color, para que la tarjeta no mezcle fotos de colores distintos.
  const galeriaPortada =
    genericas.length > 0
      ? genericas
      : (porColor.get(colores[0]?.id ?? -1) ?? producto.imagenes);

  const principal =
    galeriaPortada.find((i) => i.esPrincipal) ?? galeriaPortada[0] ?? null;

  const hover = galeriaPortada.find((i) => i.esHover) ?? null;

  return {
    id: producto.id,
    nombre: producto.nombre,
    slug: producto.slug,
    destacado: producto.destacado,

    precio:
      precioMinimo([...preciosVariante.values()]) ??
      calcularPrecioEfectivo({
        precioBase: producto.precioBase,
        precio: producto.precio,
        ahora,
      }),

    // Sin variantes no hay control de stock: se considera disponible.
    agotado: colores.length > 0 && colores.every((c) => c.agotado),

    imagenPrincipal: principal ? mapImagen(principal) : null,
    imagenHover: hover ? mapImagen(hover) : null,

    colores,

    insignias: producto.insignias.map((i) => i.insignia),

    categoria: producto.categorias[0]?.categoria ?? null,
  };
}

// ===================================================================================
export { toNumber };
