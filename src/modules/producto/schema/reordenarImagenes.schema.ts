//* src/modules/producto/schema/reordenarImagenes.schema.ts

import { z } from 'zod';

// ===================================================================================
// Reordenar la galería: el front envía los ids en el orden deseado y el
// servidor reasigna el campo `orden` de forma consecutiva.
export const ReordenarImagenesSchema = z.object({
  imagenIds: z
    .array(z.coerce.number().int().positive())
    .min(1, 'Envía al menos una imagen')
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'No se admiten ids repetidos',
    }),
});

export type ReordenarImagenesType = z.infer<typeof ReordenarImagenesSchema>;
