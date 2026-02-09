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
import { TallaService } from './talla.service';
import { UpdateTallaDto } from './dto/updateTalla.dto';
import { CreateTallaDto } from './dto/createTalla.dto';

@Controller('talla')
export class TallaController {
  // ===================================================================================
  constructor(private readonly tallaService: TallaService) {}

  // ===================================================================================
  @Get()
  getColecciones(@Query() options: QueryOptionsSchemaType) {
    return this.tallaService.getTallas(options);
  }

  // ===================================================================================
  @Post()
  createColeccion(@Body() dto: CreateTallaDto) {
    return this.tallaService.createTalla(dto);
  }

  // ===================================================================================
  @Patch(':id')
  updateColeccion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTallaDto,
  ) {
    return this.tallaService.updateTalla(id, dto);
  }
}
