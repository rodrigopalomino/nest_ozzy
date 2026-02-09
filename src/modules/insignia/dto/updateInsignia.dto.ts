import { createZodDto } from 'nestjs-zod';
import { updateInsigniaSchema } from '../schema/updateInsignia.shema';

export class UpdateInsigniaDto extends createZodDto(updateInsigniaSchema) {}
