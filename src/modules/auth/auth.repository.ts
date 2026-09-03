//* src/modules/auth/auth.repository.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthRepository {
  // ===================================================================================
  constructor(private readonly prismaService: PrismaService) {}

  // ===================================================================================
  // Incluye tokenVersion: el token firmado la lleva para poder invalidar
  // sesiones sin mantener una lista negra.
  findUnique(username: string) {
    return this.prismaService.usuario.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        password: true,
        rol: true,
        activo: true,
        tokenVersion: true,
      },
    });
  }
}
