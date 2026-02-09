import { createZodDto } from 'nestjs-zod';
import { SetProductoRelacionesSchema } from '../schema/set-producto-relaciones.schema';

export class SetProductoRelacionesDto extends createZodDto(
  SetProductoRelacionesSchema,
) {}
