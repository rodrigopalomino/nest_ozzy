import { Module } from '@nestjs/common';
import { ColorService } from './color.service';
import { ColorController } from './color.controller';

@Module({
  providers: [ColorService],
  controllers: [ColorController]
})
export class ColorModule {}
