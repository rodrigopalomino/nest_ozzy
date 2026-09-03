//* src/common/utils/filtros-relacion.spec.ts

// ===================================================================================
// Filtros sobre relaciones y campos que exigen operador.
//
// Los tres casos que se fijan aquí llegaron a producción rotos:
//
//  1. Un filtro sobre una relación generaba `{ categorias: { equals: 'x' } }`,
//     que Prisma rechaza: una relación de lista necesita `some`.
//  2. `colores` y `tallas` no estaban en la whitelist, así que las facetas
//     ofrecían conteos por los que no se podía filtrar.
//  3. `precioDesde=100` sin operador devolvía 0 resultados con un 200. Un
//     cero mentiroso es peor que un error: el front mostraba "sin
//     resultados" y nadie sospechaba del filtro.
// ===================================================================================

import { BadRequestException } from '@nestjs/common';
import { buildFilters } from './prisma-query-builder';

const PERMITIDOS = [
  'nombre',
  'destacado',
  'precioDesde',
  'categorias[].categoria.slug',
  'insignias[].insignia.slug',
  'colores:variantes[].color.nombre',
  'tallas:variantes[].talla.etiqueta',
];

// ===================================================================================
describe('filtros sobre relaciones', () => {
  it('envuelve una relación de lista en `some`', () => {
    expect(buildFilters({ categorias: 'polos' }, PERMITIDOS)).toEqual({
      categorias: { some: { categoria: { slug: { equals: 'polos' } } } },
    });
  });

  it('traduce el alias a la relación real', () => {
    // El cliente pide `colores`, pero el color cuelga de las variantes.
    expect(buildFilters({ colores: 'Negro' }, PERMITIDOS)).toEqual({
      variantes: { some: { color: { nombre: { equals: 'Negro' } } } },
    });

    expect(buildFilters({ tallas: 'XL' }, PERMITIDOS)).toEqual({
      variantes: { some: { talla: { etiqueta: { equals: 'XL' } } } },
    });
  });

  it('compara exacto, no por fragmento', () => {
    // `contains` haría que "Negro" trajera "Negro Mate": en un filtro de
    // faceta el valor viene de una lista cerrada y debe coincidir.
    expect(buildFilters({ categorias: 'polos' }, PERMITIDOS)).toEqual({
      categorias: { some: { categoria: { slug: { equals: 'polos' } } } },
    });
  });

  it('combina dos relaciones distintas en el mismo where', () => {
    // Es el caso "Hoodies + en oferta", que antes era imposible.
    expect(
      buildFilters({ categorias: 'hoodies', insignias: 'oferta' }, PERMITIDOS),
    ).toEqual({
      categorias: { some: { categoria: { slug: { equals: 'hoodies' } } } },
      insignias: { some: { insignia: { slug: { equals: 'oferta' } } } },
    });
  });

  it('respeta los operadores explícitos sobre una relación', () => {
    expect(
      buildFilters({ categorias: { in: 'polos,hoodies' } }, PERMITIDOS),
    ).toEqual({
      categorias: {
        some: { categoria: { slug: { in: ['polos', 'hoodies'] } } },
      },
    });
  });

  // ===================================================================================
  // Multiselección. El parámetro repetido es la forma canónica en HTTP para
  // valores múltiples: la que produce un <form> con casillas del mismo
  // nombre y URLSearchParams.append. Antes daba 400.
  it('acepta el parámetro repetido como unión', () => {
    expect(
      buildFilters({ categorias: ['hoodies', 'polos'] }, PERMITIDOS),
    ).toEqual({
      categorias: {
        some: { categoria: { slug: { in: ['hoodies', 'polos'] } } },
      },
    });
  });

  it('trata igual la coma y el parámetro repetido', () => {
    const conComa = buildFilters({ categorias: 'hoodies,polos' }, PERMITIDOS);
    const repetido = buildFilters(
      { categorias: ['hoodies', 'polos'] },
      PERMITIDOS,
    );

    expect(repetido).toEqual(conComa);
  });

  it('un array de un solo valor compara directo, sin `in`', () => {
    expect(buildFilters({ categorias: ['polos'] }, PERMITIDOS)).toEqual({
      categorias: { some: { categoria: { slug: { equals: 'polos' } } } },
    });
  });

  it('mezcla parámetro repetido y comas en la misma clave', () => {
    expect(
      buildFilters({ colores: ['Negro,Blanco', 'Rojo'] }, PERMITIDOS),
    ).toEqual({
      variantes: {
        some: { color: { nombre: { in: ['Negro', 'Blanco', 'Rojo'] } } },
      },
    });
  });

  it('descarta valores vacíos del array', () => {
    // Una casilla desmarcada puede dejar un valor vacío en la query.
    expect(
      buildFilters({ categorias: ['polos', '', '  '] }, PERMITIDOS),
    ).toEqual({
      categorias: { some: { categoria: { slug: { equals: 'polos' } } } },
    });
  });

  it('un array totalmente vacío no añade condición', () => {
    expect(buildFilters({ categorias: ['', ''] }, PERMITIDOS)).toEqual({});
  });

  it('sigue rechazando un campo que no está en la whitelist', () => {
    expect(() => buildFilters({ password: 'x' }, PERMITIDOS)).toThrow(
      BadRequestException,
    );
  });

  it('el error lista nombres públicos, no rutas internas', () => {
    try {
      buildFilters({ inventado: 'x' }, PERMITIDOS);
      throw new Error('debió lanzar');
    } catch (e) {
      const respuesta = (e as BadRequestException).getResponse() as {
        allowed: string[];
      };

      // "categorias[].categoria.slug" no le sirve de nada a quien llama.
      expect(respuesta.allowed).toContain('categorias');
      expect(respuesta.allowed).toContain('colores');
      expect(respuesta.allowed.join()).not.toContain('[]');
      expect(respuesta.allowed.join()).not.toContain('.');
    }
  });
});

// ===================================================================================
describe('campos que exigen operador', () => {
  it('rechaza precioDesde sin operador en lugar de devolver cero', () => {
    expect(() => buildFilters({ precioDesde: '100' }, PERMITIDOS)).toThrow(
      BadRequestException,
    );
  });

  it('el error explica cómo escribirlo bien', () => {
    try {
      buildFilters({ precioDesde: '100' }, PERMITIDOS);
      throw new Error('debió lanzar');
    } catch (e) {
      const r = (e as BadRequestException).getResponse() as {
        campo: string;
        ejemplo: string;
        operadores: string[];
      };

      expect(r.campo).toBe('precioDesde');
      expect(r.ejemplo).toContain('gte');
      expect(r.operadores).toContain('lte');
    }
  });

  it('acepta precioDesde con operador', () => {
    expect(buildFilters({ precioDesde: { gte: '100' } }, PERMITIDOS)).toEqual({
      precioDesde: { gte: 100 },
    });

    expect(
      buildFilters({ precioDesde: { gte: '50', lte: '150' } }, PERMITIDOS),
    ).toEqual({ precioDesde: { gte: 50, lte: 150 } });
  });

  it('no exige operador en campos normales', () => {
    expect(buildFilters({ destacado: 'true' }, PERMITIDOS)).toEqual({
      destacado: { equals: true },
    });

    // El texto libre sigue buscando por fragmento.
    expect(buildFilters({ nombre: 'polo' }, PERMITIDOS)).toEqual({
      nombre: { contains: 'polo' },
    });
  });
});
