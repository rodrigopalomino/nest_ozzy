import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCategoriaDto } from './dto/createCategoria.dto';
import { QueryOptionsSchemaType } from 'src/common/schema/query-options.schema';
import { Prisma } from '@prisma/client';
import { prismaQueryBuilder } from 'src/common/utils/prisma-query-builder';
import { buildPaginatedResponse } from 'src/common/utils/paginate-response';
import { handlePrismaFilterError } from 'src/common/utils/prisma-filter.util';

@Injectable()
export class CategoriaService {
  // ===================================================================================
  constructor(private readonly prismaService: PrismaService) {}

  // ===================================================================================
  async createCategoria(dto: CreateCategoriaDto) {
    const categoriaExistente = await this.prismaService.categoria.findUnique({
      where: { slug: dto.slug },
    });

    if (categoriaExistente) {
      throw new BadRequestException('La categoria ya existe.');
    }

    return this.prismaService.categoria.create({
      data: {
        nombre: dto.nombre,
        slug: dto.slug,
      },
    });
  }

  // ===================================================================================
  async getCategorias(options: QueryOptionsSchemaType) {
    try {
      const query = prismaQueryBuilder<
        Prisma.CategoriaWhereInput,
        Prisma.CategoriaInclude
      >(options, ['productos']);

      const page = options.page ? Number(options.page) : 1;
      const limit = options.limit ? Number(options.limit) : undefined;

      const total = await this.prismaService.categoria.count({
        where: query.where,
      });

      const data = await this.prismaService.categoria.findMany(query);

      return buildPaginatedResponse(data, total, page, limit);
    } catch (err) {
      if (err) throw err;
      return handlePrismaFilterError(err);
    }
  }
}
