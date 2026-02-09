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
import { InsigniaService } from './insignia.service';
import { CreateInsigniaDto } from './dto/createInsignia.dto';
import { UpdateInsigniaDto } from './dto/updateInsignia.dto';

@Controller('insignia')
export class InsigniaController {
  // ===================================================================================
  constructor(private readonly insigniaService: InsigniaService) {}

  // ===================================================================================
  @Get()
  getCategorias(@Query() options: QueryOptionsSchemaType) {
    return this.insigniaService.getInsignias(options);
  }

  // ===================================================================================
  @Post()
  createCategoria(@Body() dto: CreateInsigniaDto) {
    return this.insigniaService.createInsignia(dto);
  }

  // ===================================================================================
  @Patch(':id')
  updateCategoria(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInsigniaDto,
  ) {
    return this.insigniaService.updateInsignia(id, dto);
  }
}
