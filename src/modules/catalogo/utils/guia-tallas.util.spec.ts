//* src/modules/catalogo/utils/guia-tallas.util.spec.ts

import { parsearTablaGuia } from './guia-tallas.util';

const VALIDA = {
  columnas: ['Talla', 'Pecho', 'Largo'],
  filas: [
    ['S', '96', '68'],
    ['M', '101', '70'],
  ],
};

describe('parsearTablaGuia', () => {
  it('acepta una tabla coherente', () => {
    expect(parsearTablaGuia(JSON.stringify(VALIDA))).toEqual(VALIDA);
  });

  it('acepta una tabla sin filas: las columnas ya son útiles', () => {
    const r = parsearTablaGuia(
      JSON.stringify({ columnas: ['Talla'], filas: [] }),
    );

    expect(r).toEqual({ columnas: ['Talla'], filas: [] });
  });

  // ===================================================================================
  // Todo lo que no se puede pintar devuelve null en lugar de lanzar: una
  // guía mal guardada no debe tumbar la ficha del producto.
  it.each([
    ['JSON roto', '{no es json'],
    ['cadena vacía', ''],
    ['null', 'null'],
    ['un número', '42'],
    ['un array', '[1,2,3]'],
    ['sin columnas', '{"filas":[["S"]]}'],
    ['columnas vacías', '{"columnas":[],"filas":[]}'],
    ['columnas no textuales', '{"columnas":[1,2],"filas":[]}'],
    ['sin filas', '{"columnas":["Talla"]}'],
    ['filas no array', '{"columnas":["Talla"],"filas":"S"}'],
    ['celda no textual', '{"columnas":["Talla"],"filas":[[5]]}'],
  ])('devuelve null con %s', (_caso, crudo) => {
    expect(parsearTablaGuia(crudo)).toBeNull();
  });

  it('descarta la tabla si una fila no cuadra con las columnas', () => {
    const descuadrada = {
      columnas: ['Talla', 'Pecho'],
      filas: [
        ['S', '96'],
        ['M'], // le falta una celda
      ],
    };

    expect(parsearTablaGuia(JSON.stringify(descuadrada))).toBeNull();
  });

  it('descarta la tabla si una fila tiene celdas de más', () => {
    const sobrante = {
      columnas: ['Talla'],
      filas: [['S', '96']],
    };

    expect(parsearTablaGuia(JSON.stringify(sobrante))).toBeNull();
  });

  it('no lanza nunca, sea cual sea la entrada', () => {
    for (const entrada of ['', '{', 'undefined', '{"columnas":null}']) {
      expect(() => parsearTablaGuia(entrada)).not.toThrow();
    }
  });
});
