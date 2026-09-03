//* src/modules/catalogo/utils/jsonld.util.ts

import { ProductoCatalogoSalida } from 'src/modules/producto/utils/catalogo.mapper';

// ===================================================================================
// Datos estructurados schema.org/Product.
//
// Es lo que permite a Google mostrar precio, disponibilidad y rango en los
// resultados. Se genera en el servidor para que el precio del snippet y el
// de la página no puedan discrepar.
// ===================================================================================

export interface OpcionesJsonLd {
  urlTienda: string;
  nombreTienda: string;
  moneda: string;
}

// ===================================================================================
export function construirJsonLdProducto(
  producto: ProductoCatalogoSalida,
  opciones: OpcionesJsonLd,
): Record<string, unknown> {
  const urlBase = opciones.urlTienda.replace(/\/+$/, '');
  const url = `${urlBase}/producto/${producto.slug}`;

  const imagenes = [
    producto.imagenPrincipal,
    ...producto.colores.map((c) => c.imagenPrincipal),
  ].filter((u): u is string => Boolean(u));

  // Una oferta por variante: así el buscador conoce el precio y el stock
  // de cada talla y color, no sólo el del producto.
  const ofertas = producto.colores.flatMap((color) =>
    color.tallas.map((talla) => ({
      '@type': 'Offer',
      sku: talla.sku ?? `${producto.id}-${color.id}-${talla.id}`,
      name: `${producto.nombre} - ${color.nombre} / ${talla.etiqueta}`,
      price: talla.precio.precio.toFixed(2),
      priceCurrency: opciones.moneda,
      availability: talla.agotado
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      url,
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: opciones.nombreTienda },
    })),
  );

  const precios = producto.colores.flatMap((c) =>
    c.tallas.map((t) => t.precio.precio),
  );

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: producto.nombre,
    description: producto.descripcion ?? producto.nombre,
    sku: String(producto.id),
    url,
    ...(imagenes.length > 0 ? { image: [...new Set(imagenes)] } : {}),
    brand: { '@type': 'Brand', name: opciones.nombreTienda },
  };

  if (ofertas.length > 1) {
    // Varias variantes: AggregateOffer con el rango de precios.
    jsonLd.offers = {
      '@type': 'AggregateOffer',
      lowPrice: Math.min(...precios).toFixed(2),
      highPrice: Math.max(...precios).toFixed(2),
      priceCurrency: opciones.moneda,
      offerCount: ofertas.length,
      availability: producto.agotado
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      offers: ofertas,
    };
  } else if (ofertas.length === 1) {
    jsonLd.offers = ofertas[0];
  } else {
    // Producto sin variantes: se publica su precio base.
    jsonLd.offers = {
      '@type': 'Offer',
      price: producto.precio.precio.toFixed(2),
      priceCurrency: opciones.moneda,
      availability: 'https://schema.org/InStock',
      url,
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: opciones.nombreTienda },
    };
  }

  return jsonLd;
}
