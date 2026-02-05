import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ColorModule } from './modules/color/color.module';
import { TallaModule } from './modules/talla/talla.module';
import { ConfigModule } from '@nestjs/config';
import { CategoriaModule } from './modules/categoria/categoria.module';
import { InsigniaModule } from './modules/insignia/insignia.module';
import { MinioModule } from './modules/minio/minio.module';
import { ProductoModule } from './modules/producto/producto.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ColorModule,
    TallaModule,
    CategoriaModule,
    InsigniaModule,
    MinioModule,
    ProductoModule,
  ],
})
export class AppModule {}
