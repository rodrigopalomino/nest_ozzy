//* src/modules/auth/auth.controller.ts

import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { SigninDto } from './dto/signin.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtUser } from 'src/common/types/express';
import { Response } from 'express';

@Controller('auth')
export class AuthController {
  // ===================================================================================
  constructor(private readonly authService: AuthService) {}

  // ===================================================================================
  // @Post()
  // creteUser(@Body() body: SignupDto) {
  //   return this.authService.signup(body);
  // }

  // ===================================================================================
  @Post('/login')
  async signIn(
    @Body() body: SigninDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.authService.signin(body);

    // Crear cookie httpOnly
    res.cookie('access_token', token, {
      httpOnly: true, // ❗ el navegador no puede leerla
      secure: false, // ❗ true si usas HTTPS (en local puedes poner false)
      sameSite: 'lax', // protección CSRF básica
      maxAge: 1000 * 60 * 60 * 24, // 1 día
      path: '/', // disponible para toda la app
    });

    // Lo que devuelves al frontend
    return {
      message: 'Login exitoso',
      user,
    };
  }

  // ===================================================================================
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: JwtUser) {
    console.log('entro => ', user);
    return user;
  }
}
