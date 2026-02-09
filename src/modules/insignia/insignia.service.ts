import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryOptionsSchemaType } from 'src/common/schema/query-options.schema';
import { Prisma } from '@prisma/client';
import { prismaQueryBuilder } from 'src/common/utils/prisma-query-builder';
import { buildPaginatedResponse } from 'src/common/utils/paginate-response';
import { handlePrismaFilterError } from 'src/common/utils/prisma-filter.util';
import { CoreResponse } from 'src/common/utils/response.util';
import { CreateInsigniaType } from './schema/createInsignia.schema';
import { UpdateInsigniaType } from './schema/updateInsignia.shema';

@Injectable()
export class InsigniaService {
  // ===================================================================================
  constructor(private readonly prismaService: PrismaService) {}

  // ===================================================================================
  async createInsignia(dto: CreateInsigniaType) {
    const exists = await this.prismaService.insignia.findUnique({
      where: { slug: dto.slug },
      select: { id: true },
    });

    if (exists) {
      throw new BadRequestException('La insignia ya existe.');
    }

    const created = await this.prismaService.insignia.create({
      data: {
        nombre: dto.nombre,
        slug: dto.slug,
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });

    return CoreResponse.created('Insignia creada correctamente', created);
  }

  // ===================================================================================
  async updateInsignia(id: number, dto: UpdateInsigniaType) {
    const exists = await this.prismaService.insignia.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });

    if (!exists) throw new NotFoundException('Insignia no encontrada');

    if (dto.slug && dto.slug !== exists.slug) {
      const dup = await this.prismaService.insignia.findUnique({
        where: { slug: dto.slug },
        select: { id: true },
      });

      if (dup) throw new BadRequestException('La insignia ya existe.');
    }

    const updated = await this.prismaService.insignia.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });

    return CoreResponse.updated('Insignia actualizada correctamente', updated);
  }

  // ===================================================================================
  async getInsignias(options: QueryOptionsSchemaType) {
    try {
      const query = prismaQueryBuilder<
        Prisma.InsigniaWhereInput,
        Prisma.InsigniaInclude
      >(options, ['productos']); // relación en el modelo

      const page = options.page ? Number(options.page) : 1;
      const limit = options.limit ? Number(options.limit) : undefined;

      const total = await this.prismaService.insignia.count({
        where: query.where,
      });

      const data = await this.prismaService.insignia.findMany(query);

      return buildPaginatedResponse(data, total, page, limit);
    } catch (err) {
      return handlePrismaFilterError(err);
    }
  }
}
