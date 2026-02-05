// src/producto/dto/disconnectRelacionesProducto.dto.ts
import { ArrayUnique, IsArray, IsOptional, IsString } from 'class-validator';

export class DisconnectRelacionesProductoDto {
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
