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
import { ColorService } from './color.service';
import { CreateColorDto } from './dto/createColor.dto';
import { UpdateColorDto } from './dto/updateColor.dto';

@Controller('color')
export class ColorController {
  // ===================================================================================
  constructor(private readonly colorService: ColorService) {}

  // ===================================================================================
  @Get()
  getColecciones(@Query() options: QueryOptionsSchemaType) {
    return this.colorService.getColors(options);
  }

  // ===================================================================================
  @Post()
  createColeccion(@Body() dto: CreateColorDto) {
    return this.colorService.createColor(dto);
  }

  // ===================================================================================
  @Patch(':id')
  updateColeccion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateColorDto,
  ) {
    return this.colorService.updateColor(id, dto);
  }
}
