// src/producto/producto.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { EstadoProducto } from '@prisma/client';
import { ProductoService } from './producto.service';
import { CreateProductoDto } from './dto/createProductoDto';
import { UpdatePrecioProductoDto } from './dto/updatePrecioProducto.dto';
import { CreateVideoProductoDto } from './dto/createVideoProducto.dto';
import { UpdateVideoProductoDto } from './dto/updateVideoProducto.dto';
import { CreateVarianteProductoDto } from './dto/createVarianteProducto.dto';
import { UpdateVarianteProductoDto } from './dto/updateVarianteProducto.dto';
import { ConnectRelacionesProductoDto } from './dto/connectRelacionesProducto.dto';
import { DisconnectRelacionesProductoDto } from './dto/disconnectRelacionesProducto.dto';
import { SetProductoRelacionesDto } from './dto/set-producto-relaciones.dto';

// ⛔️ Por ahora NO lo usas. Luego lo activas.
// import { AuthGuard } from 'src/auth/auth.guard';

@Controller()
export class ProductoController {
  constructor(private readonly productoService: ProductoService) {}

  // @UseGuards(AuthGuard)
  @Get('producto')
  async getProductos(
    @Query('q') q?: string,
    @Query('estado') estado?: EstadoProducto,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.productoService.getProductos({
      q,
      estado,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('producto')
  async adminCreate(@Body() body: CreateProductoDto) {
    return this.productoService.createProducto(body);
  }

  // ===================================================================================
  @Put('producto/:id/precio')
  upsertPrecio(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePrecioProductoDto,
  ) {
    return this.productoService.upsertPrecioProducto(id, dto);
  }

  @Delete('producto/:id/precio')
  deletePrecio(@Param('id', ParseIntPipe) id: number) {
    return this.productoService.deletePrecioProducto(id);
  }

  @Get('producto/:id')
  async getProducto(@Param('id', ParseIntPipe) id: number) {
    return this.productoService.getProducto(id);
  }

  // ===================================================================================
  // ✅ Crear video
  @Post('producto/:id/videos')
  createVideo(
    @Param('id', ParseIntPipe) productoId: number,
    @Body() dto: CreateVideoProductoDto,
  ) {
    return this.productoService.createVideoProducto(productoId, dto);
  }

  // ✅ Editar video
  @Put('producto/:id/videos/:videoId')
  updateVideo(
    @Param('id') productoId: number,
    @Param('videoId') videoId: number,
    @Body() dto: UpdateVideoProductoDto,
  ) {
    return this.productoService.updateVideoProducto(productoId, videoId, dto);
  }

  // ✅ Eliminar video
  @Delete('producto/:id/videos/:videoId')
  deleteVideo(
    @Param('id', ParseIntPipe) productoId: number,
    @Param('videoId', ParseIntPipe) videoId: number,
  ) {
    return this.productoService.deleteVideoProducto(productoId, videoId);
  }

  // ✅ Crear variante
  @Post('producto/:id/variantes')
  createVariante(
    @Param('id', ParseIntPipe) productoId: number,
    @Body() dto: CreateVarianteProductoDto,
  ) {
    return this.productoService.createVarianteProducto(productoId, dto);
  }

  // ✅ Editar variante
  @Put('producto/:id/variantes/:varianteId')
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

  // ✅ Eliminar variante
  @Delete('producto/:id/variantes/:varianteId')
  deleteVariante(
    @Param('id', ParseIntPipe) productoId: number,
    @Param('varianteId', ParseIntPipe) varianteId: number,
  ) {
    return this.productoService.deleteVarianteProducto(productoId, varianteId);
  }

  // ✅ REEMPLAZA TODO (SET)
  @Put('producto/:id/relaciones')
  setRelaciones(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetProductoRelacionesDto,
  ) {
    return this.productoService.setRelacionesProducto(id, dto);
  }

  // ✅ "CREAR" relaciones = CONECTAR (ADD)
  @Put('producto/:id/relaciones/connect')
  connectRelaciones(
    @Param('id', ParseIntPipe) productoId: number,
    @Body() dto: ConnectRelacionesProductoDto,
  ) {
    return this.productoService.connectRelacionesProducto(productoId, dto);
  }

  // ✅ "ELIMINAR" relaciones = DESCONECTAR (REMOVE)
  @Put('producto/:id/relaciones/disconnect')
  disconnectRelaciones(
    @Param('id', ParseIntPipe) productoId: number,
    @Body() dto: DisconnectRelacionesProductoDto,
  ) {
    return this.productoService.disconnectRelacionesProducto(productoId, dto);
  }
}
