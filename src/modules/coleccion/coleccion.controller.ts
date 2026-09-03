import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Auditar } from 'src/common/interceptors/auditoria.interceptor';
import { AccionAuditoria, RolUsuario } from '@prisma/client';
import { QueryOptionsDto } from 'src/common/dto/query-options.dto';
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
  getColecciones(@Query() options: QueryOptionsDto) {
    return this.coleccionService.getColecciones(options);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('coleccion', AccionAuditoria.CREAR)
  @Post()
  createColeccion(@Body() dto: CreateCategoriaDto) {
    return this.coleccionService.createColeccion(dto);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('coleccion', AccionAuditoria.ACTUALIZAR)
  @Patch(':id')
  updateColeccion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoriaDto,
  ) {
    return this.coleccionService.updateColeccion(id, dto);
  }

  // ===================================================================================
  // Imagen Portada - Presign (subida directa a MinIO)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('coleccion', AccionAuditoria.CREAR)
  @Post(':id/imagen/presign')
  presignUploadColeccionImagen(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { filename: string },
  ) {
    return this.coleccionImagenService.presignUpload(id, body);
  }

  // ===================================================================================
  // Imagen Portada - Guardar URL pública en DB (Coleccion.imagenPortada)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('coleccion', AccionAuditoria.ACTUALIZAR)
  @Patch(':id/imagen')
  setImagenPortada(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { url: string },
  ) {
    return this.coleccionImagenService.setImagenPortada(id, body);
  }

  // ===================================================================================
  // Quitar portada (opcional)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('coleccion', AccionAuditoria.ACTUALIZAR)
  @Patch(':id/imagen/remove')
  removeImagenPortada(@Param('id', ParseIntPipe) id: number) {
    return this.coleccionImagenService.removeImagenPortada(id);
  }
  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Auditar('coleccion', AccionAuditoria.ELIMINAR)
  @Delete(':id')
  deleteColeccion(@Param('id', ParseIntPipe) id: number) {
    return this.coleccionService.deleteColeccion(id);
  }
}
