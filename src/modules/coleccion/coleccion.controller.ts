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
import { CreateCategoriaDto } from './dto/createColeccion.dto';
import { UpdateCategoriaDto } from './dto/updateColeccion.dto';
import { ColeccionService } from './coleccion.service';

@Controller('coleccion')
export class ColeccionController {
  // ===================================================================================
  constructor(private readonly coleccionService: ColeccionService) {}

  // ===================================================================================
  @Get()
  getColecciones(@Query() options: QueryOptionsSchemaType) {
    return this.coleccionService.getColecciones(options);
  }

  // ===================================================================================
  @Post()
  createColeccion(@Body() dto: CreateCategoriaDto) {
    return this.coleccionService.createColeccion(dto);
  }

  // ===================================================================================
  @Patch(':id')
  updateColeccion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoriaDto,
  ) {
    return this.coleccionService.updateColeccion(id, dto);
  }
}
