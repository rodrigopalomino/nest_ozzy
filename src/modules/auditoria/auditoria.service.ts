//* src/modules/auditoria/auditoria.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { AccionAuditoria, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { QueryOptionsDto } from 'src/common/dto/query-options.dto';
import {
  buildFilters,
  buildPagination,
  resolveLimit,
} from 'src/common/utils/prisma-query-builder';
import { CoreResponse } from 'src/common/utils/response.util';

// ===================================================================================
// Bitácora de cambios del panel: quién modificó qué y cuándo.
//
// Registrar nunca debe tumbar la operación que se está auditando, así que
// los fallos se logean y se ignoran.
// ===================================================================================

const FILTROS = [
  'id',
  'entidad',
  'entidadId',
  'accion',
  'usuario_id',
  'usuarioNombre',
  'createdAt',
];

// Campos que no deben quedar registrados aunque cambien.
const CAMPOS_EXCLUIDOS = new Set(['password', 'tokenHash', 'tokenVersion']);

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===================================================================================
  // Calcula qué cambió realmente entre dos versiones de un registro.
  private diff(
    antes: Record<string, unknown> | null,
    despues: Record<string, unknown> | null,
  ): string | null {
    if (!antes && !despues) return null;

    const claves = new Set([
      ...Object.keys(antes ?? {}),
      ...Object.keys(despues ?? {}),
    ]);

    const cambios: Record<string, { antes: unknown; despues: unknown }> = {};

    for (const clave of claves) {
      if (CAMPOS_EXCLUIDOS.has(clave)) continue;

      const a = antes?.[clave];
      const d = despues?.[clave];

      // Se comparan serializados para que Decimal y Date no den falsos
      // positivos por diferencia de instancia.
      const sa = a instanceof Date ? a.toISOString() : String(a);
      const sd = d instanceof Date ? d.toISOString() : String(d);

      if (sa !== sd) cambios[clave] = { antes: a ?? null, despues: d ?? null };
    }

    if (Object.keys(cambios).length === 0) return null;

    return JSON.stringify(cambios);
  }

  // ===================================================================================
  async registrar(params: {
    entidad: string;
    entidadId: string | number;
    accion: AccionAuditoria;
    usuario?: { id: number; username: string } | null;
    antes?: Record<string, unknown> | null;
    despues?: Record<string, unknown> | null;
    ip?: string | null;
  }) {
    try {
      const cambios =
        params.accion === AccionAuditoria.ACTUALIZAR
          ? this.diff(params.antes ?? null, params.despues ?? null)
          : JSON.stringify(params.despues ?? params.antes ?? null);

      // Un ACTUALIZAR que no cambió nada no merece una entrada.
      if (params.accion === AccionAuditoria.ACTUALIZAR && cambios === null) {
        return;
      }

      await this.prisma.auditoria.create({
        data: {
          entidad: params.entidad,
          entidadId: String(params.entidadId),
          accion: params.accion,
          usuario_id: params.usuario?.id ?? null,
          usuarioNombre: params.usuario?.username ?? null,
          cambios,
          ip: params.ip ?? null,
        },
      });
    } catch (e) {
      // Auditar es importante, pero no al precio de romper la operación.
      this.logger.error('No se pudo registrar la auditoría', e as Error);
    }
  }

  // ===================================================================================
  async listar(options: QueryOptionsDto) {
    const where = buildFilters<Prisma.AuditoriaWhereInput>(
      options.filtros,
      FILTROS,
    );

    const { take, skip, orderBy } = buildPagination(options);

    const [total, data] = await this.prisma.$transaction([
      this.prisma.auditoria.count({ where }),
      this.prisma.auditoria.findMany({
        where,
        take,
        skip,
        orderBy: orderBy ?? [{ createdAt: 'desc' }],
        include: {
          usuario: { select: { id: true, username: true } },
        },
      }),
    ]);

    return CoreResponse.paginated(
      'Auditoría obtenida correctamente',
      data.map((a) => ({
        ...a,
        // Se devuelve como objeto para que el front no tenga que parsear.
        cambios: a.cambios ? (JSON.parse(a.cambios) as unknown) : null,
      })),
      total,
      options.page ?? 1,
      resolveLimit(options),
    );
  }
}
