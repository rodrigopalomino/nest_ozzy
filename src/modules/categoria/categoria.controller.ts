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
import { CategoriaService } from './categoria.service';
import { CreateCategoriaDto } from './dto/createCategoria.dto';
import { UpdateCategoriaDto } from './dto/updateCategoria.dto';

@Controller('categoria')
export class CategoriaController {
  // ===================================================================================
  constructor(private readonly categoriaService: CategoriaService) {}

  // ===================================================================================
  @Get()
  getCategorias(@Query() options: QueryOptionsDto) {
    return this.categoriaService.getCategorias(options);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('categoria', AccionAuditoria.CREAR)
  @Post()
  createCategoria(@Body() dto: CreateCategoriaDto) {
    return this.categoriaService.createCategoria(dto);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN, RolUsuario.STAFF)
  @Auditar('categoria', AccionAuditoria.ACTUALIZAR)
  @Patch(':id')
  updateCategoria(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoriaDto,
  ) {
    return this.categoriaService.updateCategoria(id, dto);
  }
  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Auditar('categoria', AccionAuditoria.ELIMINAR)
  @Delete(':id')
  deleteCategoria(@Param('id', ParseIntPipe) id: number) {
    return this.categoriaService.deleteCategoria(id);
  }
}
