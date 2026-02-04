import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ColorModule } from './modules/color/color.module';
import { TallaModule } from './modules/talla/talla.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ColorModule,
    TallaModule,
  ],
})
export class AppModule {}
