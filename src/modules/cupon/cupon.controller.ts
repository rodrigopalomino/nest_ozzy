//* src/modules/cupon/cupon.controller.ts

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RolUsuario } from '@prisma/client';
import { CuponService } from './cupon.service';
import { ActualizarCuponDto, CrearCuponDto } from './dto/cupon.dto';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller()
export class CuponController {
  constructor(private readonly servicio: CuponService) {}

  // ===================================================================================
  // Público: valida un código. Limitado para que no se puedan adivinar
  // códigos a fuerza bruta.
  @Throttle({ corto: { limit: 15, ttl: 60_000 } })
  @Get('cupon/:codigo/validar')
  validar(@Param('codigo') codigo: string) {
    return this.servicio.validar(codigo);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Get('admin/cupon')
  listar() {
    return this.servicio.listar();
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Post('admin/cupon')
  crear(@Body() dto: CrearCuponDto) {
    return this.servicio.crear(dto);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Patch('admin/cupon/:id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarCuponDto,
  ) {
    return this.servicio.actualizar(id, dto);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Delete('admin/cupon/:id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.eliminar(id);
  }
}
