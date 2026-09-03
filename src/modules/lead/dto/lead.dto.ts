//* src/modules/lead/dto/lead.dto.ts

import { createZodDto } from 'nestjs-zod';
import {
  ActualizarLeadSchema,
  EnlaceWhatsappSchema,
} from '../schema/createLead.schema';

export class ActualizarLeadDto extends createZodDto(ActualizarLeadSchema) {}
export class EnlaceWhatsappDto extends createZodDto(EnlaceWhatsappSchema) {}
