import { Module } from '@nestjs/common';
import { TallaService } from './talla.service';
import { TallaController } from './talla.controller';

@Module({
  controllers: [TallaController],
  providers: [TallaService],
})
export class TallaModule {}
