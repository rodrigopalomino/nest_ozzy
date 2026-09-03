//* src/common/interceptors/cache-publico.interceptor.ts

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import type { Request, Response } from 'express';
import { map, Observable } from 'rxjs';

export const CACHE_PUBLICO_KEY = 'cache_publico_segundos';

// ===================================================================================
// Marca una ruta pública como cacheable durante N segundos.
// Sólo en endpoints sin datos por usuario.
export const CachePublico = (segundos: number) =>
  SetMetadata(CACHE_PUBLICO_KEY, segundos);

// ===================================================================================
// Añade Cache-Control y ETag a las respuestas públicas.
//
// Con esto el navegador y cualquier CDN dejan de repreguntar por el
// catálogo en cada visita, y si el contenido no cambió se responde 304 sin
// cuerpo. Es el cambio de rendimiento más barato que existe.
// ===================================================================================
@Injectable()
export class CachePublicoInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const segundos = this.reflector.getAllAndOverride<number>(
      CACHE_PUBLICO_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!segundos || segundos <= 0) return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    // Sólo GET es cacheable.
    if (req.method !== 'GET') return next.handle();

    return next.handle().pipe(
      map((cuerpo: unknown) => {
        // `stale-while-revalidate` deja que la CDN sirva la copia vieja
        // mientras refresca en segundo plano.
        res.setHeader(
          'Cache-Control',
          `public, max-age=${segundos}, stale-while-revalidate=${segundos * 2}`,
        );

        const etag = `W/"${createHash('sha1')
          .update(JSON.stringify(cuerpo ?? null))
          .digest('base64')}"`;

        res.setHeader('ETag', etag);

        // Si el cliente ya tiene esta versión, se ahorra el cuerpo entero.
        if (req.headers['if-none-match'] === etag) {
          res.status(304);
          return undefined;
        }

        return cuerpo;
      }),
    );
  }
}
