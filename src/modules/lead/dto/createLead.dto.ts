//* src/modules/lead/dto/createLead.dto.ts

import { createZodDto } from 'nestjs-zod';
import { CreateLeadSchema } from '../schema/createLead.schema';

export class CreateLeadDto extends createZodDto(CreateLeadSchema) {}
