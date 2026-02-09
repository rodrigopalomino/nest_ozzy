import { z } from 'zod';

export const CreateColorSchema = z.object({
  nombre: z.string().trim().min(1),
  hex: z.string().trim().optional().nullable(),
  activo: z.boolean().optional(), // default(true) en DB
});

export type CreateColorType = z.infer<typeof CreateColorSchema>;
