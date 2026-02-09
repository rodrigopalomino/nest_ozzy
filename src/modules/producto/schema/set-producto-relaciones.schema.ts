// src/modules/producto/schema/set-producto-relaciones.schema.ts
import { z } from 'zod';

export const SetProductoRelacionesSchema = z.object({
  categoriaIds: z.array(z.number().int().positive()).optional(),
  coleccionIds: z.array(z.number().int().positive()).optional(),
  insigniaIds: z.array(z.number().int().positive()).optional(),
});

export type SetProductoRelacionesType = z.infer<
  typeof SetProductoRelacionesSchema
>;
