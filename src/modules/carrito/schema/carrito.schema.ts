//* src/modules/carrito/schema/carrito.schema.ts

import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// El id de dispositivo lo genera el navegador con crypto.randomUUID() y
// permite tener carrito sin iniciar sesión.
const dispositivo = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9-]{8,64}$/, 'Identificador de dispositivo inválido');

// ===================================================================================
export const AgregarItemSchema = z.object({
  // Se pide la variante, no el producto: la talla y el color son parte de
  // lo que se pide y el precio puede diferir entre variantes.
  variante_id: z.coerce.number().int().positive(),
  cantidad: z.coerce.number().int().min(1).max(20).default(1),
  dispositivo: dispositivo.nullish(),
});

export class AgregarItemDto extends createZodDto(AgregarItemSchema) {}

// ===================================================================================
export const ActualizarItemSchema = z.object({
  // 0 quita la línea.
  cantidad: z.coerce.number().int().min(0).max(20),
  dispositivo: dispositivo.nullish(),
});

export class ActualizarItemDto extends createZodDto(ActualizarItemSchema) {}

// ===================================================================================
export const CarritoQuerySchema = z.object({
  dispositivo: dispositivo.optional(),
});

export class CarritoQueryDto extends createZodDto(CarritoQuerySchema) {}
