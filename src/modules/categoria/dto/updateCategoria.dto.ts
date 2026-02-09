import { createZodDto } from 'nestjs-zod';
import { UpdateCategoriaSchema } from '../schema/updateCategoria.shema';

export class UpdateCategoriaDto extends createZodDto(UpdateCategoriaSchema) {}
