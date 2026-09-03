//* src/modules/cupon/cupon.service.ts

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CoreResponse } from 'src/common/utils/response.util';
import { aFecha } from 'src/common/schema/fecha.schema';
import { CrearCuponType, ActualizarCuponType } from './schema/cupon.schema';

// ===================================================================================
// Cupones de descuento.
//
// El cierre de la venta es por WhatsApp, así que el cupón no descuenta nada
// automáticamente: viaja en el lead y se consume cuando el lead se marca
// como VENDIDO.
// ===================================================================================

@Injectable()
export class CuponService {
  constructor(private readonly prisma: PrismaService) {}

  // ===================================================================================
  private aSalida(cupon: {
    montoFijo: Prisma.Decimal | null;
    [k: string]: unknown;
  }) {
    return {
      ...cupon,
      // Prisma serializa Decimal como string: se normaliza a número.
      montoFijo: cupon.montoFijo != null ? Number(cupon.montoFijo) : null,
    };
  }

  // ===================================================================================
  async crear(dto: CrearCuponType) {
    const existe = await this.prisma.cupon.findUnique({
      where: { codigo: dto.codigo },
      select: { id: true },
    });

    if (existe) throw new ConflictException('Ese código ya existe');

    const cupon = await this.prisma.cupon.create({
      data: {
        codigo: dto.codigo,
        porcentaje: dto.porcentaje ?? null,
        montoFijo:
          dto.montoFijo != null ? new Prisma.Decimal(dto.montoFijo) : null,
        iniciaEn: aFecha(dto.iniciaEn) ?? null,
        terminaEn: aFecha(dto.terminaEn) ?? null,
        usoMaximo: dto.usoMaximo ?? null,
        activo: dto.activo ?? true,
      },
    });

    return CoreResponse.created(
      'Cupón creado correctamente',
      this.aSalida(cupon),
    );
  }

  // ===================================================================================
  async actualizar(id: number, dto: ActualizarCuponType) {
    const existe = await this.prisma.cupon.findUnique({
      where: { id },
      select: { id: true, codigo: true },
    });

    if (!existe) throw new NotFoundException('Cupón no encontrado');

    if (dto.codigo && dto.codigo !== existe.codigo) {
      const dup = await this.prisma.cupon.findUnique({
        where: { codigo: dto.codigo },
        select: { id: true },
      });

      if (dup) throw new ConflictException('Ese código ya existe');
    }

    const cupon = await this.prisma.cupon.update({
      where: { id },
      data: {
        ...(dto.codigo !== undefined ? { codigo: dto.codigo } : {}),
        ...(dto.porcentaje !== undefined ? { porcentaje: dto.porcentaje } : {}),
        ...(dto.montoFijo !== undefined
          ? {
              montoFijo:
                dto.montoFijo != null
                  ? new Prisma.Decimal(dto.montoFijo)
                  : null,
            }
          : {}),
        ...(dto.iniciaEn !== undefined
          ? { iniciaEn: aFecha(dto.iniciaEn) }
          : {}),
        ...(dto.terminaEn !== undefined
          ? { terminaEn: aFecha(dto.terminaEn) }
          : {}),
        ...(dto.usoMaximo !== undefined ? { usoMaximo: dto.usoMaximo } : {}),
        ...(dto.activo !== undefined ? { activo: dto.activo } : {}),
      },
    });

    return CoreResponse.updated(
      'Cupón actualizado correctamente',
      this.aSalida(cupon),
    );
  }

  // ===================================================================================
  async listar() {
    const cupones = await this.prisma.cupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { leads: true } } },
    });

    return CoreResponse.success(
      'Cupones obtenidos correctamente',
      cupones.map(({ _count, ...c }) => ({
        ...this.aSalida(c),
        leads: _count.leads,
      })),
    );
  }

  // ===================================================================================
  async eliminar(id: number) {
    const cupon = await this.prisma.cupon.findUnique({
      where: { id },
      select: { id: true, _count: { select: { leads: true } } },
    });

    if (!cupon) throw new NotFoundException('Cupón no encontrado');

    // Con leads asociados se desactiva en lugar de borrarse: el histórico
    // de qué cupón trajo qué contacto no debe perderse.
    if (cupon._count.leads > 0) {
      throw new ConflictException({
        message:
          'El cupón tiene leads asociados. Desactívalo con activo: false ' +
          'para conservar el histórico.',
        leads: cupon._count.leads,
      });
    }

    await this.prisma.cupon.delete({ where: { id } });

    return CoreResponse.deleted('Cupón eliminado correctamente');
  }

  // ===================================================================================
  // Validación pública: el front comprueba el código antes de armar el
  // mensaje de WhatsApp. No revela cupones inactivos ni agotados.
  async validar(codigo: string) {
    const ahora = new Date();

    const cupon = await this.prisma.cupon.findFirst({
      where: {
        codigo: codigo.trim().toUpperCase(),
        activo: true,
        AND: [
          { OR: [{ iniciaEn: null }, { iniciaEn: { lte: ahora } }] },
          { OR: [{ terminaEn: null }, { terminaEn: { gte: ahora } }] },
        ],
      },
      select: {
        codigo: true,
        porcentaje: true,
        montoFijo: true,
        usoMaximo: true,
        usos: true,
        terminaEn: true,
      },
    });

    // Un cupón inválido no es un error de la petición: es una respuesta
    // legítima. Devolver 400 obligaba al front a distinguir "código malo"
    // de "fallo de red" inspeccionando excepciones.
    if (!cupon) {
      return CoreResponse.success('El cupón no existe o ya no es válido', {
        valido: false as const,
        motivo: 'INVALIDO' as const,
        codigo: codigo.trim().toUpperCase(),
      });
    }

    if (cupon.usoMaximo !== null && cupon.usos >= cupon.usoMaximo) {
      return CoreResponse.success('El cupón alcanzó su límite de usos', {
        valido: false as const,
        motivo: 'AGOTADO' as const,
        codigo: cupon.codigo,
      });
    }

    return CoreResponse.success('Cupón válido', {
      valido: true as const,
      codigo: cupon.codigo,
      porcentaje: cupon.porcentaje,
      montoFijo: cupon.montoFijo != null ? Number(cupon.montoFijo) : null,
      terminaEn: cupon.terminaEn,
    });
  }
}
