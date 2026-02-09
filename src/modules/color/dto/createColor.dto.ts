import { createZodDto } from 'nestjs-zod';
import { CreateColorSchema } from '../schema/createColor.schema';

export class CreateColorDto extends createZodDto(CreateColorSchema) {}
