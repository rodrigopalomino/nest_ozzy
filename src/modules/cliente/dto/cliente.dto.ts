//* src/modules/cliente/dto/cliente.dto.ts

import { createZodDto } from 'nestjs-zod';
import {
  AvisoStockSchema,
  FavoritoSchema,
  LoginGoogleSchema,
  PreferenciasClienteSchema,
} from '../schema/cliente.schema';

export class LoginGoogleDto extends createZodDto(LoginGoogleSchema) {}
export class PreferenciasClienteDto extends createZodDto(
  PreferenciasClienteSchema,
) {}
export class FavoritoDto extends createZodDto(FavoritoSchema) {}
export class AvisoStockDto extends createZodDto(AvisoStockSchema) {}
