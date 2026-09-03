//* src/modules/configuracion/configuracion.controller.ts

import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { ConfiguracionService } from './configuracion.service';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ActualizarConfiguracionDto } from './schema/configuracion.schema';
import {
  CachePublico,
  CachePublicoInterceptor,
} from 'src/common/interceptors/cache-publico.interceptor';
import { UseInterceptors } from '@nestjs/common';

@Controller()
export class ConfiguracionController {
  constructor(private readonly servicio: ConfiguracionService) {}

  // ===================================================================================
  // Público: sólo las claves marcadas como públicas (número de WhatsApp,
  // redes, horario). Las plantillas internas no salen de aquí.
  @UseInterceptors(CachePublicoInterceptor)
  @CachePublico(300)
  @Get('configuracion')
  publicas() {
    return this.servicio.publicas();
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Get('admin/configuracion')
  listar() {
    return this.servicio.listarAdmin();
  }

  // ===================================================================================
  // Cuerpo libre { clave: valor }: las claves las define el catálogo de
  // configuración, no el cliente.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Patch('admin/configuracion')
  actualizar(@Body() body: ActualizarConfiguracionDto) {
    return this.servicio.actualizar(body);
  }
}
