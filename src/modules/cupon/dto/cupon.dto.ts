//* src/modules/cupon/dto/cupon.dto.ts

import { createZodDto } from 'nestjs-zod';
import {
  ActualizarCuponSchema,
  CrearCuponSchema,
} from '../schema/cupon.schema';

export class CrearCuponDto extends createZodDto(CrearCuponSchema) {}
export class ActualizarCuponDto extends createZodDto(ActualizarCuponSchema) {}
