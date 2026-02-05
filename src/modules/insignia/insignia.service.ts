import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryOptionsSchemaType } from 'src/common/schema/query-options.schema';
import { Prisma } from '@prisma/client';
import { prismaQueryBuilder } from 'src/common/utils/prisma-query-builder';
import { buildPaginatedResponse } from 'src/common/utils/paginate-response';
import { handlePrismaFilterError } from 'src/common/utils/prisma-filter.util';
import { CreateInsigniaDto } from './dto/createInsignia.dto';

@Injectable()
export class InsigniaService {
  // ===================================================================================
  constructor(private readonly prismaService: PrismaService) {}

  // ===================================================================================
  async createInsignia(dto: CreateInsigniaDto) {
    const insigniaExistente = await this.prismaService.insignia.findUnique({
      where: { slug: dto.slug },
    });

    if (insigniaExistente) {
      throw new BadRequestException('La insignia ya existe.');
    }

    return this.prismaService.insignia.create({
      data: {
        nombre: dto.nombre,
        slug: dto.slug,
        color: dto.color,
      },
    });
  }

  // ===================================================================================
  async getInsignias(options: QueryOptionsSchemaType) {
    try {
      const query = prismaQueryBuilder<
        Prisma.InsigniaWhereInput,
        Prisma.InsigniaInclude
      >(options, ['productos']);

      const page = options.page ? Number(options.page) : 1;
      const limit = options.limit ? Number(options.limit) : undefined;

      const total = await this.prismaService.insignia.count({
        where: query.where,
      });

      const data = await this.prismaService.insignia.findMany(query);

      return buildPaginatedResponse(data, total, page, limit);
    } catch (err) {
      if (err) throw err;
      return handlePrismaFilterError(err);
    }
  }
}
