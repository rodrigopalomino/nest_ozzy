import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ColorService } from './color.service';
import { QueryOptionsSchemaType } from 'src/common/schema/query-options.schema';
import { CreateColorDto } from './dto/createColor.dto';

// ===================================================================================
@Controller('color')
export class ColorController {
  // ===================================================================================
  constructor(private readonly colorService: ColorService) {}

  // ===================================================================================
  @Get()
  getColores(@Query() options: QueryOptionsSchemaType) {
    return this.colorService.getColores(options);
  }

  // ===================================================================================
  @Post()
  createColor(@Body() dto: CreateColorDto) {
    return this.colorService.createColor(dto);
  }
}
