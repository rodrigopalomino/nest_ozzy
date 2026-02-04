// src/color/dto/create-color.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class CreateColorDto {
  @IsString()
  nombre!: string;

  @IsOptional()
  @IsString()
  hex?: string;
}
