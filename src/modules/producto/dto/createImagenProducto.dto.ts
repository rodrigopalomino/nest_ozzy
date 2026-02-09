import { createZodDto } from 'nestjs-zod';
import { CreateImagenProductoSchema } from '../schema/createImagenProducto.schema';

export class CreateImagenProductoDto extends createZodDto(
  CreateImagenProductoSchema,
) {}
