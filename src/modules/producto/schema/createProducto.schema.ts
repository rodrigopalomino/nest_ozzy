import { z } from 'zod';

// mismo regex del DTO
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const CreateProductoSchema = z.object({
  nombre: z.string().trim().min(1).max(180),

  slug: z.string().trim().min(1).max(220).regex(SLUG_REGEX, {
    message:
      'slug inválido. Usa minúsculas, números y guiones. Ej: casaca-oversize',
  }),

  descripcion: z.string().trim().max(5000).optional().nullable(),

  // enum de prisma (frontend): usa string union
  estado: z.enum(['ACTIVO', 'OCULTO', 'ARCHIVADO']).optional(),

  // equivalente al @Transform + @IsNumber(maxDecimalPlaces:2)
  // acepta: null, "", "129.90", "129,90", 129.9
  precioBase: z
    .preprocess(
      (value) => {
        if (value === null || value === undefined) return null;

        if (typeof value === 'string') {
          const v = value.trim();
          if (v === '') return null;
          const n = Number(v.replace(',', '.'));
          return Number.isFinite(n) ? n : value; // deja que falle con message abajo
        }

        return value;
      },
      z
        .number()
        .finite()
        .min(0)
        .multipleOf(0.01, 'precioBase debe tener máx 2 decimales'),
    )
    .optional()
    .nullable(),
});

export type CreateProductoType = z.infer<typeof CreateProductoSchema>;
