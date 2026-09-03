//* src/modules/producto/dto/reordenarImagenes.dto.ts

import { createZodDto } from 'nestjs-zod';
import { ReordenarImagenesSchema } from '../schema/reordenarImagenes.schema';

export class ReordenarImagenesDto extends createZodDto(
  ReordenarImagenesSchema,
) {}
