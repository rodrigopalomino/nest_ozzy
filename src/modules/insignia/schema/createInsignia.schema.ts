import { z } from 'zod';

// ✅ slug: minúsculas, números y guiones (igual estilo que usaste en Producto)
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ✅ color: acepta "#RRGGBB" o "#RGB" si quieres (aquí dejo solo #RRGGBB)
const hexColorRegex = /^#([0-9a-fA-F]{6})$/;

export const createInsigniaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'nombre es obligatorio')
    .max(80, 'nombre máximo 80 caracteres'),

  slug: z
    .string()
    .trim()
    .min(1, 'slug es obligatorio')
    .max(120, 'slug máximo 120 caracteres')
    .regex(slugRegex, 'slug inválido. Usa minúsculas, números y guiones.'),

  color: z
    .string()
    .trim()
    .regex(hexColorRegex, 'color debe ser hex tipo #RRGGBB')
    .optional()
    .nullable(),

  activo: z.boolean().optional(),
});

export type CreateInsigniaType = z.infer<typeof createInsigniaSchema>;
