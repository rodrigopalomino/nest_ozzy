import { EstadoProducto } from '@prisma/client';
import { mapProductoCatalogo, mapProductoTarjeta } from './catalogo.mapper';

// ===================================================================================
// El listado usa un include reducido, así que la tarjeta debe coincidir con
// el detalle en precio y disponibilidad: si divergen, el catálogo mostraría
// un precio distinto al de la ficha.
// ===================================================================================

const talla = (id: number, etiqueta: string, activo = true) => ({
  id,
  etiqueta,
  activo,
});

const color = (
  id: number,
  nombre: string,
  hex: string | null = null,
  activo = true,
) => ({
  id,
  nombre,
  hex,
  activo,
});

const imagen = (
  id: number,
  url: string,
  color_id: number | null,
  flags: { esPrincipal?: boolean; esHover?: boolean } = {},
) => ({
  id,
  url,
  urlSm: `${url}-sm`,
  urlMd: `${url}-md`,
  urlLg: `${url}-lg`,
  ancho: 1200,
  alto: 1600,
  blurData: 'data:image/webp;base64,AAA',
  alt: null,
  orden: 0,
  esPrincipal: flags.esPrincipal ?? false,
  esHover: flags.esHover ?? false,
  color_id,
});

function base(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    nombre: 'Polo Oversize',
    slug: 'polo-oversize',
    descripcion: 'Algodón peinado',
    estado: EstadoProducto.ACTIVO,
    destacado: false,
    precioBase: 80,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    precio: null,
    imagenes: [],
    videos: [],
    variantes: [],
    categorias: [],
    colecciones: [],
    insignias: [],
    ...overrides,
  } as never;
}

describe('mapProductoTarjeta', () => {
  it('expone sólo los campos que pinta una tarjeta', () => {
    const r = mapProductoTarjeta(base());

    // La descripción, los vídeos y las colecciones no se traen: engordarían
    // la respuesta del listado sin que la vista los use.
    expect(Object.keys(r).sort()).toEqual(
      [
        'agotado',
        'categoria',
        'colores',
        'destacado',
        'id',
        'imagenHover',
        'imagenPrincipal',
        'insignias',
        'nombre',
        'precio',
        'slug',
      ].sort(),
    );
  });

  it('expone la categoría principal y null cuando no hay ninguna', () => {
    expect(mapProductoTarjeta(base()).categoria).toBeNull();

    const conCategoria = mapProductoTarjeta(
      base({
        categorias: [{ categoria: { id: 7, nombre: 'Polos', slug: 'polos' } }],
      }),
    );

    expect(conCategoria.categoria).toEqual({
      id: 7,
      nombre: 'Polos',
      slug: 'polos',
    });
  });

  it('devuelve la portada con sus miniaturas y el blur', () => {
    const r = mapProductoTarjeta(
      base({
        imagenes: [imagen(1, 'negro', 1, { esPrincipal: true })],
        variantes: [
          {
            id: 10,
            precio: null,
            stock: 3,
            talla: talla(1, 'S'),
            color: color(1, 'Negro'),
          },
        ],
      }),
    );

    expect(r.imagenPrincipal).toMatchObject({
      url: 'negro',
      urlSm: 'negro-sm',
      urlLg: 'negro-lg',
      ancho: 1200,
      alto: 1600,
      blurData: 'data:image/webp;base64,AAA',
    });
  });

  it('devuelve la imagen de hover cuando existe', () => {
    const r = mapProductoTarjeta(
      base({
        imagenes: [
          imagen(1, 'frente', null, { esPrincipal: true }),
          imagen(2, 'espalda', null, { esHover: true }),
        ],
        variantes: [
          {
            id: 10,
            precio: null,
            stock: 3,
            talla: talla(1, 'S'),
            color: color(1, 'Negro'),
          },
        ],
      }),
    );

    expect(r.imagenPrincipal?.url).toBe('frente');
    expect(r.imagenHover?.url).toBe('espalda');
  });

  it('da los puntos de color con su portada y su precio desde', () => {
    const r = mapProductoTarjeta(
      base({
        imagenes: [
          imagen(1, 'negro', 1, { esPrincipal: true }),
          imagen(2, 'blanco', 2, { esPrincipal: true }),
        ],
        variantes: [
          {
            id: 10,
            precio: null,
            stock: 3,
            talla: talla(1, 'S'),
            color: color(1, 'Negro', '#000'),
          },
          {
            id: 11,
            precio: 95,
            stock: 1,
            talla: talla(1, 'S'),
            color: color(2, 'Blanco', '#fff'),
          },
        ],
      }),
    );

    expect(r.colores).toHaveLength(2);
    expect(r.colores[0]).toMatchObject({
      nombre: 'Negro',
      hex: '#000',
      imagenPrincipal: 'negro',
      agotado: false,
    });
    expect(r.colores[0].desde?.precio).toBe(80);
    expect(r.colores[1].desde?.precio).toBe(95);
  });

  it('marca el color agotado sólo si todas sus tallas lo están', () => {
    const r = mapProductoTarjeta(
      base({
        variantes: [
          {
            id: 10,
            precio: null,
            stock: 0,
            talla: talla(1, 'S'),
            color: color(1, 'Negro'),
          },
          {
            id: 11,
            precio: null,
            stock: 2,
            talla: talla(2, 'M'),
            color: color(1, 'Negro'),
          },
        ],
      }),
    );

    expect(r.colores[0].agotado).toBe(false);
    expect(r.agotado).toBe(false);
  });

  it('marca el producto agotado cuando no queda ninguna talla', () => {
    const r = mapProductoTarjeta(
      base({
        variantes: [
          {
            id: 10,
            precio: null,
            stock: 0,
            talla: talla(1, 'S'),
            color: color(1, 'Negro'),
          },
        ],
      }),
    );

    expect(r.agotado).toBe(true);
  });

  it('excluye las variantes con talla o color desactivados', () => {
    const r = mapProductoTarjeta(
      base({
        variantes: [
          {
            id: 10,
            precio: null,
            stock: 5,
            talla: talla(1, 'S', false),
            color: color(1, 'Negro'),
          },
          {
            id: 11,
            precio: null,
            stock: 5,
            talla: talla(2, 'M'),
            color: color(2, 'Blanco', null, false),
          },
        ],
      }),
    );

    expect(r.colores).toHaveLength(0);
  });

  it('un color sin fotos propias hereda la portada genérica', () => {
    const r = mapProductoTarjeta(
      base({
        imagenes: [imagen(1, 'generica', null, { esPrincipal: true })],
        variantes: [
          {
            id: 10,
            precio: null,
            stock: 5,
            talla: talla(1, 'S'),
            color: color(3, 'Rosado'),
          },
        ],
      }),
    );

    expect(r.colores[0].imagenPrincipal).toBe('generica');
    expect(r.imagenPrincipal?.url).toBe('generica');
  });

  it('sin variantes no se reporta agotado y usa el precio base', () => {
    const r = mapProductoTarjeta(base({ precioBase: 45 }));

    expect(r.colores).toEqual([]);
    expect(r.agotado).toBe(false);
    expect(r.precio.precio).toBe(45);
  });

  it('devuelve null en las imágenes cuando el producto no tiene ninguna', () => {
    const r = mapProductoTarjeta(base());

    expect(r.imagenPrincipal).toBeNull();
    expect(r.imagenHover).toBeNull();
  });

  it('aplasta las insignias a objeto plano', () => {
    const r = mapProductoTarjeta(
      base({
        insignias: [
          {
            insignia: { id: 1, nombre: 'NUEVO', slug: 'nuevo', color: '#0f0' },
          },
        ],
      }),
    );

    expect(r.insignias).toEqual([
      { id: 1, nombre: 'NUEVO', slug: 'nuevo', color: '#0f0' },
    ]);
  });
});

// ===================================================================================
describe('coherencia entre la tarjeta y el detalle', () => {
  // Si estos valores divergen, el catálogo anunciaría un precio o una
  // disponibilidad distintos a los de la ficha del producto.
  const datos = {
    precio: {
      precioOriginal: 200,
      porcentajeDescuento: 25,
      precioOferta: null,
      iniciaEn: null,
      terminaEn: null,
      activo: true,
    },
    imagenes: [
      imagen(1, 'negro', 1, { esPrincipal: true }),
      imagen(2, 'negro-2', 1, { esHover: true }),
    ],
    variantes: [
      {
        id: 10,
        sku: 'A',
        precio: null,
        stock: 3,
        activo: true,
        talla: talla(1, 'S'),
        color: color(1, 'Negro', '#000'),
      },
      {
        id: 11,
        sku: 'B',
        precio: 120,
        stock: 0,
        activo: true,
        talla: talla(2, 'M'),
        color: color(1, 'Negro', '#000'),
      },
    ],
  };

  const ahora = new Date('2026-06-15T12:00:00Z');

  it('coincide el precio del producto', () => {
    const tarjeta = mapProductoTarjeta(base(datos), ahora);
    const detalle = mapProductoCatalogo(base(datos), ahora);

    expect(tarjeta.precio).toEqual(detalle.precio);
  });

  it('coincide la disponibilidad', () => {
    const tarjeta = mapProductoTarjeta(base(datos), ahora);
    const detalle = mapProductoCatalogo(base(datos), ahora);

    expect(tarjeta.agotado).toBe(detalle.agotado);
  });

  it('coinciden los colores, su portada y su precio desde', () => {
    const tarjeta = mapProductoTarjeta(base(datos), ahora);
    const detalle = mapProductoCatalogo(base(datos), ahora);

    expect(tarjeta.colores.map((c) => c.id)).toEqual(
      detalle.colores.map((c) => c.id),
    );

    tarjeta.colores.forEach((c, i) => {
      expect(c.imagenPrincipal).toBe(detalle.colores[i].imagenPrincipal);
      expect(c.imagenHover).toBe(detalle.colores[i].imagenHover);
      expect(c.agotado).toBe(detalle.colores[i].agotado);
      expect(c.desde).toEqual(detalle.colores[i].desde);
    });
  });

  it('coincide la portada del producto', () => {
    const tarjeta = mapProductoTarjeta(base(datos), ahora);
    const detalle = mapProductoCatalogo(base(datos), ahora);

    expect(tarjeta.imagenPrincipal?.url).toBe(detalle.imagenPrincipal);
    expect(tarjeta.imagenHover?.url).toBe(detalle.imagenHover);
  });
});
