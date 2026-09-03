import { Global, Module } from '@nestjs/common';
import { ConfiguracionService } from './configuracion.service';
import { ConfiguracionController } from './configuracion.controller';

// Global: el número de WhatsApp y los datos de la tienda los necesitan el
// catálogo, los correos y los feeds.
@Global()
@Module({
  providers: [ConfiguracionService],
  controllers: [ConfiguracionController],
  exports: [ConfiguracionService],
})
export class ConfiguracionModule {}
