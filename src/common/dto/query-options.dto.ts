//* src/common/dto/query-options.dto.ts

import { createZodDto } from 'nestjs-zod';
import { QueryOptionsSchema } from '../schema/query-options.schema';

// ===================================================================================
// DTO de los parámetros de consulta.
//
// Los controllers deben tipar @Query() con ESTA clase, no con el tipo
// inferido del schema: un `type` se borra al compilar y ZodValidationPipe
// se queda sin esquema, así que el query llegaría sin validar (page/limit
// sin tope, filtros sin coerción).
// ===================================================================================
export class QueryOptionsDto extends createZodDto(QueryOptionsSchema) {}
