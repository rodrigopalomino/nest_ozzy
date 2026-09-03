//* src/common/interceptors/auditoria.interceptor.ts

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccionAuditoria } from '@prisma/client';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';
import { AuditoriaService } from 'src/modules/auditoria/auditoria.service';
import { JwtUser } from '../types/express';

export const AUDITAR_KEY = 'auditar';

export interface OpcionesAuditoria {
  entidad: string;
  accion: AccionAuditoria;
}

// ===================================================================================
// Marca una ruta para que su resultado quede en la bitácora.
export const Auditar = (entidad: string, accion: AccionAuditoria) =>
  SetMetadata(AUDITAR_KEY, { entidad, accion });

// ===================================================================================
// Registra en la bitácora las escrituras marcadas con @Auditar.
//
// Se hace por interceptor y no dentro de cada servicio para que añadir
// auditoría a una ruta sea una línea, y para que un fallo al registrar no
// pueda tumbar la operación auditada.
// ===================================================================================
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditoria: AuditoriaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const opciones = this.reflector.getAllAndOverride<OpcionesAuditoria>(
      AUDITAR_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!opciones) return next.handle();

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtUser }>();

    const usuario = req.user
      ? { id: req.user.id, username: req.user.username }
      : null;

    const ip = req.ip ?? null;

    return next.handle().pipe(
      tap((respuesta: unknown) => {
        // Sólo se audita lo que salió bien: los errores no llegan al tap.
        const datos = this.extraerDatos(respuesta);

        void this.auditoria.registrar({
          entidad: opciones.entidad,
          entidadId: this.extraerId(datos, req),
          accion: opciones.accion,
          usuario,
          despues: datos,
          ip,
        });
      }),
    );
  }

  // ===================================================================================
  private extraerDatos(respuesta: unknown): Record<string, unknown> | null {
    if (typeof respuesta !== 'object' || respuesta === null) return null;

    const cuerpo = respuesta as { data?: unknown };

    if (typeof cuerpo.data === 'object' && cuerpo.data !== null) {
      return cuerpo.data as Record<string, unknown>;
    }

    return null;
  }

  // ===================================================================================
  // El id sale de la respuesta y, si no está (por ejemplo en un borrado),
  // del parámetro de la ruta.
  private extraerId(
    datos: Record<string, unknown> | null,
    req: Request,
  ): string {
    if (
      datos &&
      (typeof datos.id === 'number' || typeof datos.id === 'string')
    ) {
      return String(datos.id);
    }

    const params = req.params as Record<string, string> | undefined;

    return params?.id ?? params?.producto_id ?? 'desconocido';
  }
}
