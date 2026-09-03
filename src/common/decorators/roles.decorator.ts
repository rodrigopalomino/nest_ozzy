//* src/common/decorators/roles.decorator.ts

import { SetMetadata } from '@nestjs/common';
import { RolUsuario } from '@prisma/client';

export const ROLES_KEY = 'roles';

// ===================================================================================
// Restringe una ruta a ciertos roles. Sin este decorador, JwtAuthGuard
// sólo exige estar autenticado.
export const Roles = (...roles: RolUsuario[]) => SetMetadata(ROLES_KEY, roles);
