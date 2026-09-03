import { z } from 'zod';
import { fechaIsoNullish } from 'src/common/schema/fecha.schema';

export const UpdateColeccionSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).optional(),
  descripcion: z.string().trim().optional().nullable(),
  imagenPortada: z.string().trim().optional().nullable(),
  // Cadena ISO: un z.date() no se puede representar en JSON Schema y
  // rompe la generación de la documentación OpenAPI.
  iniciaEn: fechaIsoNullish,
  terminaEn: fechaIsoNullish,
  activo: z.boolean().optional(),
});

export type UpdateColeccionType = z.infer<typeof UpdateColeccionSchema>;
