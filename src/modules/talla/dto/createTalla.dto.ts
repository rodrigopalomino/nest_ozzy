// src/color/dto/create-color.dto.ts
import { IsString } from 'class-validator';

export class CreateTallaDto {
  @IsString()
  etiqueta!: string;
}
