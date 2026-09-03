import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/auth.strategy';
import { AuthRepository } from './auth.repository';
import { RefreshService } from './refresh.service';
import { getJwtSecret, TOKEN_EXPIRES_IN } from 'src/common/config/jwt.config';

@Module({
  imports: [
    JwtModule.registerAsync({
      // Secreto obligatorio: si falta JWT_SECRET la app no arranca.
      useFactory: () => ({
        secret: getJwtSecret(),
        signOptions: { expiresIn: TOKEN_EXPIRES_IN },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, AuthRepository, RefreshService],
  controllers: [AuthController],
})
export class AuthModule {}
