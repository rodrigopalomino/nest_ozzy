import { z } from 'zod';
// ✅ slug: minúsculas, números y guiones (igual estilo que usaste en Producto)
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ✅ color: acepta "#RRGGBB" o "#RGB" si quieres (aquí dejo solo #RRGGBB)
const hexColorRegex = /^#([0-9a-fA-F]{6})$/;
// ✅ Update: todo opcional, pero si viene string lo limpiamos
export const updateInsigniaSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(1, 'nombre no puede ser vacío')
      .max(80, 'nombre máximo 80 caracteres')
      .optional(),

    slug: z
      .string()
      .trim()
      .min(1, 'slug no puede ser vacío')
      .max(120, 'slug máximo 120 caracteres')
      .regex(slugRegex, 'slug inválido. Usa minúsculas, números y guiones.')
      .optional(),

    color: z
      .string()
      .trim()
      .regex(hexColorRegex, 'color debe ser hex tipo #RRGGBB')
      .nullable()
      .optional(),

    activo: z.boolean().optional(),
  })
  // ✅ evita updates vacíos {}
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'Debes enviar al menos un campo para actualizar',
  });

export type UpdateInsigniaType = z.infer<typeof updateInsigniaSchema>;
