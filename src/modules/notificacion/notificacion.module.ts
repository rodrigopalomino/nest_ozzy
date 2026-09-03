import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { NotificacionService } from './notificacion.service';
import { NotificacionController } from './notificacion.controller';

// Global: los avisos de stock y la bienvenida se disparan desde otros
// módulos (producto, cliente).
@Global()
@Module({
  providers: [EmailService, NotificacionService],
  controllers: [NotificacionController],
  exports: [EmailService, NotificacionService],
})
export class NotificacionModule {}
