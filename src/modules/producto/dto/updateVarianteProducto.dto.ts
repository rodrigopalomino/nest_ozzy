// src/producto/dto/updateVarianteProducto.dto.ts
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateVarianteProductoDto {
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
  sku?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  precio?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
