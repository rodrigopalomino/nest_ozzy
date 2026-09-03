//* src/common/guards/roles.guard.ts

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolUsuario } from '@prisma/client';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { JwtUser } from '../types/express';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  // ===================================================================================
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RolUsuario[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Sin @Roles() la ruta no restringe por rol.
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtUser }>();

    const user = request.user;

    if (!user || !requiredRoles.includes(user.rol)) {
      throw new ForbiddenException(
        'No tienes permisos suficientes para esta operación.',
      );
    }

    return true;
  }
}
