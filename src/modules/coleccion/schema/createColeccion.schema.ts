import { z } from 'zod';

export const CreateColeccionSchema = z.object({
  nombre: z.string().trim().min(1),
  slug: z.string().trim().min(1),

  descripcion: z.string().trim().optional().nullable(),
  imagenPortada: z.string().trim().optional().nullable(),

  // acepta string (ISO) o Date, ambos opcionales y nullable
  iniciaEn: z.union([z.string().datetime(), z.date()]).optional().nullable(),
  terminaEn: z.union([z.string().datetime(), z.date()]).optional().nullable(),

  // opcional porque en DB tiene default(true)
  activo: z.boolean().optional(),
});

export type CreateColeccionType = z.infer<typeof CreateColeccionSchema>;
