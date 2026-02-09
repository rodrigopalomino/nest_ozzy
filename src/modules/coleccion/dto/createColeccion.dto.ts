import { createZodDto } from 'nestjs-zod';
import { CreateColeccionSchema } from '../schema/createColeccion.schema';

export class CreateCategoriaDto extends createZodDto(CreateColeccionSchema) {}
