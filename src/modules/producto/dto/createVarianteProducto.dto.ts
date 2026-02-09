import { createZodDto } from 'nestjs-zod';
import { CreateVarianteProductoSchema } from '../schema/createVarianteProducto.schema';

export class CreateVarianteProductoDto extends createZodDto(
  CreateVarianteProductoSchema,
) {}
