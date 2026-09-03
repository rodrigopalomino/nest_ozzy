//* src/modules/cliente/cliente-opcional.guard.ts

import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClienteAutenticado } from 'src/common/types/express';
import { CLIENTE_TOKEN_COOKIE } from 'src/common/config/google.config';

interface PayloadCliente {
  sub: number;
  email: string;
  tipo?: string;
}

// ===================================================================================
// Autenticación opcional: si hay sesión de cliente la resuelve, y si no
// deja pasar igualmente.
//
// Lo necesitan los favoritos y los avisos de stock, que funcionan tanto con
// cuenta como con un id de dispositivo anónimo. Sin este guard,
// @CurrentCliente() sería siempre undefined en esas rutas.
// ===================================================================================
@Injectable()
export class ClienteOpcionalGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { cliente?: ClienteAutenticado }>();

    const token = this.extraerToken(request);

    // Sin token la petición sigue como anónima.
    if (!token) return true;

    try {
      const payload = this.jwt.verify<PayloadCliente>(token);

      if (payload.tipo !== 'cliente') return true;

      const cliente = await this.prisma.cliente.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          nombre: true,
          avatar: true,
          activo: true,
        },
      });

      if (cliente?.activo) {
        request.cliente = {
          id: cliente.id,
          email: cliente.email,
          nombre: cliente.nombre,
          avatar: cliente.avatar,
        };
      }
    } catch {
      // Un token inválido o expirado no bloquea: se trata como anónimo.
    }

    return true;
  }

  // ===================================================================================
  private extraerToken(req: Request): string | null {
    const cookies = req.cookies as Record<string, string> | undefined;
    const deCookie = cookies?.[CLIENTE_TOKEN_COOKIE];

    if (deCookie) return deCookie;

    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) return auth.slice(7);

    return null;
  }
}
