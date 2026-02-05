import { Module } from '@nestjs/common';
import { InsigniaController } from './insignia.controller';
import { InsigniaService } from './insignia.service';

@Module({
  controllers: [InsigniaController],
  providers: [InsigniaService],
})
export class InsigniaModule {}
