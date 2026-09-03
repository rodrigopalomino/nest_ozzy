import { z } from 'zod';
import { fechaIsoNullish } from 'src/common/schema/fecha.schema';

export const CreateColeccionSchema = z.object({
  nombre: z.string().trim().min(1),
  slug: z.string().trim().min(1),

  descripcion: z.string().trim().optional().nullable(),
  imagenPortada: z.string().trim().optional().nullable(),

  // acepta string (ISO) o Date, ambos opcionales y nullable
  // Cadena ISO: un z.date() no se puede representar en JSON Schema y
  // rompe la generación de la documentación OpenAPI.
  iniciaEn: fechaIsoNullish,
  terminaEn: fechaIsoNullish,

  // opcional porque en DB tiene default(true)
  activo: z.boolean().optional(),
});

export type CreateColeccionType = z.infer<typeof CreateColeccionSchema>;
