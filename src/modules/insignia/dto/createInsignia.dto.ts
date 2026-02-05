// src/color/dto/create-color.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateInsigniaDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsString()
  @IsNotEmpty()
  color!: string;
}
