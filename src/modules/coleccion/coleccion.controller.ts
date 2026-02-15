import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { QueryOptionsSchemaType } from 'src/common/schema/query-options.schema';
import { CreateCategoriaDto } from './dto/createColeccion.dto';
import { UpdateCategoriaDto } from './dto/updateColeccion.dto';
import { ColeccionService } from './coleccion.service';
import { ColeccionImagenService } from './coleccion-imagen.service';

@Controller('coleccion')
export class ColeccionController {
  // ===================================================================================
  constructor(
    private readonly coleccionService: ColeccionService,
    private readonly coleccionImagenService: ColeccionImagenService,
  ) {}

  // ===================================================================================
  @Get()
  getColecciones(@Query() options: QueryOptionsSchemaType) {
    return this.coleccionService.getColecciones(options);
  }

  // ===================================================================================
  @Post()
  createColeccion(@Body() dto: CreateCategoriaDto) {
    return this.coleccionService.createColeccion(dto);
  }

  // ===================================================================================
  @Patch(':id')
  updateColeccion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoriaDto,
  ) {
    return this.coleccionService.updateColeccion(id, dto);
  }

  // ===================================================================================
  // Imagen Portada - Presign (subida directa a MinIO)
  @Post(':id/imagen/presign')
  presignUploadColeccionImagen(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { filename: string },
  ) {
    return this.coleccionImagenService.presignUpload(id, body);
  }

  // ===================================================================================
  // Imagen Portada - Guardar URL pública en DB (Coleccion.imagenPortada)
  @Patch(':id/imagen')
  setImagenPortada(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { url: string },
  ) {
    return this.coleccionImagenService.setImagenPortada(id, body);
  }

  // ===================================================================================
  // Quitar portada (opcional)
  @Patch(':id/imagen/remove')
  removeImagenPortada(@Param('id', ParseIntPipe) id: number) {
    return this.coleccionImagenService.removeImagenPortada(id);
  }
}
