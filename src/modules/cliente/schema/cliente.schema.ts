//* src/modules/cliente/schema/cliente.schema.ts

import { z } from 'zod';

// ===================================================================================
export const LoginGoogleSchema = z.object({
  // id_token que devuelve Google Identity Services en el front.
  idToken: z.string().min(20, 'Token de Google inválido'),
  // Id de dispositivo para adoptar los favoritos creados sin sesión.
  dispositivo: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9-]{8,64}$/)
    .nullish(),
});

export type LoginGoogleType = z.infer<typeof LoginGoogleSchema>;

// ===================================================================================
export const PreferenciasClienteSchema = z
  .object({
    aceptaNovedades: z.boolean().optional(),
    nombre: z.string().trim().min(1).max(120).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Envía al menos un campo para actualizar',
  });

export type PreferenciasClienteType = z.infer<typeof PreferenciasClienteSchema>;

// ===================================================================================
export const FavoritoSchema = z.object({
  producto_id: z.coerce.number().int().positive(),
  dispositivo: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9-]{8,64}$/)
    .nullish(),
});

export type FavoritoType = z.infer<typeof FavoritoSchema>;

// ===================================================================================
export const AvisoStockSchema = z.object({
  variante_id: z.coerce.number().int().positive(),
  email: z.string().trim().toLowerCase().email('Correo inválido').max(180),
});

export type AvisoStockType = z.infer<typeof AvisoStockSchema>;
