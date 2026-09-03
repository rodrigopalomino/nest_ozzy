import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryOptionsSchemaType } from 'src/common/schema/query-options.schema';
import { Prisma } from '@prisma/client';
import {
  prismaQueryBuilder,
  resolveLimit,
} from 'src/common/utils/prisma-query-builder';
import { buildPaginatedResponse } from 'src/common/utils/paginate-response';
import { handlePrismaFilterError } from 'src/common/utils/prisma-filter.util';
import { CreateCategoriaType } from './schema/createCategoria.schema';
import { CoreResponse } from 'src/common/utils/response.util';
import { UpdateCategoriaType } from './schema/updateCategoria.shema';

@Injectable()
export class CategoriaService {
  // ===================================================================================
  constructor(private readonly prismaService: PrismaService) {}

  // ===================================================================================
  async createCategoria(dto: CreateCategoriaType) {
    const categoriaExistente = await this.prismaService.categoria.findUnique({
      where: { slug: dto.slug },
      select: { id: true },
    });

    if (categoriaExistente) {
      throw new BadRequestException('La categoria ya existe.');
    }

    const created = await this.prismaService.categoria.create({
      data: {
        nombre: dto.nombre,
        slug: dto.slug,
      },
    });

    return CoreResponse.created('Categoría creada correctamente', created);
  }

  async updateCategoria(id: number, dto: UpdateCategoriaType) {
    const exists = await this.prismaService.categoria.findUnique({
      where: { id },
      select: { id: true, slug: true },
    });

    if (!exists) throw new NotFoundException('Categoría no encontrada');

    if (dto.slug && dto.slug !== exists.slug) {
      const dup = await this.prismaService.categoria.findUnique({
        where: { slug: dto.slug },
        select: { id: true },
      });

      if (dup) throw new BadRequestException('La categoria ya existe.');
    }

    const updated = await this.prismaService.categoria.update({
      where: { id },
      data: {
        ...(dto.nombre !== undefined ? { nombre: dto.nombre } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });

    return CoreResponse.updated('Categoría actualizada correctamente', updated);
  }

  // ===================================================================================
  async getCategorias(options: QueryOptionsSchemaType) {
    try {
      const query = prismaQueryBuilder<
        Prisma.CategoriaWhereInput,
        Prisma.CategoriaInclude
      >(options, {
        allowedIncludes: ['productos'],
        allowedFilters: [
          'id',
          'nombre',
          'slug',
          'activo',
          'createdAt',
          'updatedAt',
        ],
      });

      const page = options.page ? Number(options.page) : 1;
      const limit = resolveLimit(options);

      const total = await this.prismaService.categoria.count({
        where: query.where,
      });

      const data = await this.prismaService.categoria.findMany(query);

      return buildPaginatedResponse(data, total, page, limit);
    } catch (err) {
      return handlePrismaFilterError(err);
    }
  }
  // ===================================================================================
  // Borrado definitivo. Si la categoria está en uso se bloquea: borrarla
  // arrastraría productos por cascada. Para retirarla del catálogo sin
  // perder datos, basta con activo: false.
  async deleteCategoria(id: number) {
    const registro = await this.prismaService.categoria.findUnique({
      where: { id },
      select: { id: true, _count: { select: { productos: true } } },
    });

    if (!registro) throw new NotFoundException('Categoría no encontrada');

    const enUso = registro._count.productos;

    if (enUso > 0) {
      throw new ConflictException({
        message:
          'La categoria está en uso y no puede eliminarse. ' +
          'Desactívala con activo: false para ocultarla del catálogo.',
        productos: enUso,
      });
    }

    await this.prismaService.categoria.delete({ where: { id } });

    return CoreResponse.deleted('Categoría eliminada correctamente');
  }
}
