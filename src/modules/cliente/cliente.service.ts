//* src/modules/cliente/cliente.service.ts

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from 'src/prisma/prisma.service';
import { CoreResponse } from 'src/common/utils/response.util';
import { NotificacionService } from '../notificacion/notificacion.service';
import {
  CLIENTE_TOKEN_EXPIRA,
  getGoogleClientId,
} from 'src/common/config/google.config';

// ===================================================================================
// Autenticación de clientes con Google.
//
// Los clientes son un sujeto distinto de los administradores: viven en su
// propia tabla y su token lleva `tipo: 'cliente'`, así que no sirve para
// entrar al panel aunque se presente en /auth/me.
// ===================================================================================

@Injectable()
export class ClienteService {
  private readonly logger = new Logger(ClienteService.name);

  // El cliente de Google se crea al primer login, no al arrancar: la tienda
  // se puede mostrar entera sin GOOGLE_CLIENT_ID, y exigirlo en el
  // constructor impedía levantar la API sólo para el catálogo público.
  private google: OAuth2Client | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly notificacion: NotificacionService,
  ) {}

  // ===================================================================================
  // La validación sigue siendo obligatoria para iniciar sesión: si falta la
  // variable, el login falla. Lo que ya no ocurre es que falle el arranque.
  private clienteGoogle(): OAuth2Client {
    this.google ??= new OAuth2Client(getGoogleClientId());
    return this.google;
  }

  // ===================================================================================
  // Verifica el id_token que el front obtiene de Google Identity Services.
  // La verificación contra Google es imprescindible: sin ella, cualquiera
  // podría enviar un token falso con el email de otra persona.
  private async verificarIdToken(idToken: string) {
    try {
      const ticket = await this.clienteGoogle().verifyIdToken({
        idToken,
        audience: getGoogleClientId(),
      });

      const payload = ticket.getPayload();

      if (!payload?.sub || !payload.email) {
        throw new UnauthorizedException('Token de Google incompleto');
      }

      // Google marca si el correo está verificado; sin verificar no se
      // acepta, porque el email es la identidad que usamos para notificar.
      if (payload.email_verified === false) {
        throw new UnauthorizedException(
          'La cuenta de Google no tiene el correo verificado',
        );
      }

      return {
        googleId: payload.sub,
        email: payload.email,
        nombre: payload.name ?? payload.email.split('@')[0],
        avatar: payload.picture ?? null,
      };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;

      this.logger.warn(
        `Verificación de Google fallida: ${(e as Error).message}`,
      );
      throw new UnauthorizedException('Token de Google inválido');
    }
  }

  // ===================================================================================
  async loginConGoogle(idToken: string) {
    const perfil = await this.verificarIdToken(idToken);

    const existente = await this.prisma.cliente.findUnique({
      where: { googleId: perfil.googleId },
      select: { id: true },
    });

    const cliente = await this.prisma.cliente.upsert({
      where: { googleId: perfil.googleId },
      // El nombre y el avatar se refrescan en cada entrada; las
      // preferencias del cliente no se tocan.
      update: {
        nombre: perfil.nombre,
        avatar: perfil.avatar,
        ultimoAcceso: new Date(),
      },
      create: {
        googleId: perfil.googleId,
        email: perfil.email,
        nombre: perfil.nombre,
        avatar: perfil.avatar,
        ultimoAcceso: new Date(),
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        avatar: true,
        aceptaNovedades: true,
        activo: true,
      },
    });

    if (!cliente.activo) {
      throw new UnauthorizedException('Esta cuenta está desactivada');
    }

    const token = this.jwt.sign(
      { sub: cliente.id, email: cliente.email, tipo: 'cliente' },
      { expiresIn: CLIENTE_TOKEN_EXPIRA },
    );

    // Sólo en el primer acceso, y sin bloquear el login si el correo falla.
    if (!existente) {
      await this.notificacion
        .enviarBienvenida(cliente)
        .catch((e: Error) =>
          this.logger.warn(`No se pudo enviar la bienvenida: ${e.message}`),
        );
    }

    return { token, cliente, esNuevo: !existente };
  }

  // ===================================================================================
  async perfil(clienteId: number) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: clienteId },
      select: {
        id: true,
        email: true,
        nombre: true,
        avatar: true,
        aceptaNovedades: true,
        createdAt: true,
        _count: { select: { favoritos: true, suscripciones: true } },
      },
    });

    if (!cliente) throw new UnauthorizedException('Cliente no encontrado');

    const { _count, ...datos } = cliente;

    return CoreResponse.success('Perfil obtenido correctamente', {
      ...datos,
      favoritos: _count.favoritos,
      avisosStock: _count.suscripciones,
    });
  }

  // ===================================================================================
  async actualizarPreferencias(
    clienteId: number,
    dto: { aceptaNovedades?: boolean; nombre?: string },
  ) {
    const cliente = await this.prisma.cliente.update({
      where: { id: clienteId },
      data: {
        ...(dto.aceptaNovedades !== undefined
          ? { aceptaNovedades: dto.aceptaNovedades }
          : {}),
        ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
      },
      select: {
        id: true,
        email: true,
        nombre: true,
        avatar: true,
        aceptaNovedades: true,
      },
    });

    return CoreResponse.updated('Preferencias actualizadas', cliente);
  }
}
