// src/producto/dto/createVarianteProducto.dto.ts
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateVarianteProductoDto {
  @Type(() => Number)
  @IsInt()
  talla_id: number;

  @IsString()
  @Type(() => Number)
  @IsInt()
  color_id: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  precio?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
