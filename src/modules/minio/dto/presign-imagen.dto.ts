// src/producto/dto/presign-imagen.dto.ts
import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class PresignImagenDto {
  @IsString()
  @MinLength(1)
  filename: string;

  @IsString()
  @MinLength(3)
  contentType: string;

  @IsOptional()
  @IsIn(['principal', 'hover', 'galeria'])
  tipo?: 'principal' | 'hover' | 'galeria';
}
