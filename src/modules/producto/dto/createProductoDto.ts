// src/modules/productos/dto/admin-create-producto.dto.ts
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  IsNumber,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { EstadoProducto } from '@prisma/client';

export class CreateProductoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(220)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'slug inválido. Usa minúsculas, números y guiones. Ej: casaca-oversize',
  })
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcion?: string | null;

  @IsOptional()
  @IsEnum(EstadoProducto)
  estado?: EstadoProducto;

  @Transform(({ value }) => {
    // permite: null, "", "129.90", "129,90", 129.9
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
      const v = value.trim();
      if (v === '') return null;
      const n = Number(v.replace(',', '.'));
      return Number.isFinite(n) ? n : value;
    }
    return value;
  })
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'precioBase debe ser numérico (máx 2 decimales)' },
  )
  precioBase?: number | null;
}
