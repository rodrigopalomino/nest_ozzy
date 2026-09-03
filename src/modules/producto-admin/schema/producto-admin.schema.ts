//* src/modules/producto-admin/schema/producto-admin.schema.ts

import { EstadoProducto } from '@prisma/client';
import { z } from 'zod';
import { fechaIsoNullish } from 'src/common/schema/fecha.schema';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ===================================================================================
// Alta completa en una sola transacción: producto, precio, variantes e
// imágenes. Evita quedarse con un producto a medias si falla una de las
// llamadas sueltas.
export const CrearProductoCompletoSchema = z.object({
  nombre: z.string().trim().min(1).max(180),
  slug: z.string().trim().min(1).max(220).regex(SLUG_REGEX, {
    message: 'slug inválido. Usa minúsculas, números y guiones',
  }),
  descripcion: z.string().trim().max(5000).nullish(),
  estado: z.enum(EstadoProducto).optional(),
  precioBase: z.coerce.number().min(0).nullish(),
  destacado: z.boolean().optional(),

  metaTitulo: z.string().trim().max(180).nullish(),
  metaDescripcion: z.string().trim().max(400).nullish(),

  precio: z
    .object({
      precioOriginal: z.coerce.number().positive(),
      porcentajeDescuento: z.coerce.number().int().min(0).max(100).optional(),
      precioOferta: z.coerce.number().min(0).nullish(),
      iniciaEn: fechaIsoNullish,
      terminaEn: fechaIsoNullish,
      activo: z.boolean().optional(),
    })
    .optional(),

  variantes: z
    .array(
      z.object({
        talla_id: z.coerce.number().int().positive(),
        color_id: z.coerce.number().int().positive(),
        sku: z.string().trim().max(60).nullish(),
        precio: z.coerce.number().min(0).nullish(),
        stock: z.coerce.number().int().min(0).nullish(),
        activo: z.boolean().optional(),
      }),
    )
    .max(200)
    .optional(),

  categoriaIds: z.array(z.coerce.number().int().positive()).max(50).optional(),
  coleccionIds: z.array(z.coerce.number().int().positive()).max(50).optional(),
  insigniaIds: z.array(z.coerce.number().int().positive()).max(50).optional(),
});

export type CrearProductoCompletoType = z.infer<
  typeof CrearProductoCompletoSchema
>;

// ===================================================================================
// Acciones en lote: cambiar estado, destacado o precio de varios productos.
export const AccionLoteSchema = z
  .object({
    productoIds: z
      .array(z.coerce.number().int().positive())
      .min(1)
      .max(200)
      .refine((ids) => new Set(ids).size === ids.length, {
        message: 'No se admiten ids repetidos',
      }),
    estado: z.enum(EstadoProducto).optional(),
    destacado: z.boolean().optional(),
    // Ajuste porcentual del precio base: -20 baja un 20 %.
    ajustePrecioPorcentaje: z.coerce.number().min(-90).max(500).optional(),
  })
  .refine(
    (d) =>
      d.estado !== undefined ||
      d.destacado !== undefined ||
      d.ajustePrecioPorcentaje !== undefined,
    { message: 'Indica al menos una acción a aplicar' },
  );

export type AccionLoteType = z.infer<typeof AccionLoteSchema>;

// ===================================================================================
export const ReordenarProductosSchema = z.object({
  // Los ids en el orden deseado; el campo `orden` se reasigna desde 0.
  productoIds: z
    .array(z.coerce.number().int().positive())
    .min(1)
    .max(500)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'No se admiten ids repetidos',
    }),
});

export type ReordenarProductosType = z.infer<typeof ReordenarProductosSchema>;

// ===================================================================================
export const DuplicarProductoSchema = z.object({
  nombre: z.string().trim().min(1).max(180).optional(),
  slug: z.string().trim().min(1).max(220).regex(SLUG_REGEX).optional(),
  // Las imágenes se comparten por URL en lugar de recopiarse al bucket.
  copiarImagenes: z.boolean().optional(),
  copiarVariantes: z.boolean().optional(),
});

export type DuplicarProductoType = z.infer<typeof DuplicarProductoSchema>;

// ===================================================================================
export const RelacionadosCuradosSchema = z.object({
  relacionadoIds: z
    .array(z.coerce.number().int().positive())
    .max(24)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: 'No se admiten ids repetidos',
    }),
});

export type RelacionadosCuradosType = z.infer<typeof RelacionadosCuradosSchema>;

// ===================================================================================
export const GuiaTallasSchema = z.object({
  nombre: z.string().trim().min(1).max(120),
  // { columnas: ["Talla","Pecho","Largo"], filas: [["S","96","68"]] }
  datos: z.object({
    columnas: z.array(z.string().trim().min(1)).min(2).max(12),
    filas: z.array(z.array(z.string().trim())).min(1).max(30),
  }),
  nota: z.string().trim().max(600).nullish(),
  categoria_id: z.coerce.number().int().positive().nullish(),
  producto_id: z.coerce.number().int().positive().nullish(),
});

export type GuiaTallasType = z.infer<typeof GuiaTallasSchema>;
