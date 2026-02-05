import { Module } from '@nestjs/common';
import { ProductoController } from './producto.controller';
import { ProductoService } from './producto.service';
import { ProductoImagenService } from './producto-imagen/producto-imagen.service';
import { ProductoImagenController } from './producto-imagen/producto-imagen.controller';

@Module({
  controllers: [ProductoController, ProductoImagenController],
  providers: [ProductoService, ProductoImagenService],
})
export class ProductoModule {}
