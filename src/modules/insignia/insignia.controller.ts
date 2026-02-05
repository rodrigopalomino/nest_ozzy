import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { InsigniaService } from './insignia.service';
import { QueryOptionsSchemaType } from 'src/common/schema/query-options.schema';
import { CreateInsigniaDto } from './dto/createInsignia.dto';

@Controller('talla')
export class InsigniaController {
  // ===================================================================================
  constructor(private readonly insigniaService: InsigniaService) {}

  // ===================================================================================
  @Get()
  getTallas(@Query() options: QueryOptionsSchemaType) {
    return this.insigniaService.getInsignias(options);
  }

  // ===================================================================================
  @Post()
  createTalla(@Body() dto: CreateInsigniaDto) {
    return this.insigniaService.createInsignia(dto);
  }
}
