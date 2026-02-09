import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma as PrismaClient } from '@prisma/client';

import { QueryOptionsSchemaType } from 'src/common/schema/query-options.schema';
import { prismaQueryBuilder } from 'src/common/utils/prisma-query-builder';
import { buildPaginatedResponse } from 'src/common/utils/paginate-response';
import { handlePrismaFilterError } from 'src/common/utils/prisma-filter.util';
import { CoreResponse } from 'src/common/utils/response.util';

import { CreateColeccionType } from './schema/createColeccion.schema';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateColeccionType } from './schema/updateColeccion.shema';

@Injectable()
export class ColeccionService {
  // ===================================================================================
  constructor(private readonly prismaService: PrismaService) {}

  // ===================================================================================
  async createColeccion(dto: CreateColeccionType) {
    const existente = await this.prismaService.coleccion.findUnique({
      where: { slug: dto.slug },
      select: { id: true },
    });

    if (existente) {
      throw new BadRequestException('La colección ya existe.');
    }

    const created = await this.prismaService.coleccion.create({
      data: {
        nombre: dto.nombre,
        slug: dto.slug,
        descripcion: dto.descripcion ?? null,
        imagenPortada: dto.imagenPortada ?? null,
        iniciaEn: dto.iniciaEn ?? null,
        terminaEn: dto.terminaEn ?? null,
        activo: dto.activo ?? true,
      },
    });

    return CoreResponse.created('Colección creada correctamente', created);
  }

  // ===================================================================================
  async updateColeccion(id: number, dto: UpdateColeccionType) {
    const exists = await this.prismaService.coleccion.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });

    if (!exists) throw new NotFoundException('Colección no encontrada');

    if (dto.slug && dto.slug !== exists.slug) {
      const dup = await this.prismaService.coleccion.findUnique({
        where: { slug: dto.slug },
        select: { id: true },
      });

      if (dup) throw new BadRequestException('La colección ya existe.');
    }

    const updated = await this.prismaService.coleccion.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
        ...(dto.descripcion !== undefined
          ? { descripcion: dto.descripcion }
          : {}),
        ...(dto.imagenPortada !== undefined
          ? { imagenPortada: dto.imagenPortada }
          : {}),
        ...(dto.iniciaEn !== undefined ? { iniciaEn: dto.iniciaEn } : {}),
        ...(dto.terminaEn !== undefined ? { terminaEn: dto.terminaEn } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });

    return CoreResponse.updated('Colección actualizada correctamente', updated);
  }

  // ===================================================================================
  async getColecciones(options: QueryOptionsSchemaType) {
    try {
      const query = prismaQueryBuilder<
        PrismaClient.ColeccionWhereInput,
        PrismaClient.ColeccionInclude
      >(options, ['productos']);

      const page = options.page ? Number(options.page) : 1;
      const limit = options.limit ? Number(options.limit) : undefined;

      const total = await this.prismaService.coleccion.count({
        where: query.where,
      });

      const data = await this.prismaService.coleccion.findMany(query);

      return buildPaginatedResponse(data, total, page, limit);
    } catch (err) {
      console.log('error => ', err);

      return handlePrismaFilterError(err);
    }
  }
}
