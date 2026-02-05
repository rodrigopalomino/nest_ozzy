import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { PlataformaVideo } from '@prisma/client';

export class CreateVideoProductoDto {
  @IsEnum(PlataformaVideo)
  plataforma: PlataformaVideo;

  @IsString()
  @IsUrl()
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  etiqueta?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}
