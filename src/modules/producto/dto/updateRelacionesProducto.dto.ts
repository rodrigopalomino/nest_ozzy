// src/producto/dto/updateRelacionesProducto.dto.ts
import { ArrayUnique, IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateRelacionesProductoDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  categoriaIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  coleccionIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  insigniaIds?: string[];
}
