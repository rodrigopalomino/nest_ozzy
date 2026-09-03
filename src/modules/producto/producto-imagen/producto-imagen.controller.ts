// src/modules/producto/producto-imagen/producto-imagen.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TAMANO_MAXIMO_IMAGEN } from 'src/modules/minio/minio.constants';
import { RolUsuario } from '@prisma/client';
import { ProductoImagenService } from './producto-imagen.service';
import { PresignImagenDto } from 'src/modules/minio/dto/presign-imagen.dto';
import { CreateImagenProductoDto } from '../dto/createImagenProducto.dto';
import { ReordenarImagenesDto } from '../dto/reordenarImagenes.dto';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

// ===================================================================================
// Gestión de la galería. Todo exige sesión: los presign permiten escribir
// en el bucket de MinIO.
// ===================================================================================
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
@Controller('admin/producto')
export class ProductoImagenController {
  constructor(private readonly service: ProductoImagenService) {}

  // ===================================================================================
  // Subida directa recomendada: el archivo llega aquí, se generan las
  // miniaturas WebP y el placeholder, y se guarda todo en un paso.
  @Post(':id/imagenes/upload')
  @UseInterceptors(
    FileInterceptor('archivo', {
      limits: { fileSize: TAMANO_MAXIMO_IMAGEN, files: 1 },
    }),
  )
  upload(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @Body()
    body: {
      alt?: string;
      color_id?: string;
      esPrincipal?: string;
      esHover?: string;
    },
  ) {
    if (!archivo) {
      throw new BadRequestException(
        'Envía el archivo en el campo "archivo" (multipart/form-data)',
      );
    }

    // En multipart todo llega como texto: se normaliza aquí.
    return this.service.subirImagen(id, archivo, {
      alt: body.alt?.trim() || null,
      color_id: body.color_id ? Number(body.color_id) : null,
      esPrincipal: body.esPrincipal === 'true' || body.esPrincipal === '1',
      esHover: body.esHover === 'true' || body.esHover === '1',
    });
  }

  // ===================================================================================
  // Presign: se mantiene por compatibilidad, pero sirve el original sin
  // optimizar. Prefiere /upload.
  @Post(':id/imagenes/presign')
  presign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PresignImagenDto,
  ) {
    return this.service.presignUpload(id, {
      filename: dto.filename,
      contentType: dto.contentType,
    });
  }

  // ===================================================================================
  // `color_id` en el body asocia la imagen a un color; null = genérica.
  @Post(':id/imagenes')
  create(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateImagenProductoDto,
  ) {
    return this.service.createImagen(id, dto);
  }

  // ===================================================================================
  // Reordenar la galería (drag & drop en el admin).
  @Patch(':id/imagenes/orden')
  reordenar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReordenarImagenesDto,
  ) {
    return this.service.reordenarImagenes(id, dto.imagenIds);
  }

  // ===================================================================================
  @Patch(':id/imagenes/:imgId/principal')
  marcarPrincipal(
    @Param('id', ParseIntPipe) id: number,
    @Param('imgId', ParseIntPipe) imgId: number,
  ) {
    return this.service.marcarImagen(id, imgId, 'esPrincipal');
  }

  // ===================================================================================
  @Patch(':id/imagenes/:imgId/hover')
  marcarHover(
    @Param('id', ParseIntPipe) id: number,
    @Param('imgId', ParseIntPipe) imgId: number,
  ) {
    return this.service.marcarImagen(id, imgId, 'esHover');
  }

  // ===================================================================================
  // Mover la imagen a la galería de otro color (o dejarla genérica).
  @Patch(':id/imagenes/:imgId/color')
  asignarColor(
    @Param('id', ParseIntPipe) id: number,
    @Param('imgId', ParseIntPipe) imgId: number,
    @Body() body: { color_id: number | null },
  ) {
    return this.service.asignarColor(id, imgId, body.color_id ?? null);
  }

  // ===================================================================================
  @Delete(':id/imagenes/:imgId')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Param('imgId', ParseIntPipe) imgId: number,
  ) {
    return this.service.deleteImagen(id, imgId);
  }
}
