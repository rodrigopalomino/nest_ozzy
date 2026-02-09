// src/producto/producto-imagen.controller.ts
import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ProductoImagenService } from './producto-imagen.service';
import { PresignImagenDto } from 'src/modules/minio/dto/presign-imagen.dto';
import { CreateImagenProductoDto } from '../dto/createImagenProducto.dto';

@Controller('admin/producto')
export class ProductoImagenController {
  constructor(private readonly service: ProductoImagenService) {}

  @Post(':id/imagenes/presign')
  presign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PresignImagenDto,
  ) {
    return this.service.presignUpload(id, { filename: dto.filename });
  }

  @Post(':id/imagenes')
  create(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateImagenProductoDto,
  ) {
    return this.service.createImagen(id, dto);
  }

  @Delete(':id/imagenes/:imgId')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Param('imgId', ParseIntPipe) imgId: number,
  ) {
    return this.service.deleteImagen(id, imgId);
  }
}
