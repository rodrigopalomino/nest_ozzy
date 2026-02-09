import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { QueryOptionsSchemaType } from 'src/common/schema/query-options.schema';
import { CategoriaService } from './categoria.service';
import { CreateCategoriaDto } from './dto/createCategoria.dto';
import { UpdateCategoriaDto } from './dto/updateCategoria.dto';

@Controller('categoria')
export class CategoriaController {
  // ===================================================================================
  constructor(private readonly categoriaService: CategoriaService) {}

  // ===================================================================================
  @Get()
  getCategorias(@Query() options: QueryOptionsSchemaType) {
    return this.categoriaService.getCategorias(options);
  }

  // ===================================================================================
  @Post()
  createCategoria(@Body() dto: CreateCategoriaDto) {
    return this.categoriaService.createCategoria(dto);
  }

  // ===================================================================================
  @Patch(':id')
  updateCategoria(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoriaDto,
  ) {
    return this.categoriaService.updateCategoria(id, dto);
  }
}
