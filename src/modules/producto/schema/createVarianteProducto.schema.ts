// src/producto/schema/createVarianteProducto.schema.ts
import { z } from 'zod';

const toNumber = (v: unknown) => {
  // acepta: 12, "12", "12.5", "12,5"
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return v; // para que falle con mensaje claro luego
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : v;
  }
  return v;
};

const intFromUnknown = (label: string) =>
  z.preprocess(
    (v) => toNumber(v),
    z.number().int(`${label} debe ser entero`).min(0, `${label} debe ser >= 0`),
  );

export const CreateVarianteProductoSchema = z.object({
  talla_id: intFromUnknown('talla_id'),
  color_id: intFromUnknown('color_id'),

  sku: z
    .preprocess(
      (v) => (typeof v === 'string' ? v.trim() : v),
      z.string().max(80, 'sku máximo 80 caracteres'),
    )
    .optional()
    .refine((v) => (v == null ? true : v.length > 0), {
      message: 'sku no puede ser vacío',
    }),

  precio: intFromUnknown('precio').optional(),
  stock: intFromUnknown('stock').optional(),

  activo: z
    .preprocess((v) => {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        if (s === 'true' || s === '1') return true;
        if (s === 'false' || s === '0') return false;
      }
      return v;
    }, z.boolean())
    .optional(),
});

export type CreateVarianteProductoType = z.infer<
  typeof CreateVarianteProductoSchema
>;
