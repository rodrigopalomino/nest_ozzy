//* src/modules/carrito/carrito.module.ts

import { forwardRef, Module } from '@nestjs/common';
import { CarritoService } from './carrito.service';
import { CarritoController } from './carrito.controller';
import { CarritoAdminController } from './carrito-admin.controller';
import { ClienteModule } from '../cliente/cliente.module';

// Referencia mutua con ClienteModule: el carrito usa el guard de cliente y
// el login de cliente adopta el carrito del dispositivo.
@Module({
  imports: [forwardRef(() => ClienteModule)],
  providers: [CarritoService],
  controllers: [CarritoController, CarritoAdminController],
  exports: [CarritoService],
})
export class CarritoModule {}
