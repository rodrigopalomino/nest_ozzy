import { createZodDto } from 'nestjs-zod';
import { CreateTallaSchema } from '../schema/createTalla.schema';

export class CreateTallaDto extends createZodDto(CreateTallaSchema) {}
