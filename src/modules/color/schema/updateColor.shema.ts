import { z } from 'zod';

export const UpdateColorSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  hex: z.string().trim().optional().nullable(),
  activo: z.boolean().optional(),
});

export type UpdateColorType = z.infer<typeof UpdateColorSchema>;
