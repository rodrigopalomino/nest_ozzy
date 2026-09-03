//* src/modules/producto-admin/dto/producto-admin.dto.ts

import { createZodDto } from 'nestjs-zod';
import {
  AccionLoteSchema,
  CrearProductoCompletoSchema,
  DuplicarProductoSchema,
  GuiaTallasSchema,
  RelacionadosCuradosSchema,
  ReordenarProductosSchema,
} from '../schema/producto-admin.schema';

export class CrearProductoCompletoDto extends createZodDto(
  CrearProductoCompletoSchema,
) {}
export class AccionLoteDto extends createZodDto(AccionLoteSchema) {}
export class ReordenarProductosDto extends createZodDto(
  ReordenarProductosSchema,
) {}
export class DuplicarProductoDto extends createZodDto(DuplicarProductoSchema) {}
export class RelacionadosCuradosDto extends createZodDto(
  RelacionadosCuradosSchema,
) {}
export class GuiaTallasDto extends createZodDto(GuiaTallasSchema) {}
