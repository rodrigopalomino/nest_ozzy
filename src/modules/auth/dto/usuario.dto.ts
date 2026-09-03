//* src/modules/auth/dto/usuario.dto.ts

import { createZodDto } from 'nestjs-zod';
import {
  ActualizarUsuarioSchema,
  CambiarPasswordSchema,
  CrearUsuarioSchema,
  RestablecerPasswordSchema,
} from '../schemas/usuario.schema';

export class CrearUsuarioDto extends createZodDto(CrearUsuarioSchema) {}
export class ActualizarUsuarioDto extends createZodDto(
  ActualizarUsuarioSchema,
) {}
export class CambiarPasswordDto extends createZodDto(CambiarPasswordSchema) {}
export class RestablecerPasswordDto extends createZodDto(
  RestablecerPasswordSchema,
) {}
