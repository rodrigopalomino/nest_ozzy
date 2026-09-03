//* src/common/schema/fecha.schema.ts

import { z } from 'zod';

// ===================================================================================
// Fechas en una API JSON.
//
// El esquema valida una cadena ISO y la deja como cadena: un esquema que
// devolviera Date no se puede representar en JSON Schema y rompería la
// generación de la documentación OpenAPI. La conversión a Date la hace
// `aFecha` en el servicio, justo antes de escribir en la base.
// ===================================================================================
export const fechaIso = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), {
    message: 'Fecha inválida. Usa formato ISO 8601, ej: 2026-09-30T23:59:59Z',
  });

export const fechaIsoNullish = fechaIso.nullish();

// ===================================================================================
// Convierte lo que llegó validado por fechaIso en Date.
// `null` se conserva (borra el valor) y `undefined` se ignora (no lo toca).
export function aFecha(
  valor: string | null | undefined,
): Date | null | undefined {
  if (valor === undefined) return undefined;
  if (valor === null) return null;

  return new Date(valor);
}
