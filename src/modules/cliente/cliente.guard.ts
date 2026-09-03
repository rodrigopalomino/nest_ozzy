//* src/modules/cliente/cliente.guard.ts

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
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
// Autentica a un cliente de la tienda.
//
// Exige `tipo: 'cliente'` en el token: un token de administrador no sirve
// aquí, y el guard de administrador tampoco acepta uno de cliente.
// ===================================================================================
@Injectable()
export class ClienteGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // ===================================================================================
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { cliente?: ClienteAutenticado }>();

    const token = this.extraerToken(request);

    if (!token) throw new UnauthorizedException('Sesión no iniciada');

    let payload: PayloadCliente;

    try {
      payload = this.jwt.verify<PayloadCliente>(token);
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    if (payload.tipo !== 'cliente') {
      throw new UnauthorizedException('Este token no corresponde a un cliente');
    }

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

    if (!cliente || !cliente.activo) {
      throw new UnauthorizedException('Cuenta no disponible');
    }

    request.cliente = {
      id: cliente.id,
      email: cliente.email,
      nombre: cliente.nombre,
      avatar: cliente.avatar,
    };

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
