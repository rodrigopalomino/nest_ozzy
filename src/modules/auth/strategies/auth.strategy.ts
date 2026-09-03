// src/modules/auth/strategies/auth.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import type { Request } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  getJwtSecret,
} from 'src/common/config/jwt.config';
import { JwtUser } from 'src/common/types/express';

export interface JwtPayload {
  sub: number;
  username: string;
  // Versión del token: permite revocar sesiones sin lista negra.
  ver?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    const cookieExtractor = (req: Request): string | null => {
      const cookies = req?.cookies as Record<string, string> | undefined;
      return cookies?.[ACCESS_TOKEN_COOKIE] ?? null;
    };

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: getJwtSecret(),
      ignoreExpiration: false,
    });
  }

  // ===================================================================================
  async validate(payload: JwtPayload): Promise<JwtUser> {
    // `select` explícito: sin él se traía la fila completa, incluido el hash
    // de la contraseña, en cada petición autenticada. No se exponía, pero no
    // hay razón para cargarlo en memoria ni para que un cambio futuro en
    // este método pueda devolverlo por descuido.
    const user = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        rol: true,
        activo: true,
        tokenVersion: true,
      },
    });

    if (!user || user.activo !== true) {
      throw new UnauthorizedException();
    }

    // Un token emitido antes de un cambio de contraseña o de un cierre de
    // sesión global deja de ser válido.
    if (payload.ver !== undefined && payload.ver !== user.tokenVersion) {
      throw new UnauthorizedException('Sesión expirada');
    }

    // Se expone `rol` para que RolesGuard pueda autorizar.
    return {
      id: user.id,
      username: user.username,
      rol: user.rol,
      activo: user.activo,
    };
  }
}
