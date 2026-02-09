import { z } from 'zod';

// =======================
// CREATE
// =======================
export const CreateTallaSchema = z.object({
  etiqueta: z.string().trim().min(1), // S, M, L...
  activo: z.boolean().optional(), // default(true) en DB
});

export type CreateTallaType = z.infer<typeof CreateTallaSchema>;
