import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';

// ===================================================================================
// Conexión a MySQL con reintentos.
//
// Antes onModuleInit hacía process.exit(1) al fallar: si MySQL tardaba un
// segundo en aceptar conexiones (arranque con docker-compose, reinicio del
// VPS) la API moría en silencio y sin reintentar. Ahora reintenta con espera
// creciente y, si agota los intentos, lanza para que Nest reporte el error.
// ===================================================================================

const MAX_INTENTOS = 5;
const ESPERA_BASE_MS = 500;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    const databaseUrl = configService.get<string>('DATABASE_URL');

    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL no está definida en las variables de entorno',
      );
    }

    super({
      datasources: { db: { url: databaseUrl } },
    });
  }

  // ===================================================================================
  async onModuleInit() {
    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      try {
        await this.$connect();
        this.logger.log('Conexión a la base de datos establecida');
        return;
      } catch (error) {
        const ultimo = intento === MAX_INTENTOS;
        const espera = ESPERA_BASE_MS * 2 ** (intento - 1);

        this.logger.warn(
          `No se pudo conectar a la base de datos (intento ${intento}/${MAX_INTENTOS})` +
            (ultimo ? '' : `. Reintentando en ${espera} ms`),
        );

        if (ultimo) {
          // Se lanza en lugar de matar el proceso: Nest registra el error
          // con contexto y el orquestador decide si reinicia.
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, espera));
      }
    }
  }

  // ===================================================================================
  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log('Conexión a la base de datos cerrada');
    } catch (error) {
      this.logger.error('Error al cerrar la conexión', error as Error);
    }
  }
}
