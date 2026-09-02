import { z } from 'zod';

export const CreateCategoriaSchema = z.object({
  nombre: z.string().trim().min(1, 'nombre es obligatorio'),
  slug: z.string().trim().min(1, 'slug es obligatorio'),
});

export type CreateCategoriaType = z.infer<typeof CreateCategoriaSchema>;
//
