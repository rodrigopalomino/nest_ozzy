import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
    const databaseUrl = configService.get<string>('DATABASE_URL');

    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL no está definida en las variables de entorno',
      );
    }

    super({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      console.log('✅ Prisma conectado correctamente');
    } catch (error) {
      console.error('❌ Error al conectar a la base de datos:', error);
      process.exit(1);
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      console.log('🛑 Prisma desconectado correctamente');
    } catch (error) {
      console.error('⚠️ Error al desconectar Prisma:', error);
    }
  }
}
