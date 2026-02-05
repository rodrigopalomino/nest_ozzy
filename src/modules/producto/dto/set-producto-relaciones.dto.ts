// src/modules/producto/dto/set-producto-relaciones.dto.ts
import { IsArray, IsOptional, IsUUID } from 'class-validator';

export class SetProductoRelacionesDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  categoriaIds?: number[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  coleccionIds?: number[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  insigniaIds?: number[];
}
