import { forwardRef, Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ClienteService } from './cliente.service';
import { ClienteController } from './cliente.controller';
import { FavoritoService } from './favorito.service';
import { SuscripcionStockService } from './suscripcion-stock.service';
import { ClienteGuard } from './cliente.guard';
import { ClienteOpcionalGuard } from './cliente-opcional.guard';
import { getJwtSecret } from 'src/common/config/jwt.config';
import { CarritoModule } from '../carrito/carrito.module';

// Global: producto necesita SuscripcionStockService para avisar de las
// reposiciones de stock.
@Global()
@Module({
  imports: [
    forwardRef(() => CarritoModule),
    JwtModule.registerAsync({
      // Mismo secreto que el panel; los tokens se distinguen por el campo
      // `tipo`, que los guards comprueban.
      useFactory: () => ({ secret: getJwtSecret() }),
    }),
  ],
  providers: [
    ClienteService,
    FavoritoService,
    SuscripcionStockService,
    ClienteGuard,
    ClienteOpcionalGuard,
  ],
  controllers: [ClienteController],
  // JwtModule y los guards se exportan para que otros módulos (carrito)
  // puedan usar ClienteOpcionalGuard sin recrear la configuración del JWT.
  exports: [
    SuscripcionStockService,
    FavoritoService,
    ClienteGuard,
    ClienteOpcionalGuard,
    JwtModule,
  ],
})
export class ClienteModule {}
