//* src/modules/producto-admin/utils/csv.util.ts

// ===================================================================================
// Lectura y escritura de CSV.
//
// Se implementa a mano en lugar de añadir una dependencia porque el formato
// que se necesita es acotado, pero sí respeta comillas y separadores dentro
// de los campos, que es donde fallan los partidos por split(',').
// ===================================================================================

// ===================================================================================
export function escaparCampoCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return '';

  // Sólo los primitivos tienen una representación textual útil; un objeto
  // se convertiría en "[object Object]" y ensuciaría la columna.
  const texto =
    typeof valor === 'string'
      ? valor
      : typeof valor === 'number' ||
          typeof valor === 'boolean' ||
          typeof valor === 'bigint'
        ? valor.toString()
        : valor instanceof Date
          ? valor.toISOString()
          : '';

  // Un campo con comas, comillas o saltos de línea debe ir entrecomillado,
  // y las comillas internas se duplican.
  if (/[",\n\r;]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }

  return texto;
}

// ===================================================================================
export function generarCsv(columnas: string[], filas: unknown[][]): string {
  const lineas = [
    columnas.map(escaparCampoCsv).join(','),
    ...filas.map((fila) => fila.map(escaparCampoCsv).join(',')),
  ];

  // BOM (\uFEFF) para que Excel abra los acentos correctamente.
  return '\uFEFF' + lineas.join('\r\n');
}

// ===================================================================================
// Parte una línea respetando las comillas.
function partirLinea(linea: string, separador: string): string[] {
  const campos: string[] = [];
  let actual = '';
  let entreComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];

    if (entreComillas) {
      if (c === '"') {
        // Comilla duplicada: es una comilla literal.
        if (linea[i + 1] === '"') {
          actual += '"';
          i++;
        } else {
          entreComillas = false;
        }
      } else {
        actual += c;
      }
      continue;
    }

    if (c === '"') {
      entreComillas = true;
      continue;
    }

    if (c === separador) {
      campos.push(actual);
      actual = '';
      continue;
    }

    actual += c;
  }

  campos.push(actual);

  return campos.map((c) => c.trim());
}

// ===================================================================================
export interface CsvParseado {
  columnas: string[];
  filas: Record<string, string>[];
}

export function parsearCsv(contenido: string): CsvParseado {
  // Se quita el BOM que añaden Excel y otras hojas de cálculo.
  const limpio = contenido.replace(/^\uFEFF/, '');

  const lineas = limpio.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (lineas.length === 0) {
    return { columnas: [], filas: [] };
  }

  // Se detecta el separador: Excel en configuración regional europea
  // exporta con punto y coma.
  const separador =
    (lineas[0].match(/;/g)?.length ?? 0) > (lineas[0].match(/,/g)?.length ?? 0)
      ? ';'
      : ',';

  const columnas = partirLinea(lineas[0], separador);

  const filas = lineas.slice(1).map((linea) => {
    const valores = partirLinea(linea, separador);

    return Object.fromEntries(
      columnas.map((col, i) => [col, valores[i] ?? '']),
    );
  });

  return { columnas, filas };
}

// ===================================================================================
// Convierte el texto de un CSV a número, aceptando coma decimal.
export function aNumero(valor: string): number | null {
  const limpio = valor.trim().replace(',', '.');

  if (limpio === '') return null;

  const n = Number(limpio);

  return Number.isFinite(n) ? n : null;
}

// ===================================================================================
export function aBooleano(valor: string, porDefecto = true): boolean {
  const v = valor.trim().toLowerCase();

  if (v === '') return porDefecto;

  return ['1', 'true', 'si', 'sí', 'x', 'yes'].includes(v);
}
