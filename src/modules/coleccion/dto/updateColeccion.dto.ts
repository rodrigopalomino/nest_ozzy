import { createZodDto } from 'nestjs-zod';
import { UpdateColeccionSchema } from '../schema/updateColeccion.shema';

export class UpdateCategoriaDto extends createZodDto(UpdateColeccionSchema) {}
