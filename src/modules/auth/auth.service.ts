//* src/modules/auth/auth.service.ts

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { RolUsuario } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CoreResponse } from 'src/common/utils/response.util';
import { AuthRepository } from './auth.repository';
import { SigninSchemaType } from './schemas/signin.schema';
import { RefreshService } from './refresh.service';

@Injectable()
export class AuthService {
  // ===================================================================================
  constructor(
    private readonly repo: AuthRepository,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly refresh: RefreshService,
  ) {}

  // ===================================================================================
  private firmarAcceso(usuario: {
    id: number;
    username: string;
    tokenVersion: number;
  }): string {
    return this.jwtService.sign({
      sub: usuario.id,
      username: usuario.username,
      ver: usuario.tokenVersion,
    });
  }

  // ===================================================================================
  async signin(
    signInDto: SigninSchemaType,
    contexto: { userAgent?: string | null; ip?: string | null } = {},
  ) {
    const { username, password } = signInDto;
    const user = await this.repo.findUnique(username);

    // Mensaje idéntico en todos los fallos: no se revela si el usuario
    // existe, está desactivado o la contraseña es incorrecta.
    if (!user || typeof user.password !== 'string' || !user.activo) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const match = await argon2.verify(user.password, password);

    if (!match) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const token = this.firmarAcceso(user);

    const refreshToken = await this.refresh.emitir({
      usuarioId: user.id,
      userAgent: contexto.userAgent,
      ip: contexto.ip,
    });

    await this.prisma.usuario.update({
      where: { id: user.id },
      data: { ultimoAcceso: new Date() },
    });

    return {
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        rol: user.rol,
        activo: user.activo,
      },
    };
  }

  // ===================================================================================
  async refrescar(
    refreshToken: string,
    contexto: { userAgent?: string | null; ip?: string | null } = {},
  ) {
    const { token: nuevoRefresh, usuario } = await this.refresh.rotar(
      refreshToken,
      contexto,
    );

    return {
      token: this.firmarAcceso(usuario),
      refreshToken: nuevoRefresh,
      user: {
        id: usuario.id,
        username: usuario.username,
        rol: usuario.rol,
        activo: usuario.activo,
      },
    };
  }

  // ===================================================================================
  async logout(refreshToken?: string | null) {
    if (refreshToken) await this.refresh.revocar(refreshToken);
    return CoreResponse.success('Sesión cerrada correctamente', null);
  }

  // ===================================================================================
  async logoutTodas(usuarioId: number) {
    await this.refresh.revocarTodas(usuarioId);
    return CoreResponse.success('Se cerraron todas las sesiones activas', null);
  }

  // ===================================================================================
  async sesiones(usuarioId: number) {
    const sesiones = await this.refresh.sesionesActivas(usuarioId);
    return CoreResponse.success('Sesiones obtenidas correctamente', sesiones);
  }

  // ===================================================================================
  // Gestión de usuarios del panel. Antes sólo se podían crear por seed.
  async crearUsuario(dto: {
    username: string;
    password: string;
    rol?: RolUsuario;
  }) {
    const existe = await this.prisma.usuario.findUnique({
      where: { username: dto.username },
      select: { id: true },
    });

    if (existe) throw new ConflictException('El usuario ya existe');

    const usuario = await this.prisma.usuario.create({
      data: {
        username: dto.username,
        password: await argon2.hash(dto.password),
        rol: dto.rol ?? RolUsuario.STAFF,
      },
      select: {
        id: true,
        username: true,
        rol: true,
        activo: true,
        createdAt: true,
      },
    });

    return CoreResponse.created('Usuario creado correctamente', usuario);
  }

  // ===================================================================================
  async listarUsuarios() {
    const usuarios = await this.prisma.usuario.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        username: true,
        rol: true,
        activo: true,
        ultimoAcceso: true,
        createdAt: true,
      },
    });

    return CoreResponse.success('Usuarios obtenidos correctamente', usuarios);
  }

  // ===================================================================================
  async actualizarUsuario(
    id: number,
    dto: { rol?: RolUsuario; activo?: boolean },
    solicitanteId: number,
  ) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true, rol: true, activo: true },
    });

    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    // Nadie puede desactivarse ni degradarse a sí mismo: evita quedarse
    // sin acceso al panel por accidente.
    if (id === solicitanteId) {
      if (dto.activo === false) {
        throw new BadRequestException('No puedes desactivar tu propia cuenta');
      }
      if (dto.rol && dto.rol !== usuario.rol) {
        throw new BadRequestException('No puedes cambiar tu propio rol');
      }
    }

    // Debe quedar al menos un administrador activo.
    if (
      usuario.rol === RolUsuario.ADMIN &&
      (dto.activo === false || (dto.rol && dto.rol !== RolUsuario.ADMIN))
    ) {
      const admins = await this.prisma.usuario.count({
        where: { rol: RolUsuario.ADMIN, activo: true, id: { not: id } },
      });

      if (admins === 0) {
        throw new BadRequestException(
          'Debe quedar al menos un administrador activo',
        );
      }
    }

    const actualizado = await this.prisma.usuario.update({
      where: { id },
      data: {
        ...(dto.rol !== undefined ? { rol: dto.rol } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
      select: { id: true, username: true, rol: true, activo: true },
    });

    // Desactivar debe expulsar de inmediato, no al expirar el token.
    if (dto.activo === false) await this.refresh.revocarTodas(id);

    return CoreResponse.updated(
      'Usuario actualizado correctamente',
      actualizado,
    );
  }

  // ===================================================================================
  async cambiarPassword(
    usuarioId: number,
    dto: { passwordActual: string; passwordNueva: string },
  ) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { id: true, password: true },
    });

    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    const match = await argon2.verify(usuario.password, dto.passwordActual);

    if (!match) {
      throw new UnauthorizedException('La contraseña actual no es correcta');
    }

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { password: await argon2.hash(dto.passwordNueva) },
    });

    // Cambiar la contraseña cierra las demás sesiones: es lo que se espera
    // si se cambia porque se sospecha un acceso ajeno.
    await this.refresh.revocarTodas(usuarioId);

    return CoreResponse.updated(
      'Contraseña actualizada. Vuelve a iniciar sesión.',
      null,
    );
  }

  // ===================================================================================
  // Restablecimiento por un administrador, sin conocer la contraseña previa.
  async restablecerPassword(id: number, passwordNueva: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true, username: true },
    });

    if (!usuario) throw new NotFoundException('Usuario no encontrado');

    await this.prisma.usuario.update({
      where: { id },
      data: { password: await argon2.hash(passwordNueva) },
    });

    await this.refresh.revocarTodas(id);

    return CoreResponse.updated('Contraseña restablecida correctamente', {
      id: usuario.id,
      username: usuario.username,
    });
  }
}
