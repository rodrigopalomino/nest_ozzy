import { Module } from '@nestjs/common';
import { ColeccionController } from './coleccion.controller';
import { ColeccionService } from './coleccion.service';

@Module({
  controllers: [ColeccionController],
  providers: [ColeccionService],
})
export class ColeccionModule {}
