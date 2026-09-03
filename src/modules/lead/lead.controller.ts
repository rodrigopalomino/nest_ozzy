//* src/modules/lead/lead.controller.ts

import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RolUsuario } from '@prisma/client';
import type { Request } from 'express';
import { LeadService } from './lead.service';
import { WhatsappService } from './whatsapp.service';
import { CreateLeadDto } from './dto/createLead.dto';
import { ActualizarLeadDto, EnlaceWhatsappDto } from './dto/lead.dto';
import { QueryOptionsDto } from 'src/common/dto/query-options.dto';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller()
export class LeadController {
  constructor(
    private readonly leadService: LeadService,
    private readonly whatsapp: WhatsappService,
  ) {}

  // ===================================================================================
  // Público: devuelve el enlace de wa.me ya armado y registra el lead en la
  // misma llamada.
  //
  // El copy y el número viven en Configuracion, así que cambiarlos no
  // requiere desplegar el front, y ningún lead se pierde por un olvido al
  // llamar a POST /lead.
  @Throttle({ corto: { limit: 20, ttl: 60_000 } })
  @Get('catalogo/producto/:slug/whatsapp')
  enlaceWhatsapp(
    @Param('slug') slug: string,
    @Query() query: EnlaceWhatsappDto,
    @Req() req: Request,
  ) {
    return this.whatsapp.generarEnlace({
      slug,
      varianteId: query.variante_id ?? null,
      origen: query.origen,
      cupon: query.cupon ?? null,
      ip: req.ip ?? null,
    });
  }

  // ===================================================================================
  // Público: registro directo, para los casos en que el front ya tiene el
  // enlace y sólo necesita dejar constancia del contacto.
  @Throttle({ corto: { limit: 10, ttl: 60_000 } })
  @Post('lead')
  registrar(@Body() dto: CreateLeadDto, @Req() req: Request) {
    return this.leadService.registrar({ ...dto, ip: req.ip ?? null });
  }

  // ===================================================================================
  // Administración. Expone teléfonos de clientes, así que exige sesión.
  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Get('lead')
  listar(@Query() options: QueryOptionsDto) {
    return this.leadService.listar(options);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Get('lead/metricas')
  metricas(
    @Query('dias', new DefaultValuePipe(30), ParseIntPipe) dias: number,
  ) {
    return this.leadService.metricas(dias);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Get('lead/embudo')
  embudo(@Query('dias', new DefaultValuePipe(30), ParseIntPipe) dias: number) {
    return this.leadService.embudo(dias);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Get('lead/conversion')
  conversion(
    @Query('limite', new DefaultValuePipe(20), ParseIntPipe) limite: number,
  ) {
    return this.leadService.conversionPorProducto(limite);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Get('lead/:id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.leadService.detalle(id);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Patch('lead/:id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarLeadDto,
  ) {
    return this.leadService.actualizar(id, dto);
  }
}
