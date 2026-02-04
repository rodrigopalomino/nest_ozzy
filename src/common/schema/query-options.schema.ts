//* src/common/schema/query-options.schema.ts

import z from 'zod';

// ===================================================================================
export const QueryOptionsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  sortBy: z.union([z.string(), z.array(z.string())]).optional(),
  order: z
    .union([z.enum(['asc', 'desc']), z.array(z.enum(['asc', 'desc']))])
    .optional(),
  filtros: z.record(z.string(), z.any()).optional().default({}),
  include: z.array(z.string()).optional().default([]),
});

export type QueryOptionsSchemaType = z.infer<typeof QueryOptionsSchema>;
