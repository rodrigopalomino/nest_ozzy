// src/producto/dto/create-imagen-producto.dto.ts
import { z } from 'zod';

export const CreateImagenProductoSchema = z
  .object({
    url: z.string().min(5, 'La URL debe tener al menos 5 caracteres').trim(),

    alt: z
      .string()
      .trim()
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .optional(),

    orden: z
      .number()
      .int('Orden debe ser entero')
      .min(0, 'Orden no puede ser negativo')
      .optional(),

    esPrincipal: z.boolean().optional(),
    esHover: z.boolean().optional(),

    // Color al que pertenece la imagen. null / ausente = imagen genérica,
    // se muestra para cualquier color del producto.
    color_id: z.coerce.number().int().positive().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    // ❌ no puede ser principal y hover a la vez
    if (data.esPrincipal && data.esHover) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['esPrincipal'],
        message: 'No puede ser principal y hover a la vez',
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['esHover'],
        message: 'No puede ser principal y hover a la vez',
      });
    }
  });

export type CreateImagenProductoType = z.infer<
  typeof CreateImagenProductoSchema
>;
