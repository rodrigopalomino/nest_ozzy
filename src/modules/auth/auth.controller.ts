//* src/modules/auth/auth.controller.ts

import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RolUsuario } from '@prisma/client';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { SigninDto } from './dto/signin.dto';
import {
  ActualizarUsuarioDto,
  CambiarPasswordDto,
  CrearUsuarioDto,
  RestablecerPasswordDto,
} from './dto/usuario.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtUser } from 'src/common/types/express';
import { CoreResponse } from 'src/common/utils/response.util';
import {
  ACCESS_TOKEN_COOKIE,
  IS_PRODUCTION,
  REFRESH_MAX_AGE_MS,
  REFRESH_TOKEN_COOKIE,
  TOKEN_MAX_AGE_MS,
} from 'src/common/config/jwt.config';

// ===================================================================================
// En producción la cookie exige HTTPS y sameSite 'none' para permitir el
// front en otro origen. En local queda en HTTP con 'lax'.
const cookieBase: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: IS_PRODUCTION ? 'none' : 'lax',
  path: '/',
};

@Controller('auth')
export class AuthController {
  // ===================================================================================
  constructor(private readonly authService: AuthService) {}

  // ===================================================================================
  private contexto(req: Request) {
    return {
      userAgent: req.headers['user-agent'] ?? null,
      ip: req.ip ?? null,
    };
  }

  // ===================================================================================
  private ponerCookies(
    res: Response,
    tokens: { token: string; refreshToken: string },
  ) {
    res.cookie(ACCESS_TOKEN_COOKIE, tokens.token, {
      ...cookieBase,
      maxAge: TOKEN_MAX_AGE_MS,
    });

    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      ...cookieBase,
      maxAge: REFRESH_MAX_AGE_MS,
    });
  }

  // ===================================================================================
  // 5 intentos por minuto y 20 por hora desde la misma IP: sin esto se
  // podían probar contraseñas sin ningún límite.
  @Throttle({
    corto: { limit: 5, ttl: 60_000 },
    largo: { limit: 20, ttl: 3_600_000 },
  })
  @Post('login')
  async signIn(
    @Body() body: SigninDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, refreshToken, user } = await this.authService.signin(
      body,
      this.contexto(req),
    );

    this.ponerCookies(res, { token, refreshToken });

    return CoreResponse.success('Login exitoso', user);
  }

  // ===================================================================================
  // Renueva el token de acceso. El refresh se rota en cada uso: uno robado
  // sirve una sola vez y su reutilización cierra todas las sesiones.
  @Throttle({ corto: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, string> | undefined;
    const actual =
      cookies?.[REFRESH_TOKEN_COOKIE] ??
      (typeof req.body === 'object' && req.body !== null
        ? (req.body as { refreshToken?: string }).refreshToken
        : undefined);

    if (!actual) throw new UnauthorizedException('No hay sesión que renovar');

    const { token, refreshToken, user } = await this.authService.refrescar(
      actual,
      this.contexto(req),
    );

    this.ponerCookies(res, { token, refreshToken });

    return CoreResponse.success('Sesión renovada', user);
  }

  // ===================================================================================
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookies = req.cookies as Record<string, string> | undefined;

    // Los atributos deben coincidir con los del login o el navegador no
    // borra la cookie.
    res.clearCookie(ACCESS_TOKEN_COOKIE, cookieBase);
    res.clearCookie(REFRESH_TOKEN_COOKIE, cookieBase);

    return this.authService.logout(cookies?.[REFRESH_TOKEN_COOKIE] ?? null);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard)
  @Post('logout-todas')
  async logoutTodas(
    @CurrentUser() user: JwtUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.clearCookie(ACCESS_TOKEN_COOKIE, cookieBase);
    res.clearCookie(REFRESH_TOKEN_COOKIE, cookieBase);

    return this.authService.logoutTodas(user.id);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: JwtUser) {
    return CoreResponse.success('Usuario autenticado', user);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard)
  @Get('sesiones')
  sesiones(@CurrentUser() user: JwtUser) {
    return this.authService.sesiones(user.id);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard)
  @Patch('password')
  cambiarPassword(
    @CurrentUser() user: JwtUser,
    @Body() dto: CambiarPasswordDto,
  ) {
    return this.authService.cambiarPassword(user.id, dto);
  }

  // ===================================================================================
  // Gestión de usuarios del panel: sólo ADMIN.
  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Get('usuarios')
  listarUsuarios() {
    return this.authService.listarUsuarios();
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Post('usuarios')
  crearUsuario(@Body() dto: CrearUsuarioDto) {
    return this.authService.crearUsuario(dto);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Patch('usuarios/:id')
  actualizarUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarUsuarioDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.authService.actualizarUsuario(id, dto, user.id);
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RolUsuario.ADMIN)
  @Patch('usuarios/:id/password')
  restablecerPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RestablecerPasswordDto,
  ) {
    return this.authService.restablecerPassword(id, dto.passwordNueva);
  }
}
