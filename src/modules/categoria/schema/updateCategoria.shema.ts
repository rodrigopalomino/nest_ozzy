import { z } from 'zod';

export const UpdateCategoriaSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).optional(),
  activo: z.boolean().optional(),
});

export type UpdateCategoriaType = z.infer<typeof UpdateCategoriaSchema>;
