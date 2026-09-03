//* src/modules/mantenimiento/mantenimiento.controller.ts

import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseBoolPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { MantenimientoService } from './mantenimiento.service';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

// ===================================================================================
// Operaciones de mantenimiento. Sólo ADMIN: borran archivos y reescriben
// campos calculados.
// ===================================================================================
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN)
@Controller('admin/mantenimiento')
export class MantenimientoController {
  constructor(private readonly servicio: MantenimientoService) {}

  // ===================================================================================
  @Get('huerfanas')
  analizar() {
    return this.servicio.limpiarHuerfanas(false);
  }

  // ===================================================================================
  // Sin ?borrar=true sólo informa: borrar imágenes es irreversible.
  @Post('huerfanas')
  limpiar(
    @Query('borrar', new DefaultValuePipe(false), ParseBoolPipe)
    borrar: boolean,
  ) {
    return this.servicio.limpiarHuerfanas(borrar);
  }

  // ===================================================================================
  @Post('recalcular-precios')
  recalcular() {
    return this.servicio.recalcularPreciosDesde();
  }
}
