// src/modules/producto/producto.controller.ts
import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AccionAuditoria, RolUsuario } from '@prisma/client';
import { ProductoService } from './producto.service';
import { UpdatePrecioProductoDto } from './dto/updatePrecioProducto.dto';
import { CreateVideoProductoDto } from './dto/createVideoProducto.dto';
import { UpdateVideoProductoDto } from './dto/updateVideoProducto.dto';
import { CreateVarianteProductoDto } from './dto/createVarianteProducto.dto';
import { UpdateVarianteProductoDto } from './dto/updateVarianteProducto.dto';
import { ConnectRelacionesProductoDto } from './dto/connectRelacionesProducto.dto';
import { DisconnectRelacionesProductoDto } from './dto/disconnectRelacionesProducto.dto';
import { SetProductoRelacionesDto } from './dto/set-producto-relaciones.dto';
import { QueryOptionsDto } from 'src/common/dto/query-options.dto';
import { CreateProductoDto } from './dto/createProductoDto';
import { UpdateProductoDto } from './dto/updateProducto.dto';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Auditar } from 'src/common/interceptors/auditoria.interceptor';

// ===================================================================================
// Lectura pública (la consume el catálogo del front).
// Toda escritura exige sesión con rol ADMIN o STAFF.
// ===================================================================================
@Controller('producto')
export class ProductoController {
  constructor(private readonly productoService: ProductoService) {}

  // ===================================================================================
  @Get()
  getProductos(@Query() options: QueryOptionsDto) {
    return this.productoService.getProductos(options);
  }

  // ===================================================================================
  @Get(':producto_id')
  getProducto(
    @Param('producto_id', ParseIntPipe) producto_id: number,
    @Query() options: QueryOptionsDto,
  ) {
    return this.productoService.getProducto(producto_id, options);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('producto', AccionAuditoria.CREAR)
  @Post()
  create(@Body() body: CreateProductoDto) {
    return this.productoService.createProducto(body);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('producto', AccionAuditoria.ACTUALIZAR)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductoDto,
  ) {
    return this.productoService.updateProducto(id, dto);
  }

  // ===================================================================================
  // Papelera: lista lo eliminado y permite recuperarlo. Va antes de las
  // rutas con :id para que "papelera" no se interprete como un id.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Get('papelera/listar')
  papelera() {
    return this.productoService.listarPapelera();
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('producto', AccionAuditoria.CREAR)
  @Post(':id/restaurar')
  restaurar(@Param('id', ParseIntPipe) id: number) {
    return this.productoService.restaurarProducto(id);
  }

  // ===================================================================================
  // Por defecto mueve a la papelera (reversible y conserva los leads).
  // Con ?definitivo=true borra de verdad, y si hay leads exige además
  // ?confirmar=true.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Auditar('producto', AccionAuditoria.ELIMINAR)
  @Delete(':id')
  delete(
    @Param('id', ParseIntPipe) id: number,
    @Query('confirmar', new DefaultValuePipe(false), ParseBoolPipe)
    confirmar: boolean,
    @Query('definitivo', new DefaultValuePipe(false), ParseBoolPipe)
    definitivo: boolean,
  ) {
    return this.productoService.deleteProducto(id, { confirmar, definitivo });
  }

  // ===================================================================================
  // Precio / oferta
  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('producto', AccionAuditoria.ACTUALIZAR)
  @Put(':id/precio')
  upsertPrecio(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePrecioProductoDto,
  ) {
    return this.productoService.upsertPrecioProducto(id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('producto', AccionAuditoria.ELIMINAR)
  @Delete(':id/precio')
  deletePrecio(@Param('id', ParseIntPipe) id: number) {
    return this.productoService.deletePrecioProducto(id);
  }

  // ===================================================================================
  // Videos
  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('producto', AccionAuditoria.CREAR)
  @Post(':id/videos')
  createVideo(
    @Param('id', ParseIntPipe) productoId: number,
    @Body() dto: CreateVideoProductoDto,
  ) {
    return this.productoService.createVideoProducto(productoId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('producto', AccionAuditoria.ACTUALIZAR)
  @Put(':id/videos/:videoId')
  updateVideo(
    @Param('id', ParseIntPipe) productoId: number,
    @Param('videoId', ParseIntPipe) videoId: number,
    @Body() dto: UpdateVideoProductoDto,
  ) {
    return this.productoService.updateVideoProducto(productoId, videoId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('producto', AccionAuditoria.ELIMINAR)
  @Delete(':id/videos/:videoId')
  deleteVideo(
    @Param('id', ParseIntPipe) productoId: number,
    @Param('videoId', ParseIntPipe) videoId: number,
  ) {
    return this.productoService.deleteVideoProducto(productoId, videoId);
  }

  // ===================================================================================
  // Variantes
  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('producto', AccionAuditoria.CREAR)
  @Post(':id/variantes')
  createVariante(
    @Param('id', ParseIntPipe) productoId: number,
    @Body() dto: CreateVarianteProductoDto,
  ) {
    return this.productoService.createVarianteProducto(productoId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('producto', AccionAuditoria.ACTUALIZAR)
  @Put(':id/variantes/:varianteId')
  updateVariante(
    @Param('id', ParseIntPipe) productoId: number,
    @Param('varianteId', ParseIntPipe) varianteId: number,
    @Body() dto: UpdateVarianteProductoDto,
  ) {
    return this.productoService.updateVarianteProducto(
      productoId,
      varianteId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('producto', AccionAuditoria.ELIMINAR)
  @Delete(':id/variantes/:varianteId')
  deleteVariante(
    @Param('id', ParseIntPipe) productoId: number,
    @Param('varianteId', ParseIntPipe) varianteId: number,
  ) {
    return this.productoService.deleteVarianteProducto(productoId, varianteId);
  }

  // ===================================================================================
  // Relaciones (categorías / colecciones / insignias)
  // ===================================================================================

  // Reemplaza todo el set de relaciones
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('producto', AccionAuditoria.ACTUALIZAR)
  @Put(':id/relaciones')
  setRelaciones(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetProductoRelacionesDto,
  ) {
    return this.productoService.setRelacionesProducto(id, dto);
  }

  // Añade relaciones
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('producto', AccionAuditoria.ACTUALIZAR)
  @Put(':id/relaciones/connect')
  connectRelaciones(
    @Param('id', ParseIntPipe) productoId: number,
    @Body() dto: ConnectRelacionesProductoDto,
  ) {
    return this.productoService.connectRelacionesProducto(productoId, dto);
  }

  // Quita relaciones
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('producto', AccionAuditoria.ACTUALIZAR)
  @Put(':id/relaciones/disconnect')
  disconnectRelaciones(
    @Param('id', ParseIntPipe) productoId: number,
    @Body() dto: DisconnectRelacionesProductoDto,
  ) {
    return this.productoService.disconnectRelacionesProducto(productoId, dto);
  }
}
