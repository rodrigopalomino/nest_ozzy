import { z } from 'zod';

export const UpdateTallaSchema = z.object({
  etiqueta: z.string().trim().min(1).optional(),
  activo: z.boolean().optional(),
});

export type UpdateTallaType = z.infer<typeof UpdateTallaSchema>;
