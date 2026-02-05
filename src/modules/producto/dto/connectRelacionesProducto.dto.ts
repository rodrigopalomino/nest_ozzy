// src/producto/dto/connectRelacionesProducto.dto.ts
import { ArrayUnique, IsArray, IsOptional, IsString } from 'class-validator';

export class ConnectRelacionesProductoDto {
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  categoriaIds?: number[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  coleccionIds?: number[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  insigniaIds?: number[];
}
