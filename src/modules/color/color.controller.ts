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
import { ColorService } from './color.service';
import { CreateColorDto } from './dto/createColor.dto';
import { UpdateColorDto } from './dto/updateColor.dto';

@Controller('color')
export class ColorController {
  // ===================================================================================
  constructor(private readonly colorService: ColorService) {}

  // ===================================================================================
  @Get()
  getColecciones(@Query() options: QueryOptionsDto) {
    return this.colorService.getColors(options);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('color', AccionAuditoria.CREAR)
  @Post()
  createColeccion(@Body() dto: CreateColorDto) {
    return this.colorService.createColor(dto);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('color', AccionAuditoria.ACTUALIZAR)
  @Patch(':id')
  updateColeccion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateColorDto,
  ) {
    return this.colorService.updateColor(id, dto);
  }
  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Auditar('color', AccionAuditoria.ELIMINAR)
  @Delete(':id')
  deleteColor(@Param('id', ParseIntPipe) id: number) {
    return this.colorService.deleteColor(id);
  }
}
