//* src/modules/lead/schema/createLead.schema.ts

import { EstadoLead, OrigenLead } from '@prisma/client';
import z from 'zod';

// ===================================================================================
// Endpoint público: la validación es estricta porque cualquiera puede llamarlo.
export const CreateLeadSchema = z.object({
  producto_id: z.coerce.number().int().positive(),

  // Variante concreta que el visitante tenía seleccionada, si la había.
  variante_id: z.coerce.number().int().positive().nullish(),

  // Teléfono opcional: muchos leads salen sin que el visitante lo escriba.
  telefono: z
    .string()
    .trim()
    .min(6)
    .max(20)
    .regex(/^[+0-9()\s-]+$/, 'Teléfono inválido')
    .nullish(),

  mensaje: z.string().trim().min(1).max(1000),

  origen: z.enum(OrigenLead).default(OrigenLead.DETALLE_PRODUCTO),

  // Código de cupón que el visitante tenía aplicado, si lo había.
  cupon: z.string().trim().max(40).nullish(),
});

export type CreateLeadType = z.infer<typeof CreateLeadSchema>;

// ===================================================================================
// Seguimiento comercial del lead desde el panel.
export const ActualizarLeadSchema = z
  .object({
    estado: z.enum(EstadoLead).optional(),
    nota: z.string().trim().max(2000).nullish(),
    telefono: z.string().trim().max(20).nullish(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Envía al menos un campo para actualizar',
  });

export type ActualizarLeadType = z.infer<typeof ActualizarLeadSchema>;

// ===================================================================================
// Parámetros del enlace de WhatsApp generado por el servidor.
export const EnlaceWhatsappSchema = z.object({
  variante_id: z.coerce.number().int().positive().nullish(),
  origen: z.enum(OrigenLead).optional(),
  cupon: z.string().trim().max(40).nullish(),
});

export type EnlaceWhatsappType = z.infer<typeof EnlaceWhatsappSchema>;
