import { Global, Module } from '@nestjs/common';
import { MantenimientoService } from './mantenimiento.service';
import { MantenimientoController } from './mantenimiento.controller';

// Global: recalcularPrecioDesde lo llaman producto y producto-admin cada
// vez que cambia un precio.
@Global()
@Module({
  providers: [MantenimientoService],
  controllers: [MantenimientoController],
  exports: [MantenimientoService],
})
export class MantenimientoModule {}
