//* src/modules/producto/dto/updateProducto.dto.ts

import { createZodDto } from 'nestjs-zod';
import { UpdateProductoSchema } from '../schema/updateProducto.schema';

export class UpdateProductoDto extends createZodDto(UpdateProductoSchema) {}
