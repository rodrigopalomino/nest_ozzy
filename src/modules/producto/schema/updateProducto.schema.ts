//* src/modules/producto/schema/updateProducto.schema.ts

import { z } from 'zod';
import { CreateProductoSchema } from './createProducto.schema';

// ===================================================================================
// Update parcial: mismos campos y reglas que en la creación, todos
// opcionales, más los de curaduría y SEO. Al menos uno debe venir.
export const UpdateProductoSchema = CreateProductoSchema.partial()
  .extend({
    destacado: z.boolean().optional(),
    orden: z.coerce.number().int().min(0).optional(),

    metaTitulo: z.string().trim().max(180).nullish(),
    metaDescripcion: z.string().trim().max(400).nullish(),
    ogImagen: z.string().trim().url().max(500).nullish(),

    // Control de concurrencia optimista: si se envía y no coincide con la
    // versión almacenada, el cambio se rechaza en lugar de pisar el de otro
    // administrador.
    version: z.coerce.number().int().min(0).optional(),
  })
  .refine(
    (data) => Object.keys(data).filter((k) => k !== 'version').length > 0,
    { message: 'Debes enviar al menos un campo para actualizar' },
  );

export type UpdateProductoType = z.infer<typeof UpdateProductoSchema>;
