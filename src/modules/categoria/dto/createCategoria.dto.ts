import { createZodDto } from 'nestjs-zod';
import { CreateCategoriaSchema } from '../schema/createCategoria.schema';

export class CreateCategoriaDto extends createZodDto(CreateCategoriaSchema) {}
