//* src/modules/producto-admin/producto-admin.controller.ts

import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Header,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { ProductoAdminService } from './producto-admin.service';
import { ExportacionService } from './exportacion.service';
import {
  AccionLoteDto,
  CrearProductoCompletoDto,
  DuplicarProductoDto,
  GuiaTallasDto,
  RelacionadosCuradosDto,
  ReordenarProductosDto,
} from './dto/producto-admin.dto';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

// ===================================================================================
// Operaciones de catálogo en volumen: alta completa, duplicado, lotes,
// CSV y feeds de publicidad.
// ===================================================================================
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
@Controller('admin/producto')
export class ProductoAdminController {
  constructor(
    private readonly servicio: ProductoAdminService,
    private readonly exportacion: ExportacionService,
  ) {}

  // ===================================================================================
  // Alta atómica: producto, precio, variantes y relaciones en una sola
  // transacción.
  @Post('completo')
  crearCompleto(@Body() dto: CrearProductoCompletoDto) {
    return this.servicio.crearCompleto(dto);
  }

  // ===================================================================================
  @Post(':id/duplicar')
  duplicar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DuplicarProductoDto,
  ) {
    return this.servicio.duplicar(id, dto);
  }

  // ===================================================================================
  @Patch('lote')
  accionEnLote(@Body() dto: AccionLoteDto) {
    return this.servicio.accionEnLote(dto);
  }

  // ===================================================================================
  @Patch('orden')
  reordenar(@Body() dto: ReordenarProductosDto) {
    return this.servicio.reordenar(dto);
  }

  // ===================================================================================
  @Patch(':id/relacionados')
  relacionados(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RelacionadosCuradosDto,
  ) {
    return this.servicio.fijarRelacionados(id, dto);
  }

  // ===================================================================================
  // Guía de tallas: por producto (una) o por categoría (varias).
  @Post('guia-tallas')
  guardarGuia(@Body() dto: GuiaTallasDto) {
    return this.servicio.guardarGuiaTallas(dto);
  }

  // ===================================================================================
  @Delete('guia-tallas/:id')
  eliminarGuia(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.eliminarGuiaTallas(id);
  }

  // ===================================================================================
  // Exportación en CSV: una fila por variante.
  @Get('exportar')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="productos.csv"')
  exportar() {
    return this.exportacion.exportarCsv();
  }

  // ===================================================================================
  // Importación. Por defecto simula: hay que pasar simular=false para que
  // escriba de verdad.
  @Post('importar')
  importar(
    @Body() body: { contenido: string },
    @Query('simular', new DefaultValuePipe(true), ParseBoolPipe)
    simular: boolean,
  ) {
    return this.exportacion.importarCsv(body.contenido ?? '', simular);
  }

  // ===================================================================================
  // Feed para Google Merchant, Instagram y WhatsApp Business.
  @Get('feed')
  @Header('Cache-Control', 'public, max-age=3600')
  feed(@Query('formato') formato?: string) {
    return this.exportacion.feedMerchant(formato === 'xml' ? 'xml' : 'csv');
  }
}
