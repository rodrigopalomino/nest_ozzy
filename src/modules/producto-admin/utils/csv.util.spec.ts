import {
  aBooleano,
  aNumero,
  escaparCampoCsv,
  generarCsv,
  parsearCsv,
} from './csv.util';

describe('escaparCampoCsv', () => {
  it('deja el texto simple tal cual', () => {
    expect(escaparCampoCsv('Polo')).toBe('Polo');
  });

  it('entrecomilla el texto con comas', () => {
    expect(escaparCampoCsv('Polo, negro')).toBe('"Polo, negro"');
  });

  it('duplica las comillas internas', () => {
    expect(escaparCampoCsv('Polo "oversize"')).toBe('"Polo ""oversize"""');
  });

  it('entrecomilla el texto con saltos de línea', () => {
    expect(escaparCampoCsv('linea1\nlinea2')).toBe('"linea1\nlinea2"');
  });

  it('convierte null y undefined en cadena vacía', () => {
    expect(escaparCampoCsv(null)).toBe('');
    expect(escaparCampoCsv(undefined)).toBe('');
  });
});

describe('generarCsv', () => {
  it('escribe la cabecera y las filas', () => {
    const csv = generarCsv(
      ['a', 'b'],
      [
        [1, 2],
        [3, 4],
      ],
    );

    expect(csv.replace(/^\uFEFF/, '')).toBe('a,b\r\n1,2\r\n3,4');
  });

  it('incluye el BOM para que Excel lea los acentos', () => {
    expect(generarCsv(['á'], [])).toMatch(/^\uFEFF/);
  });
});

describe('parsearCsv', () => {
  it('lee la cabecera y las filas como objetos', () => {
    const r = parsearCsv('nombre,precio\nPolo,80');

    expect(r.columnas).toEqual(['nombre', 'precio']);
    expect(r.filas).toEqual([{ nombre: 'Polo', precio: '80' }]);
  });

  it('respeta las comas dentro de campos entrecomillados', () => {
    const r = parsearCsv('nombre,desc\nPolo,"negro, algodón"');

    expect(r.filas[0].desc).toBe('negro, algodón');
  });

  it('interpreta las comillas duplicadas', () => {
    const r = parsearCsv('nombre\n"Polo ""oversize"""');

    expect(r.filas[0].nombre).toBe('Polo "oversize"');
  });

  it('detecta el punto y coma como separador', () => {
    const r = parsearCsv('nombre;precio\nPolo;80');

    expect(r.columnas).toEqual(['nombre', 'precio']);
    expect(r.filas[0].precio).toBe('80');
  });

  it('descarta el BOM inicial', () => {
    const r = parsearCsv('\uFEFFnombre\nPolo');

    expect(r.columnas).toEqual(['nombre']);
  });

  it('ignora las líneas vacías', () => {
    const r = parsearCsv('nombre\nPolo\n\n\nCasaca\n');

    expect(r.filas).toHaveLength(2);
  });

  it('devuelve vacío si el contenido está vacío', () => {
    expect(parsearCsv('')).toEqual({ columnas: [], filas: [] });
  });

  it('rellena con cadena vacía las columnas que faltan en una fila', () => {
    const r = parsearCsv('a,b,c\n1,2');

    expect(r.filas[0]).toEqual({ a: '1', b: '2', c: '' });
  });
});

describe('aNumero', () => {
  it('acepta el punto decimal', () => {
    expect(aNumero('19.90')).toBe(19.9);
  });

  it('acepta la coma decimal', () => {
    expect(aNumero('19,90')).toBe(19.9);
  });

  it('devuelve null si está vacío o no es número', () => {
    expect(aNumero('')).toBeNull();
    expect(aNumero('abc')).toBeNull();
  });
});

describe('aBooleano', () => {
  it('reconoce las formas afirmativas', () => {
    for (const v of ['1', 'true', 'si', 'sí', 'X', 'yes']) {
      expect(aBooleano(v)).toBe(true);
    }
  });

  it('trata el resto como falso', () => {
    expect(aBooleano('0')).toBe(false);
    expect(aBooleano('no')).toBe(false);
  });

  it('usa el valor por defecto si viene vacío', () => {
    expect(aBooleano('', true)).toBe(true);
    expect(aBooleano('', false)).toBe(false);
  });
});
