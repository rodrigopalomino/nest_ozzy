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

export class UpdateVideoProductoDto {
  @IsOptional()
  @IsEnum(PlataformaVideo)
  plataforma?: PlataformaVideo;

  @IsOptional()
  @IsString()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  etiqueta?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  orden?: number;
}
