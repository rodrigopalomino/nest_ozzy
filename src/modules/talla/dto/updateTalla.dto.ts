import { createZodDto } from 'nestjs-zod';
import { UpdateTallaSchema } from '../schema/updateTalla.shema';

export class UpdateTallaDto extends createZodDto(UpdateTallaSchema) {}
