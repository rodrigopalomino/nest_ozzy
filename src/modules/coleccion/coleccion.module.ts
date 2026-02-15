import { Module } from '@nestjs/common';
import { ColeccionController } from './coleccion.controller';
import { ColeccionService } from './coleccion.service';
import { ColeccionImagenService } from './coleccion-imagen.service';

@Module({
  controllers: [ColeccionController],
  providers: [ColeccionService, ColeccionImagenService],
})
export class ColeccionModule {}
