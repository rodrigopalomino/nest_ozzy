//* src/modules/cupon/schema/cupon.schema.ts

import { z } from 'zod';
import { fechaIsoNullish } from 'src/common/schema/fecha.schema';

// ===================================================================================
// Se declara como cadena ISO para que la documentación OpenAPI pueda
// representarla; la transformación a Date la hace el propio esquema.
const fechaOpcional = fechaIsoNullish;

// El descuento es porcentual o de importe fijo, nunca los dos: si se
// admitieran juntos habría que decidir un orden de aplicación arbitrario.
const baseCupon = {
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .min(3)
    .max(40)
    .regex(/^[A-Z0-9-]+$/, 'Sólo letras, números y guiones'),
  porcentaje: z.coerce.number().int().min(1).max(100).nullish(),
  montoFijo: z.coerce.number().min(0.01).nullish(),
  iniciaEn: fechaOpcional,
  terminaEn: fechaOpcional,
  usoMaximo: z.coerce.number().int().min(1).nullish(),
  activo: z.boolean().optional(),
};

// ===================================================================================
function validarDescuento(
  d: { porcentaje?: number | null; montoFijo?: number | null },
  ctx: z.RefinementCtx,
) {
  const tienePorcentaje = d.porcentaje != null;
  const tieneMonto = d.montoFijo != null;

  if (tienePorcentaje && tieneMonto) {
    ctx.addIssue({
      code: 'custom',
      path: ['porcentaje'],
      message: 'Usa porcentaje o montoFijo, no ambos',
    });
  }
}

// ===================================================================================
function validarVentana(
  d: { iniciaEn?: string | null; terminaEn?: string | null },
  ctx: z.RefinementCtx,
) {
  if (
    d.iniciaEn &&
    d.terminaEn &&
    Date.parse(d.iniciaEn) > Date.parse(d.terminaEn)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['terminaEn'],
      message: 'La fecha de fin debe ser posterior a la de inicio',
    });
  }
}

// ===================================================================================
export const CrearCuponSchema = z.object(baseCupon).superRefine((d, ctx) => {
  validarDescuento(d, ctx);
  validarVentana(d, ctx);

  // Al crear hay que indicar un descuento; al actualizar puede omitirse.
  if (d.porcentaje == null && d.montoFijo == null) {
    ctx.addIssue({
      code: 'custom',
      path: ['porcentaje'],
      message: 'Indica un porcentaje o un monto fijo',
    });
  }
});

export type CrearCuponType = z.infer<typeof CrearCuponSchema>;

// ===================================================================================
export const ActualizarCuponSchema = z
  .object(baseCupon)
  .partial()
  .superRefine((d, ctx) => {
    validarDescuento(d, ctx);
    validarVentana(d, ctx);

    if (Object.keys(d).length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: [],
        message: 'Envía al menos un campo para actualizar',
      });
    }
  });

export type ActualizarCuponType = z.infer<typeof ActualizarCuponSchema>;
