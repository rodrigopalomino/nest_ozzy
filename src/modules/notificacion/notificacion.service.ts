//* src/modules/notificacion/notificacion.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EstadoNotificacion, Prisma, TipoNotificacion } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CoreResponse } from 'src/common/utils/response.util';
import { QueryOptionsDto } from 'src/common/dto/query-options.dto';
import {
  buildFilters,
  buildPagination,
  resolveLimit,
} from 'src/common/utils/prisma-query-builder';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { CONFIG_CLAVES } from '../configuracion/configuracion.constants';
import { EmailService } from './email.service';
import {
  DatosTienda,
  plantillaBienvenida,
  plantillaNovedades,
  plantillaOferta,
  plantillaStockDisponible,
} from './templates/email.templates';

// ===================================================================================
// Cola de notificaciones.
//
// Encolar y enviar están separados: si el SMTP está caído, el aviso queda
// PENDIENTE y un cron lo reintenta, en vez de perderse.
// ===================================================================================

const MAX_INTENTOS = 4;
const LOTE = 25;
const FILTROS = ['id', 'email', 'tipo', 'estado', 'canal', 'createdAt'];

@Injectable()
export class NotificacionService {
  private readonly logger = new Logger(NotificacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfiguracionService,
  ) {}

  // ===================================================================================
  private async datosTienda(): Promise<DatosTienda> {
    const c = await this.config.getVarias([
      CONFIG_CLAVES.TIENDA_NOMBRE,
      CONFIG_CLAVES.TIENDA_URL,
      CONFIG_CLAVES.TIENDA_MONEDA_SIMBOLO,
    ]);

    return {
      nombre: c[CONFIG_CLAVES.TIENDA_NOMBRE],
      url: c[CONFIG_CLAVES.TIENDA_URL].replace(/\/+$/, ''),
      simboloMoneda: c[CONFIG_CLAVES.TIENDA_MONEDA_SIMBOLO],
    };
  }

  // ===================================================================================
  private async encolar(params: {
    email: string;
    cliente_id?: number | null;
    tipo: TipoNotificacion;
    asunto: string;
    cuerpo: string;
    enviarAhora?: boolean;
  }) {
    const notificacion = await this.prisma.notificacion.create({
      data: {
        email: params.email,
        cliente_id: params.cliente_id ?? null,
        tipo: params.tipo,
        asunto: params.asunto,
        cuerpo: params.cuerpo,
      },
    });

    // Se intenta enviar de inmediato; si falla, el cron lo recoge.
    if (params.enviarAhora !== false) {
      await this.procesarUna(notificacion.id);
    }

    return notificacion;
  }

  // ===================================================================================
  private async procesarUna(id: number): Promise<boolean> {
    const n = await this.prisma.notificacion.findUnique({ where: { id } });

    if (!n || n.estado === EstadoNotificacion.ENVIADA) return false;

    const resultado = await this.email.enviar({
      para: n.email,
      asunto: n.asunto,
      html: n.cuerpo,
    });

    const intentos = n.intentos + 1;

    if (resultado.enviado) {
      await this.prisma.notificacion.update({
        where: { id },
        data: {
          estado: EstadoNotificacion.ENVIADA,
          enviadaEn: new Date(),
          intentos,
          error: null,
        },
      });
      return true;
    }

    // Agotados los intentos se marca FALLIDA para que deje de reintentarse
    // y quede visible en el panel.
    await this.prisma.notificacion.update({
      where: { id },
      data: {
        estado:
          intentos >= MAX_INTENTOS
            ? EstadoNotificacion.FALLIDA
            : EstadoNotificacion.PENDIENTE,
        intentos,
        error: resultado.error ?? 'Error desconocido',
      },
    });

    return false;
  }

  // ===================================================================================
  // Reintenta las pendientes. Cada 5 minutos es suficiente: los envíos
  // normales ya se intentan al encolar.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async procesarPendientes() {
    if (!this.email.habilitado) return;

    const pendientes = await this.prisma.notificacion.findMany({
      where: {
        estado: EstadoNotificacion.PENDIENTE,
        intentos: { lt: MAX_INTENTOS },
      },
      orderBy: { createdAt: 'asc' },
      take: LOTE,
      select: { id: true },
    });

    if (pendientes.length === 0) return;

    let enviadas = 0;
    for (const p of pendientes) {
      if (await this.procesarUna(p.id)) enviadas++;
    }

    this.logger.log(
      `Notificaciones procesadas: ${enviadas}/${pendientes.length}`,
    );
  }

  // ===================================================================================
  async enviarBienvenida(cliente: {
    id: number;
    email: string;
    nombre: string;
  }) {
    const tienda = await this.datosTienda();
    const { asunto, html } = plantillaBienvenida(tienda, cliente.nombre);

    return this.encolar({
      email: cliente.email,
      cliente_id: cliente.id,
      tipo: TipoNotificacion.BIENVENIDA,
      asunto,
      cuerpo: html,
    });
  }

  // ===================================================================================
  async enviarStockDisponible(params: {
    email: string;
    cliente_id?: number | null;
    producto: string;
    slug: string;
    variante: string | null;
    precio: number;
    // Va sólo en el cuerpo del correo, nunca en una respuesta HTTP.
    tokenBaja?: string;
  }) {
    const tienda = await this.datosTienda();
    const { asunto, html } = plantillaStockDisponible(tienda, params);

    return this.encolar({
      email: params.email,
      cliente_id: params.cliente_id,
      tipo: TipoNotificacion.STOCK_DISPONIBLE,
      asunto,
      cuerpo: html,
    });
  }

  // ===================================================================================
  async enviarOferta(params: {
    email: string;
    cliente_id?: number | null;
    producto: string;
    slug: string;
    precio: number;
    precioAnterior: number;
    descuento: number;
  }) {
    const tienda = await this.datosTienda();
    const { asunto, html } = plantillaOferta(tienda, params);

    return this.encolar({
      email: params.email,
      cliente_id: params.cliente_id,
      tipo: TipoNotificacion.OFERTA,
      asunto,
      cuerpo: html,
      // Los envíos masivos no bloquean la petición: los manda el cron.
      enviarAhora: false,
    });
  }

  // ===================================================================================
  // Difusión a los clientes que aceptaron novedades.
  // Cuántos clientes recibirían una difusión, sin enviar nada.
  //
  // El panel necesita este número para confirmar el envío: pedirlo llamando
  // a difundirNovedades sería ejecutar justo la acción que se quiere
  // confirmar, y no se puede deshacer.
  async destinatariosNovedades() {
    const total = await this.prisma.cliente.count({
      where: { activo: true, aceptaNovedades: true },
    });

    return CoreResponse.success('Destinatarios calculados', {
      destinatarios: total,
    });
  }

  // ===================================================================================
  async difundirNovedades(datos: {
    titulo: string;
    mensaje: string;
    enlace?: string;
  }) {
    const tienda = await this.datosTienda();
    const { asunto, html } = plantillaNovedades(tienda, datos);

    const clientes = await this.prisma.cliente.findMany({
      where: { activo: true, aceptaNovedades: true },
      select: { id: true, email: true },
    });

    if (clientes.length === 0) {
      return CoreResponse.success('No hay clientes suscritos a novedades', {
        encoladas: 0,
      });
    }

    await this.prisma.notificacion.createMany({
      data: clientes.map((c) => ({
        email: c.email,
        cliente_id: c.id,
        tipo: TipoNotificacion.NOVEDADES,
        asunto,
        cuerpo: html,
      })),
    });

    return CoreResponse.created('Novedades encoladas correctamente', {
      encoladas: clientes.length,
    });
  }

  // ===================================================================================
  async listar(options: QueryOptionsDto) {
    const where = buildFilters<Prisma.NotificacionWhereInput>(
      options.filtros,
      FILTROS,
    );

    const { take, skip, orderBy } = buildPagination(options);

    const [total, data] = await this.prisma.$transaction([
      this.prisma.notificacion.count({ where }),
      this.prisma.notificacion.findMany({
        where,
        take,
        skip,
        orderBy: orderBy ?? [{ createdAt: 'desc' }],
        // El cuerpo HTML no se devuelve en el listado: son kilobytes por fila.
        select: {
          id: true,
          email: true,
          tipo: true,
          canal: true,
          estado: true,
          asunto: true,
          intentos: true,
          error: true,
          enviadaEn: true,
          createdAt: true,
        },
      }),
    ]);

    return CoreResponse.paginated(
      'Notificaciones obtenidas correctamente',
      data,
      total,
      options.page ?? 1,
      resolveLimit(options),
    );
  }

  // ===================================================================================
  // Reintento manual desde el panel: reabre las fallidas.
  async reintentar(id: number) {
    const n = await this.prisma.notificacion.update({
      where: { id },
      data: { estado: EstadoNotificacion.PENDIENTE, intentos: 0, error: null },
      select: { id: true },
    });

    const enviada = await this.procesarUna(n.id);

    return CoreResponse.updated(
      enviada ? 'Notificación enviada' : 'Notificación reencolada',
      { id: n.id, enviada },
    );
  }
}
