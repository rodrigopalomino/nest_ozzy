//* src/modules/notificacion/notificacion.controller.ts

import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RolUsuario } from '@prisma/client';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { NotificacionService } from './notificacion.service';
import { QueryOptionsDto } from 'src/common/dto/query-options.dto';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

// ===================================================================================
const DifundirSchema = z.object({
  titulo: z.string().trim().min(3).max(150),
  mensaje: z.string().trim().min(10).max(4000),
  enlace: z.string().trim().url().optional(),
});

class DifundirDto extends createZodDto(DifundirSchema) {}

// ===================================================================================
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RolUsuario.ADMIN)
@Controller('admin/notificacion')
export class NotificacionController {
  constructor(private readonly servicio: NotificacionService) {}

  // ===================================================================================
  @Get()
  listar(@Query() options: QueryOptionsDto) {
    return this.servicio.listar(options);
  }

  // ===================================================================================
  // Difusión a los clientes que aceptaron novedades. Se encola y la envía
  // el cron, para no bloquear la petición con cientos de correos.
  // Recuento previo para la confirmación del panel: no envía nada.
  @Get('destinatarios')
  destinatarios() {
    return this.servicio.destinatariosNovedades();
  }

  // ===================================================================================
  @Post('difundir')
  difundir(@Body() dto: DifundirDto) {
    return this.servicio.difundirNovedades(dto);
  }

  // ===================================================================================
  @Post(':id/reintentar')
  reintentar(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.reintentar(id);
  }

  // ===================================================================================
  // Fuerza el procesado de la cola sin esperar al cron.
  @Post('procesar')
  async procesar() {
    await this.servicio.procesarPendientes();
    return {
      status: 'success',
      message: 'Cola procesada',
      data: null,
      meta: null,
    };
  }
}
