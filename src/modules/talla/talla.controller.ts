import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/modules/auth/guard/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Auditar } from 'src/common/interceptors/auditoria.interceptor';
import { AccionAuditoria, RolUsuario } from '@prisma/client';
import { QueryOptionsDto } from 'src/common/dto/query-options.dto';
import { TallaService } from './talla.service';
import { UpdateTallaDto } from './dto/updateTalla.dto';
import { CreateTallaDto } from './dto/createTalla.dto';

@Controller('talla')
export class TallaController {
  // ===================================================================================
  constructor(private readonly tallaService: TallaService) {}

  // ===================================================================================
  @Get()
  getColecciones(@Query() options: QueryOptionsDto) {
    return this.tallaService.getTallas(options);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('talla', AccionAuditoria.CREAR)
  @Post()
  createColeccion(@Body() dto: CreateTallaDto) {
    return this.tallaService.createTalla(dto);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('talla', AccionAuditoria.ACTUALIZAR)
  @Patch(':id')
  updateColeccion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTallaDto,
  ) {
    return this.tallaService.updateTalla(id, dto);
  }
  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Auditar('talla', AccionAuditoria.ELIMINAR)
  @Delete(':id')
  deleteTalla(@Param('id', ParseIntPipe) id: number) {
    return this.tallaService.deleteTalla(id);
  }
}
