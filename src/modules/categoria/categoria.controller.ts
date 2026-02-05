import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { QueryOptionsSchemaType } from 'src/common/schema/query-options.schema';
import { CategoriaService } from './categoria.service';
import { CreateCategoriaDto } from './dto/createCategoria.dto';

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
}
