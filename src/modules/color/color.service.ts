import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateColorDto } from './dto/createColor.dto';
import { prismaQueryBuilder } from 'src/common/utils/prisma-query-builder';
import { Prisma } from '@prisma/client';
import { QueryOptionsSchemaType } from 'src/common/schema/query-options.schema';
import { buildPaginatedResponse } from 'src/common/utils/paginate-response';
import { handlePrismaFilterError } from 'src/common/utils/prisma-filter.util';

// ===================================================================================
@Injectable()
export class ColorService {
  // ===================================================================================
  constructor(private readonly prismaService: PrismaService) {}

  // ===================================================================================
  async createColor(dto: CreateColorDto) {
    const colorExistente = await this.prismaService.color.findUnique({
      where: { nombre: dto.nombre },
    });

    if (colorExistente) {
      throw new BadRequestException('El color ya existe.');
    }

    return this.prismaService.color.create({
      data: {
        nombre: dto.nombre,
        hex: dto.hex,
      },
    });
  }

  // ===================================================================================
  async getColores(options: QueryOptionsSchemaType) {
    try {
      const query = prismaQueryBuilder<
        Prisma.ColorWhereInput,
        Prisma.ColorInclude
      >(options, ['variantes']);

      console.log('options => ', options);
      console.log('query => ', query);

      const page = options.page ? Number(options.page) : 1;
      const limit = options.limit ? Number(options.limit) : undefined;

      const total = await this.prismaService.color.count({
        where: query.where,
      });

      const data = await this.prismaService.color.findMany(query);

      return buildPaginatedResponse(data, total, page, limit);
    } catch (err) {
      if (err) throw err;
      return handlePrismaFilterError(err);
    }
  }
}
