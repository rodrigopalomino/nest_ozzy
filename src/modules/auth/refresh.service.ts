//* src/modules/auth/refresh.service.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { REFRESH_MAX_AGE_MS } from 'src/common/config/jwt.config';

// ===================================================================================
// Sesiones de larga duración para el panel.
//
// En la base sólo se guarda el hash del token: si la base se filtra, los
// tokens no son reutilizables. Además cada uso rota el token (un refresh
// robado sirve una sola vez y su reutilización se detecta).
// ===================================================================================

@Injectable()
export class RefreshService {
  constructor(private readonly prisma: PrismaService) {}

  // ===================================================================================
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // ===================================================================================
  async emitir(params: {
    usuarioId: number;
    userAgent?: string | null;
    ip?: string | null;
  }): Promise<string> {
    // 48 bytes aleatorios: suficiente entropía para que no se pueda adivinar.
    const token = randomBytes(48).toString('base64url');

    await this.prisma.refreshToken.create({
      data: {
        usuario_id: params.usuarioId,
        tokenHash: this.hash(token),
        expiraEn: new Date(Date.now() + REFRESH_MAX_AGE_MS),
        userAgent: params.userAgent?.slice(0, 255) ?? null,
        ip: params.ip ?? null,
      },
    });

    return token;
  }

  // ===================================================================================
  // Valida el token y lo rota. Devuelve el usuario y el token nuevo.
  async rotar(
    token: string,
    contexto: { userAgent?: string | null; ip?: string | null } = {},
  ) {
    const registro = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.hash(token) },
      include: {
        usuario: {
          select: {
            id: true,
            username: true,
            rol: true,
            activo: true,
            tokenVersion: true,
          },
        },
      },
    });

    if (!registro) throw new UnauthorizedException('Sesión no válida');

    // Reutilización de un token ya rotado: señal de robo. Se cierran todas
    // las sesiones del usuario por precaución.
    if (registro.revocadoEn) {
      await this.revocarTodas(registro.usuario_id);
      throw new UnauthorizedException(
        'Sesión revocada. Vuelve a iniciar sesión.',
      );
    }

    if (registro.expiraEn < new Date()) {
      throw new UnauthorizedException('Sesión expirada');
    }

    if (!registro.usuario.activo) {
      throw new UnauthorizedException('Cuenta desactivada');
    }

    const nuevo = randomBytes(48).toString('base64url');

    await this.prisma.$transaction([
      this.prisma.refreshToken.update({
        where: { id: registro.id },
        data: { revocadoEn: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          usuario_id: registro.usuario_id,
          tokenHash: this.hash(nuevo),
          expiraEn: new Date(Date.now() + REFRESH_MAX_AGE_MS),
          userAgent: contexto.userAgent?.slice(0, 255) ?? registro.userAgent,
          ip: contexto.ip ?? registro.ip,
        },
      }),
    ]);

    return { token: nuevo, usuario: registro.usuario };
  }

  // ===================================================================================
  async revocar(token: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(token), revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
  }

  // ===================================================================================
  // Cierra todas las sesiones del usuario e invalida sus tokens de acceso
  // ya emitidos subiendo tokenVersion.
  async revocarTodas(usuarioId: number) {
    await this.prisma.$transaction([
      this.prisma.refreshToken.updateMany({
        where: { usuario_id: usuarioId, revocadoEn: null },
        data: { revocadoEn: new Date() },
      }),
      this.prisma.usuario.update({
        where: { id: usuarioId },
        data: { tokenVersion: { increment: 1 } },
      }),
    ]);
  }

  // ===================================================================================
  async sesionesActivas(usuarioId: number) {
    return this.prisma.refreshToken.findMany({
      where: {
        usuario_id: usuarioId,
        revocadoEn: null,
        expiraEn: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        userAgent: true,
        ip: true,
        createdAt: true,
        expiraEn: true,
      },
    });
  }
}
