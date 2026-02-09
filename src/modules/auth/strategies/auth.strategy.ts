// src/core/auth/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from 'src/prisma/prisma.service';
import type { Request } from 'express';

export interface JwtPayload {
  sub: number;
  email: string;
  ver?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    const cookieExtractor = (req: Request): string | null => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return,
      return req?.cookies?.access_token ?? null;
    };
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: process.env.JWT_SECRET!,
      ignoreExpiration: false,
    });
  }

  // ===================================================================================
  async validate(payload: JwtPayload) {
    console.log('ren');

    const user = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
    });
    if (!user || user.activo !== true) {
      throw new UnauthorizedException();
    }
    return {
      id: user.id,
      username: user.username,
    };
  }
}
