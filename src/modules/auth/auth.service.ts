//* src/modules/auth/auth.service.ts

import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthRepository } from './auth.repository';
import { SigninSchemaType } from './schemas/signin.schema';

@Injectable()
export class AuthService {
  // ===================================================================================
  constructor(
    private readonly repo: AuthRepository,
    private jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ===================================================================================
  // async signup(signupDto: SignupSchemaType) {
  //   const { fullname, username, email, password } = signupDto;

  //   const existingUser = await this.repo.findUnique(email);

  //   if (existingUser) {
  //     throw CoreErrors.emailAlreadyExists();
  //   }

  //   const hashedPassword = await argon2.hash(password);

  //   const data = {
  //     fullname,
  //     username,
  //     email,
  //     password: hashedPassword,
  //   };

  //   const newUser = await this.repo.create(data);

  //   Reflect.deleteProperty(newUser, 'password');

  //   return { message: 'Usuario registrado correctamente', user: newUser };
  // }

  // ===================================================================================
  async signin(signInDto: SigninSchemaType) {
    const { username, password } = signInDto;
    const user = await this.repo.findUnique(username);

    if (!user || typeof user.password !== 'string') {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const match = await argon2.verify(user.password, password);

    if (!match) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload: { sub: number; username: string } = {
      sub: user.id,
      username: user.username,
    };

    const token: string = this.jwtService.sign(payload, {
      expiresIn: '1d',
      secret:
        this.configService.get<string>('JWT_SECRET') ?? 'MISSING_JWT_SECRET',
    });

    Reflect.deleteProperty(user, 'password');

    return { token, user };
  }
}
