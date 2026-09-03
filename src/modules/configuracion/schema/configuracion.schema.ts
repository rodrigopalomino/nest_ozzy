//* src/modules/configuracion/schema/configuracion.schema.ts

import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { CONFIG_POR_DEFECTO } from '../configuracion.constants';

// ===================================================================================
// Sólo se pueden escribir las claves que la aplicación conoce.
//
// Antes el PATCH recibía un `Record<string, string>` sin validar: además de
// no comprobar tipos, un `upsert` con una clave desconocida la creaba, así
// que la tabla acumulaba basura que nadie leía y un typo pasaba por bueno
// en lugar de avisar.
// ===================================================================================
const CLAVES = CONFIG_POR_DEFECTO.map((c) => c.clave);

// `partialRecord` y no `record`: con `record` Zod 4 exige TODAS las claves
// del enum, así que un PATCH de una sola clave se rechazaba.
export const ActualizarConfiguracionSchema = z
  .partialRecord(
    z.enum(CLAVES as [string, ...string[]]),
    // Los valores se guardan como texto; el significado lo da cada clave.
    z.string().max(2000),
  )
  .refine((valores) => Object.keys(valores).length > 0, {
    message: 'Envía al menos una clave para actualizar',
  });

export class ActualizarConfiguracionDto extends createZodDto(
  ActualizarConfiguracionSchema,
) {}
