//* src/modules/health/health.controller.ts

import {
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from 'src/prisma/prisma.service';
import { MinioService } from '../minio/minio.service';

// ===================================================================================
// Sonda de estado para balanceadores y monitorización.
//
// Sin esto no se puede poner la API detrás de un proxy con comprobación de
// salud ni detectar que MySQL o MinIO se cayeron antes de que lo note un
// cliente.
// ===================================================================================

// Estado 503 con cuerpo detallado: el balanceador ve el código y el
// operador ve qué dependencia falló.
class ServicioNoDisponible extends HttpException {
  constructor(cuerpo: Record<string, unknown>) {
    super(cuerpo, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  // ===================================================================================
  // Sonda ligera: responde si el proceso está vivo, sin tocar dependencias.
  @Get()
  vivo() {
    return {
      status: 'ok',
      uptimeSegundos: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  // ===================================================================================
  // Sonda completa: comprueba las dependencias. Devuelve 503 si alguna
  // falla, para que el balanceador saque la instancia del pool.
  @Get('listo')
  @HttpCode(HttpStatus.OK)
  async listo() {
    const [db, almacenamiento] = await Promise.all([
      this.comprobarDb(),
      this.comprobarMinio(),
    ]);

    const ok = db.ok && almacenamiento.ok;

    const cuerpo = {
      status: ok ? 'ok' : 'degradado',
      dependencias: { db, almacenamiento },
      timestamp: new Date().toISOString(),
    };

    if (!ok) {
      // Se lanza para que el estado HTTP refleje el fallo.
      throw new ServicioNoDisponible(cuerpo);
    }

    return cuerpo;
  }

  // ===================================================================================
  private async comprobarDb() {
    const inicio = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { ok: true, latenciaMs: Date.now() - inicio };
    } catch (e) {
      return {
        ok: false,
        latenciaMs: Date.now() - inicio,
        error: (e as Error).message,
      };
    }
  }

  // ===================================================================================
  private async comprobarMinio() {
    const inicio = Date.now();

    try {
      // Listar con un prefijo inexistente es la comprobación más barata:
      // valida credenciales y conectividad sin transferir datos.
      await this.minio.listarObjetos('__health__');
      return { ok: true, latenciaMs: Date.now() - inicio };
    } catch (e) {
      return {
        ok: false,
        latenciaMs: Date.now() - inicio,
        error: (e as Error).message,
      };
    }
  }
}
