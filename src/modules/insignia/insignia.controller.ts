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
import { InsigniaService } from './insignia.service';
import { CreateInsigniaDto } from './dto/createInsignia.dto';
import { UpdateInsigniaDto } from './dto/updateInsignia.dto';

@Controller('insignia')
export class InsigniaController {
  // ===================================================================================
  constructor(private readonly insigniaService: InsigniaService) {}

  // ===================================================================================
  @Get()
  getCategorias(@Query() options: QueryOptionsDto) {
    return this.insigniaService.getInsignias(options);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('insignia', AccionAuditoria.CREAR)
  @Post()
  createCategoria(@Body() dto: CreateInsigniaDto) {
    return this.insigniaService.createInsignia(dto);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('insignia', AccionAuditoria.ACTUALIZAR)
  @Patch(':id')
  updateCategoria(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInsigniaDto,
  ) {
    return this.insigniaService.updateInsignia(id, dto);
  }
  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Auditar('insignia', AccionAuditoria.ELIMINAR)
  @Delete(':id')
  deleteInsignia(@Param('id', ParseIntPipe) id: number) {
    return this.insigniaService.deleteInsignia(id);
  }
}
