//* src/common/schema/query-options.schema.ts

import z from 'zod';

// ===================================================================================
// Tope duro de paginación: sin esto, `limit` ausente devolvía la tabla completa.
export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 20;

// ===================================================================================
export const QueryOptionsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
  sortBy: z.union([z.string(), z.array(z.string())]).optional(),
  order: z
    .union([z.enum(['asc', 'desc']), z.array(z.enum(['asc', 'desc']))])
    .optional(),
  filtros: z.record(z.string(), z.any()).optional().default({}),
  include: z.array(z.string()).optional().default([]),
});

export type QueryOptionsSchemaType = z.infer<typeof QueryOptionsSchema>;
