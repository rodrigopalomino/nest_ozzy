//* src/modules/catalogo/utils/guia-tallas.util.ts

// ===================================================================================
// La tabla de la guía se guarda como JSON libre en una columna Text, así que
// su forma no la garantiza la base. El alta la valida con Zod, pero una guía
// escrita antes de esa validación podría no cumplirla: se comprueba también
// al leer para que el front reciba una tabla utilizable o `null`, y no algo
// a medias que rompa el render de la ficha.
// ===================================================================================

export interface TablaGuiaTallas {
  columnas: string[];
  filas: string[][];
}

function esArrayDeTextos(valor: unknown): valor is string[] {
  return (
    Array.isArray(valor) && valor.every((celda) => typeof celda === 'string')
  );
}

// ===================================================================================
// Devuelve la tabla si es usable, o null si el JSON es inválido o su forma
// no cuadra. Nunca lanza: una guía mal guardada no debe tumbar la ficha.
export function parsearTablaGuia(crudo: string): TablaGuiaTallas | null {
  let datos: unknown;

  try {
    datos = JSON.parse(crudo);
  } catch {
    return null;
  }

  if (typeof datos !== 'object' || datos === null) return null;

  const { columnas, filas } = datos as Record<string, unknown>;

  if (!esArrayDeTextos(columnas) || columnas.length === 0) return null;
  if (!Array.isArray(filas)) return null;

  // Una fila con más o menos celdas que columnas descuadra la tabla, así que
  // la tabla entera se descarta en lugar de pintarla torcida.
  const coherentes = filas.every(
    (fila) => esArrayDeTextos(fila) && fila.length === columnas.length,
  );

  if (!coherentes) return null;

  return { columnas, filas: filas as string[][] };
}
