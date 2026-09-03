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
import { CreateColorType } from './schema/createColor.schema';
import { UpdateColorType } from './schema/updateColor.shema';

@Injectable()
export class ColorService {
  // ===================================================================================
  constructor(private readonly prismaService: PrismaService) {}

  // ===================================================================================
  async createColor(dto: CreateColorType) {
    const existente = await this.prismaService.color.findUnique({
      where: { nombre: dto.nombre },
      select: { id: true },
    });

    if (existente) {
      throw new BadRequestException('El color ya existe.');
    }

    const created = await this.prismaService.color.create({
      data: {
        nombre: dto.nombre,
        hex: dto.hex ?? null,
        activo: dto.activo ?? true,
      },
    });

    return CoreResponse.created('Color creado correctamente', created);
  }

  // ===================================================================================
  async updateColor(id: number, dto: UpdateColorType) {
    const exists = await this.prismaService.color.findUnique({
      where: { id },
      select: { id: true, nombre: true },
    });

    if (!exists) throw new NotFoundException('Color no encontrado');

    if (dto.nombre && dto.nombre !== exists.nombre) {
      const dup = await this.prismaService.color.findUnique({
        where: { nombre: dto.nombre },
        select: { id: true },
      });

      if (dup) throw new BadRequestException('El color ya existe.');
    }

    const updated = await this.prismaService.color.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
        ...(dto.hex !== undefined ? { hex: dto.hex } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });

    return CoreResponse.updated('Color actualizado correctamente', updated);
  }

  // ===================================================================================
  async getColors(options: QueryOptionsSchemaType) {
    try {
      const query = prismaQueryBuilder<
        PrismaClient.ColorWhereInput,
        PrismaClient.ColorInclude
      >(options, {
        allowedIncludes: [],
        allowedFilters: [
          'id',
          'nombre',
          'hex',
          'activo',
          'createdAt',
          'updatedAt',
        ],
      }); // no includes por defecto

      const page = options.page ? Number(options.page) : 1;
      const limit = resolveLimit(options);

      const total = await this.prismaService.color.count({
        where: query.where,
      });

      const data = await this.prismaService.color.findMany(query);

      return buildPaginatedResponse(data, total, page, limit);
    } catch (err) {
      return handlePrismaFilterError(err);
    }
  }
  // ===================================================================================
  // Borrado definitivo. Si el color está en uso se bloquea: borrarla
  // arrastraría variantes por cascada. Para retirarla del catálogo sin
  // perder datos, basta con activo: false.
  async deleteColor(id: number) {
    const registro = await this.prismaService.color.findUnique({
      where: { id },
      select: { id: true, _count: { select: { variantes: true } } },
    });

    if (!registro) throw new NotFoundException('Color no encontrado');

    const enUso = registro._count.variantes;

    if (enUso > 0) {
      throw new ConflictException({
        message:
          'El color está en uso y no puede eliminarse. ' +
          'Desactívala con activo: false para ocultarla del catálogo.',
        variantes: enUso,
      });
    }

    await this.prismaService.color.delete({ where: { id } });

    return CoreResponse.deleted('Color eliminado correctamente');
  }
}
