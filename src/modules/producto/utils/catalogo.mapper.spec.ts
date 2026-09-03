import { EstadoProducto } from '@prisma/client';
import { mapProductoCatalogo } from './catalogo.mapper';

const talla = (id: number, etiqueta: string, activo = true) => ({
  id,
  etiqueta,
  activo,
});

const color = (id: number, nombre: string, activo = true) => ({
  id,
  nombre,
  hex: null,
  activo,
});

function base(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    nombre: 'Polo Oversize',
    slug: 'polo-oversize',
    descripcion: null,
    estado: EstadoProducto.ACTIVO,
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

describe('mapProductoCatalogo', () => {
  it('agrupa las tallas bajo su color', () => {
    const r = mapProductoCatalogo(
      base({
        variantes: [
          {
            id: 10,
            sku: 'N-S',
            precio: null,
            stock: 5,
            activo: true,
            talla: talla(1, 'S'),
            color: color(1, 'Negro'),
          },
          {
            id: 11,
            sku: 'N-M',
            precio: null,
            stock: 2,
            activo: true,
            talla: talla(2, 'M'),
            color: color(1, 'Negro'),
          },
          {
            id: 12,
            sku: 'B-S',
            precio: null,
            stock: 1,
            activo: true,
            talla: talla(1, 'S'),
            color: color(2, 'Blanco'),
          },
        ],
      }),
    );

    expect(r.colores).toHaveLength(2);
    expect(r.colores[0].nombre).toBe('Negro');
    expect(r.colores[0].tallas.map((t) => t.etiqueta)).toEqual(['S', 'M']);
    expect(r.colores[1].tallas.map((t) => t.etiqueta)).toEqual(['S']);
  });

  it('asigna a cada color sus propias imágenes', () => {
    const r = mapProductoCatalogo(
      base({
        imagenes: [
          {
            id: 1,
            url: 'negro-1.jpg',
            alt: null,
            orden: 0,
            esPrincipal: true,
            esHover: false,
            color_id: 1,
          },
          {
            id: 2,
            url: 'blanco-1.jpg',
            alt: null,
            orden: 0,
            esPrincipal: true,
            esHover: false,
            color_id: 2,
          },
        ],
        variantes: [
          {
            id: 10,
            sku: null,
            precio: null,
            stock: 5,
            activo: true,
            talla: talla(1, 'S'),
            color: color(1, 'Negro'),
          },
          {
            id: 11,
            sku: null,
            precio: null,
            stock: 5,
            activo: true,
            talla: talla(1, 'S'),
            color: color(2, 'Blanco'),
          },
        ],
      }),
    );

    expect(r.colores[0].imagenPrincipal).toBe('negro-1.jpg');
    expect(r.colores[1].imagenPrincipal).toBe('blanco-1.jpg');
  });

  it('un color sin fotos propias hereda la galería genérica', () => {
    const r = mapProductoCatalogo(
      base({
        imagenes: [
          {
            id: 1,
            url: 'generica.jpg',
            alt: null,
            orden: 0,
            esPrincipal: true,
            esHover: false,
            color_id: null,
          },
        ],
        variantes: [
          {
            id: 10,
            sku: null,
            precio: null,
            stock: 5,
            activo: true,
            talla: talla(1, 'S'),
            color: color(3, 'Rosado'),
          },
        ],
      }),
    );

    expect(r.colores[0].imagenPrincipal).toBe('generica.jpg');
  });

  it('respeta el precio propio de cada variante', () => {
    const r = mapProductoCatalogo(
      base({
        variantes: [
          {
            id: 10,
            sku: null,
            precio: 120,
            stock: 5,
            activo: true,
            talla: talla(4, 'XL'),
            color: color(1, 'Negro'),
          },
          {
            id: 11,
            sku: null,
            precio: null,
            stock: 5,
            activo: true,
            talla: talla(1, 'S'),
            color: color(1, 'Negro'),
          },
        ],
      }),
    );

    const xl = r.colores[0].tallas.find((t) => t.etiqueta === 'XL');
    const s = r.colores[0].tallas.find((t) => t.etiqueta === 'S');

    expect(xl?.precio.precio).toBe(120);
    expect(s?.precio.precio).toBe(80);
  });

  it('el precio del producto es el más bajo de sus variantes', () => {
    const r = mapProductoCatalogo(
      base({
        variantes: [
          {
            id: 10,
            sku: null,
            precio: 150,
            stock: 5,
            activo: true,
            talla: talla(1, 'S'),
            color: color(1, 'Negro'),
          },
          {
            id: 11,
            sku: null,
            precio: 90,
            stock: 5,
            activo: true,
            talla: talla(2, 'M'),
            color: color(1, 'Negro'),
          },
        ],
      }),
    );

    expect(r.precio.precio).toBe(90);
    expect(r.colores[0].desde?.precio).toBe(90);
  });

  it('marca agotada la talla sin stock y deja el color disponible', () => {
    const r = mapProductoCatalogo(
      base({
        variantes: [
          {
            id: 10,
            sku: null,
            precio: null,
            stock: 0,
            activo: true,
            talla: talla(1, 'S'),
            color: color(1, 'Negro'),
          },
          {
            id: 11,
            sku: null,
            precio: null,
            stock: 3,
            activo: true,
            talla: talla(2, 'M'),
            color: color(1, 'Negro'),
          },
        ],
      }),
    );

    expect(r.colores[0].tallas[0].agotado).toBe(true);
    expect(r.colores[0].tallas[1].agotado).toBe(false);
    expect(r.colores[0].agotado).toBe(false);
    expect(r.agotado).toBe(false);
  });

  it('marca agotado el producto cuando todas sus variantes lo están', () => {
    const r = mapProductoCatalogo(
      base({
        variantes: [
          {
            id: 10,
            sku: null,
            precio: null,
            stock: 0,
            activo: true,
            talla: talla(1, 'S'),
            color: color(1, 'Negro'),
          },
        ],
      }),
    );

    expect(r.agotado).toBe(true);
  });

  it('stock null no agota (no se controla stock)', () => {
    const r = mapProductoCatalogo(
      base({
        variantes: [
          {
            id: 10,
            sku: null,
            precio: null,
            stock: null,
            activo: true,
            talla: talla(1, 'S'),
            color: color(1, 'Negro'),
          },
        ],
      }),
    );

    expect(r.agotado).toBe(false);
  });

  it('excluye variantes inactivas y las de talla o color inactivos', () => {
    const r = mapProductoCatalogo(
      base({
        variantes: [
          {
            id: 10,
            sku: null,
            precio: null,
            stock: 5,
            activo: false,
            talla: talla(1, 'S'),
            color: color(1, 'Negro'),
          },
          {
            id: 11,
            sku: null,
            precio: null,
            stock: 5,
            activo: true,
            talla: talla(2, 'M', false),
            color: color(1, 'Negro'),
          },
          {
            id: 12,
            sku: null,
            precio: null,
            stock: 5,
            activo: true,
            talla: talla(3, 'L'),
            color: color(2, 'Blanco', false),
          },
        ],
      }),
    );

    expect(r.colores).toHaveLength(0);
  });

  it('un producto sin variantes no se reporta agotado', () => {
    const r = mapProductoCatalogo(base({ precioBase: 45 }));

    expect(r.colores).toEqual([]);
    expect(r.agotado).toBe(false);
    expect(r.precio.precio).toBe(45);
  });

  it('aplica la oferta vigente del producto', () => {
    const r = mapProductoCatalogo(
      base({
        precio: {
          precioOriginal: 200,
          porcentajeDescuento: 50,
          precioOferta: null,
          iniciaEn: null,
          terminaEn: null,
          activo: true,
        },
        variantes: [
          {
            id: 10,
            sku: null,
            precio: null,
            stock: 5,
            activo: true,
            talla: talla(1, 'S'),
            color: color(1, 'Negro'),
          },
        ],
      }),
    );

    expect(r.precio).toMatchObject({
      precio: 100,
      precioAnterior: 200,
      enOferta: true,
    });
  });
  it('sin imágenes genéricas, la portada sale del primer color y no mezcla', () => {
    const r = mapProductoCatalogo(
      base({
        imagenes: [
          {
            id: 1,
            url: 'negro.jpg',
            alt: null,
            orden: 0,
            esPrincipal: true,
            esHover: false,
            color_id: 1,
          },
          {
            id: 2,
            url: 'blanco.jpg',
            alt: null,
            orden: 0,
            esPrincipal: true,
            esHover: false,
            color_id: 2,
          },
        ],
        variantes: [
          {
            id: 10,
            sku: null,
            precio: null,
            stock: 5,
            activo: true,
            talla: talla(1, 'S'),
            color: color(1, 'Negro'),
          },
          {
            id: 11,
            sku: null,
            precio: null,
            stock: 5,
            activo: true,
            talla: talla(1, 'S'),
            color: color(2, 'Blanco'),
          },
        ],
      }),
    );

    // Sólo las del primer color, no las de los dos.
    expect(r.imagenes.map((i) => i.url)).toEqual(['negro.jpg']);
    expect(r.imagenPrincipal).toBe('negro.jpg');
  });

  it('la galería genérica tiene prioridad sobre las de color', () => {
    const r = mapProductoCatalogo(
      base({
        imagenes: [
          {
            id: 1,
            url: 'portada.jpg',
            alt: null,
            orden: 0,
            esPrincipal: true,
            esHover: false,
            color_id: null,
          },
          {
            id: 2,
            url: 'negro.jpg',
            alt: null,
            orden: 0,
            esPrincipal: true,
            esHover: false,
            color_id: 1,
          },
        ],
        variantes: [
          {
            id: 10,
            sku: null,
            precio: null,
            stock: 5,
            activo: true,
            talla: talla(1, 'S'),
            color: color(1, 'Negro'),
          },
        ],
      }),
    );

    expect(r.imagenPrincipal).toBe('portada.jpg');
    // El color conserva su propia galería.
    expect(r.colores[0].imagenPrincipal).toBe('negro.jpg');
  });
});
