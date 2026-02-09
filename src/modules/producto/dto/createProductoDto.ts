import { createZodDto } from 'nestjs-zod';
import { CreateProductoSchema } from '../schema/createProducto.schema';

export class CreateProductoDto extends createZodDto(CreateProductoSchema) {}
