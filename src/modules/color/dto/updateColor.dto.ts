import { createZodDto } from 'nestjs-zod';
import { UpdateColorSchema } from '../schema/updateColor.shema';

export class UpdateColorDto extends createZodDto(UpdateColorSchema) {}
