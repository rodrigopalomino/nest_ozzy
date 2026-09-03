//* src/modules/carrito/carrito-admin.controller.ts

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RolUsuario } from '@prisma/client';
import { CarritoService } from './carrito.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { QueryOptionsDto } from 'src/common/dto/query-options.dto';
import { resolveLimit } from 'src/common/utils/prisma-query-builder';

// ===================================================================================
// Carritos abandonados. Va en un controlador aparte del público porque las
// rutas de cliente no llevan sesión de administrador y aquí es obligatoria.
// ===================================================================================

@ApiTags('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
@Controller('admin/carrito')
export class CarritoAdminController {
  constructor(private readonly carrito: CarritoService) {}

  // ===================================================================================
  @Get()
  listar(@Query() options: QueryOptionsDto) {
    return this.carrito.listarAdmin({
      pagina: options.page,
      limite: resolveLimit(options),
    });
  }
}
