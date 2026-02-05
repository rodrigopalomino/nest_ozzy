import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdatePrecioProductoDto {
  @IsNumber()
  precioOriginal: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  porcentajeDescuento?: number;

  @IsOptional()
  @IsNumber()
  precioOferta?: number | null;

  @IsOptional()
  @IsISO8601()
  iniciaEn?: string | null;

  @IsOptional()
  @IsISO8601()
  terminaEn?: string | null;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
