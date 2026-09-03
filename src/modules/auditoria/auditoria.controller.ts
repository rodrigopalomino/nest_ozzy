//* src/modules/auditoria/auditoria.controller.ts

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { AuditoriaService } from './auditoria.service';
import { QueryOptionsDto } from 'src/common/dto/query-options.dto';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

// ===================================================================================
// Sólo ADMIN: la bitácora revela qué hizo cada miembro del equipo.
// ===================================================================================
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN)
@Controller('admin/auditoria')
export class AuditoriaController {
  constructor(private readonly servicio: AuditoriaService) {}

  // ===================================================================================
  @Get()
  listar(@Query() options: QueryOptionsDto) {
    return this.servicio.listar(options);
  }
}
