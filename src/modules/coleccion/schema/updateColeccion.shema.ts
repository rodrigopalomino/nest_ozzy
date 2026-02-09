import { z } from 'zod';

export const UpdateColeccionSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).optional(),
  descripcion: z.string().trim().optional().nullable(),
  imagenPortada: z.string().trim().optional().nullable(),
  iniciaEn: z.union([z.string().datetime(), z.date()]).optional().nullable(),
  terminaEn: z.union([z.string().datetime(), z.date()]).optional().nullable(),
  activo: z.boolean().optional(),
});

export type UpdateColeccionType = z.infer<typeof UpdateColeccionSchema>;
