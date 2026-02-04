import { Module } from '@nestjs/common';
import { TallaController } from './talla.controller';
import { TallaService } from './talla.service';

@Module({
  controllers: [TallaController],
  providers: [TallaService]
})
export class TallaModule {}
