//* src/modules/auth/auth.repository.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthRepository {
  // ===================================================================================
  constructor(private readonly prismaService: PrismaService) {}

  // ===================================================================================
  findUnique(username: string) {
    return this.prismaService.usuario.findUnique({
      where: {
        username,
      },
    });
  }

  // ===================================================================================
  // create(data: Prisma.userCreateInput) {
  //   return this.prismaService.user.create({ data });
  // }
}
