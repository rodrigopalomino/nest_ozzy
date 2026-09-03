//* src/modules/lead/utils/plantilla.util.ts

// ===================================================================================
// Sustitución de variables {{clave}} en las plantillas configurables.
// Se extrae aparte para poder probarla sin base de datos.
// ===================================================================================

export function rellenarPlantilla(
  plantilla: string,
  valores: Record<string, string>,
): string {
  // Una variable sin valor se sustituye por cadena vacía en lugar de
  // dejar el {{marcador}} visible en el mensaje del cliente.
  return plantilla.replace(
    /\{\{(\w+)\}\}/g,
    (_coincidencia, clave: string) => valores[clave] ?? '',
  );
}

// ===================================================================================
// Normaliza el número a sólo dígitos, como exige wa.me.
export function normalizarNumeroWhatsapp(valor: string): string {
  return valor.replace(/\D/g, '');
}

// ===================================================================================
export function construirUrlWhatsapp(numero: string, mensaje: string): string {
  return `https://wa.me/${normalizarNumeroWhatsapp(numero)}?text=${encodeURIComponent(mensaje)}`;
}
