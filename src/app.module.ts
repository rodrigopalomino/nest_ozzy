import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';

import { AuthModule } from './modules/auth/auth.module';
import { ClienteModule } from './modules/cliente/cliente.module';
import { CarritoModule } from './modules/carrito/carrito.module';

import { CategoriaModule } from './modules/categoria/categoria.module';
import { ColeccionModule } from './modules/coleccion/coleccion.module';
import { ColorModule } from './modules/color/color.module';
import { InsigniaModule } from './modules/insignia/insignia.module';
import { TallaModule } from './modules/talla/talla.module';

import { ProductoModule } from './modules/producto/producto.module';
import { ProductoAdminModule } from './modules/producto-admin/producto-admin.module';
import { CatalogoModule } from './modules/catalogo/catalogo.module';

import { LeadModule } from './modules/lead/lead.module';
import { CuponModule } from './modules/cupon/cupon.module';

import { MinioModule } from './modules/minio/minio.module';
import { ConfiguracionModule } from './modules/configuracion/configuracion.module';
import { NotificacionModule } from './modules/notificacion/notificacion.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { MantenimientoModule } from './modules/mantenimiento/mantenimiento.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Cron de la cola de correo y de las tareas de limpieza.
    ScheduleModule.forRoot(),

    // Límite global holgado; las rutas sensibles lo ajustan con @Throttle
    // (login, registro de leads, validación de cupones). Los nombres
    // 'corto' y 'largo' permiten combinar ventanas de minuto y hora.
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'default', ttl: 60_000, limit: 120 },
        { name: 'corto', ttl: 60_000, limit: 120 },
        { name: 'largo', ttl: 3_600_000, limit: 2000 },
      ],
    }),

    PrismaModule,

    // Transversales (globales): los usan varios módulos.
    ConfiguracionModule,
    NotificacionModule,
    AuditoriaModule,
    MantenimientoModule,
    MinioModule,

    // Autenticación: panel y clientes.
    AuthModule,
    ClienteModule,

    // Catálogo maestro.
    CategoriaModule,
    ColeccionModule,
    ColorModule,
    InsigniaModule,
    TallaModule,

    // Productos.
    ProductoModule,
    ProductoAdminModule,
    CatalogoModule,

    // Conversión.
    LeadModule,
    CarritoModule,
    CuponModule,

    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
