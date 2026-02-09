import { createZodDto } from 'nestjs-zod';
import { createInsigniaSchema } from '../schema/createInsignia.schema';

export class CreateInsigniaDto extends createZodDto(createInsigniaSchema) {}
