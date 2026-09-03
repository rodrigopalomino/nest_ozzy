import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma as PrismaClient } from '@prisma/client';

import { QueryOptionsSchemaType } from 'src/common/schema/query-options.schema';
import {
  prismaQueryBuilder,
  resolveLimit,
} from 'src/common/utils/prisma-query-builder';
import { buildPaginatedResponse } from 'src/common/utils/paginate-response';
import { handlePrismaFilterError } from 'src/common/utils/prisma-filter.util';
import { CoreResponse } from 'src/common/utils/response.util';

import { PrismaService } from 'src/prisma/prisma.service';
import { CreateTallaType } from './schema/createTalla.schema';
import { UpdateTallaType } from './schema/updateTalla.shema';

@Injectable()
export class TallaService {
  // ===================================================================================
  constructor(private readonly prismaService: PrismaService) {}

  // ===================================================================================
  async createTalla(dto: CreateTallaType) {
    const existente = await this.prismaService.talla.findUnique({
      where: { etiqueta: dto.etiqueta },
      select: { id: true },
    });

    if (existente) {
      throw new BadRequestException('La talla ya existe.');
    }

    const created = await this.prismaService.talla.create({
      data: {
        etiqueta: dto.etiqueta,
        activo: dto.activo ?? true,
      },
    });

    return CoreResponse.created('Talla creada correctamente', created);
  }

  // ===================================================================================
  async updateTalla(id: number, dto: UpdateTallaType) {
    const exists = await this.prismaService.talla.findUnique({
      where: { id },
      select: { id: true, etiqueta: true },
    });

    if (!exists) throw new NotFoundException('Talla no encontrada');

    if (dto.etiqueta && dto.etiqueta !== exists.etiqueta) {
      const dup = await this.prismaService.talla.findUnique({
        where: { etiqueta: dto.etiqueta },
        select: { id: true },
      });

      if (dup) throw new BadRequestException('La talla ya existe.');
    }

    const updated = await this.prismaService.talla.update({
      where: { id },
      data: {
        ...(dto.etiqueta !== undefined ? { etiqueta: dto.etiqueta } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });

    return CoreResponse.updated('Talla actualizada correctamente', updated);
  }

  // ===================================================================================
  async getTallas(options: QueryOptionsSchemaType) {
    try {
      const query = prismaQueryBuilder<
        PrismaClient.TallaWhereInput,
        PrismaClient.TallaInclude
      >(options, {
        allowedIncludes: ['variantes'],
        allowedFilters: ['id', 'etiqueta', 'activo', 'createdAt', 'updatedAt'],
      }); // relación en el modelo

      const page = options.page ? Number(options.page) : 1;
      const limit = resolveLimit(options);

      const total = await this.prismaService.talla.count({
        where: query.where,
      });

      const data = await this.prismaService.talla.findMany(query);

      return buildPaginatedResponse(data, total, page, limit);
    } catch (err) {
      return handlePrismaFilterError(err);
    }
  }
  // ===================================================================================
  // Borrado definitivo. Si la talla está en uso se bloquea: borrarla
  // arrastraría variantes por cascada. Para retirarla del catálogo sin
  // perder datos, basta con activo: false.
  async deleteTalla(id: number) {
    const registro = await this.prismaService.talla.findUnique({
      where: { id },
      select: { id: true, _count: { select: { variantes: true } } },
    });

    if (!registro) throw new NotFoundException('Talla no encontrada');

    const enUso = registro._count.variantes;

    if (enUso > 0) {
      throw new ConflictException({
        message:
          'La talla está en uso y no puede eliminarse. ' +
          'Desactívala con activo: false para ocultarla del catálogo.',
        variantes: enUso,
      });
    }

    await this.prismaService.talla.delete({ where: { id } });

    return CoreResponse.deleted('Talla eliminada correctamente');
  }
}
