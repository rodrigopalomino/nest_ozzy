// src/producto/dto/create-imagen-producto.dto.ts
import { IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateImagenProductoDto {
  @IsString()
  @MinLength(5)
  url: string;

  @IsOptional()
  @IsString()
  alt?: string | null;

  @IsOptional()
  @IsInt()
  orden?: number;

  @IsOptional()
  @IsIn(['principal', 'hover', 'galeria'])
  tipo?: 'principal' | 'hover' | 'galeria';
}
