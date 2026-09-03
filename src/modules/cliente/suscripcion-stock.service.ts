//* src/modules/cliente/suscripcion-stock.service.ts

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { EstadoProducto } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CoreResponse } from 'src/common/utils/response.util';
import { NotificacionService } from '../notificacion/notificacion.service';
import { calcularPrecioEfectivo } from '../producto/utils/precio.util';

// ===================================================================================
// Avisos de reposición.
//
// Convierte una visita perdida (talla agotada) en un contacto: el visitante
// deja su correo y se le escribe cuando vuelve el stock.
// ===================================================================================

@Injectable()
export class SuscripcionStockService {
  private readonly logger = new Logger(SuscripcionStockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificacion: NotificacionService,
  ) {}

  // ===================================================================================
  async suscribir(params: {
    varianteId: number;
    email: string;
    clienteId?: number | null;
  }) {
    const variante = await this.prisma.varianteProducto.findFirst({
      where: {
        id: params.varianteId,
        producto: { estado: EstadoProducto.ACTIVO, deletedAt: null },
      },
      select: { id: true, producto_id: true, stock: true },
    });

    if (!variante) throw new BadRequestException('Variante no disponible');

    // Suscribirse a algo que ya está disponible no tiene sentido y evita
    // avisos inmediatos y confusos.
    if (variante.stock === null || variante.stock > 0) {
      throw new BadRequestException({
        message: 'Esta variante ya está disponible.',
        stock: variante.stock,
      });
    }

    const email = params.email.trim().toLowerCase();

    // Token de baja nuevo en cada suscripción. En la base sólo queda su
    // hash, y el valor en claro viaja únicamente en el correo que se envía
    // a esa dirección.
    const token = randomBytes(32).toString('base64url');

    // La clave única es (variante, email): repetir la petición no duplica.
    const suscripcion = await this.prisma.suscripcionStock.upsert({
      where: {
        variante_id_email: { variante_id: params.varianteId, email },
      },
      update: {
        cliente_id: params.clienteId ?? null,
        // Si ya se le avisó antes, se reabre para el siguiente agotamiento.
        notificadoEn: null,
        // Rotar el token invalida los enlaces de baja anteriores.
        tokenBajaHash: this.hashToken(token),
      },
      create: {
        producto_id: variante.producto_id,
        variante_id: params.varianteId,
        cliente_id: params.clienteId ?? null,
        email,
        tokenBajaHash: this.hashToken(token),
      },
      select: { id: true, email: true, createdAt: true },
    });

    // El token NO se devuelve en la respuesta: este endpoint es público, y
    // devolverlo permitiría a un tercero suscribir el correo de otra
    // persona y obtener con qué cancelar su aviso.
    return CoreResponse.created(
      'Te avisaremos por correo cuando vuelva a estar disponible',
      suscripcion,
    );
  }

  // ===================================================================================
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // ===================================================================================
  // La baja se resuelve por el token, no por el correo: quien no recibió el
  // correo no puede cancelar la suscripción de otra persona.
  async cancelar(token: string) {
    if (!token || token.length < 20) {
      throw new BadRequestException('Enlace de baja inválido');
    }

    const suscripcion = await this.prisma.suscripcionStock.findUnique({
      where: { tokenBajaHash: this.hashToken(token) },
      select: { id: true, email: true },
    });

    if (!suscripcion) {
      throw new BadRequestException('Enlace de baja inválido o ya utilizado');
    }

    await this.prisma.suscripcionStock.delete({
      where: { id: suscripcion.id },
    });

    return CoreResponse.deleted('Aviso cancelado correctamente');
  }

  // ===================================================================================
  // Se llama después de subir el stock de una variante. Encola un correo
  // por cada suscriptor pendiente y los marca como notificados.
  async notificarReposicion(varianteId: number) {
    const variante = await this.prisma.varianteProducto.findUnique({
      where: { id: varianteId },
      select: {
        id: true,
        stock: true,
        precio: true,
        talla: { select: { etiqueta: true } },
        color: { select: { nombre: true } },
        producto: {
          select: {
            nombre: true,
            slug: true,
            precioBase: true,
            estado: true,
            precio: true,
          },
        },
      },
    });

    // Sólo se avisa si de verdad hay stock y el producto sigue publicado.
    if (
      !variante ||
      variante.stock === null ||
      variante.stock <= 0 ||
      variante.producto.estado !== EstadoProducto.ACTIVO
    ) {
      return 0;
    }

    const pendientes = await this.prisma.suscripcionStock.findMany({
      where: { variante_id: varianteId, notificadoEn: null },
      select: { id: true, email: true, cliente_id: true },
    });

    if (pendientes.length === 0) return 0;

    // El token de baja se rota justo antes de enviar: en la base sólo hay
    // su hash, así que el valor en claro que va en el enlace del correo se
    // genera aquí, que es el único momento en que se necesita.
    const tokens = new Map<number, string>();

    for (const s of pendientes) {
      const token = randomBytes(32).toString('base64url');
      tokens.set(s.id, token);

      await this.prisma.suscripcionStock.update({
        where: { id: s.id },
        data: { tokenBajaHash: this.hashToken(token) },
      });
    }

    const precio = calcularPrecioEfectivo({
      precioBase: variante.producto.precioBase,
      precio: variante.producto.precio,
      precioVariante: variante.precio,
    });

    const etiqueta = `${variante.color.nombre} / ${variante.talla.etiqueta}`;

    for (const s of pendientes) {
      await this.notificacion
        .enviarStockDisponible({
          email: s.email,
          cliente_id: s.cliente_id,
          producto: variante.producto.nombre,
          slug: variante.producto.slug,
          variante: etiqueta,
          precio: precio.precio,
          tokenBaja: tokens.get(s.id)!,
        })
        .catch((e: Error) =>
          this.logger.warn(
            `No se pudo encolar el aviso para ${s.email}: ${e.message}`,
          ),
        );
    }

    // Se marcan aunque el SMTP falle: la notificación ya está en su cola
    // con reintentos, y así no se reenvía en cada actualización de stock.
    await this.prisma.suscripcionStock.updateMany({
      where: { id: { in: pendientes.map((s) => s.id) } },
      data: { notificadoEn: new Date() },
    });

    this.logger.log(
      `Avisos de reposición encolados: ${pendientes.length} (variante ${varianteId})`,
    );

    return pendientes.length;
  }

  // ===================================================================================
  async listarAdmin() {
    const suscripciones = await this.prisma.suscripcionStock.findMany({
      where: { notificadoEn: null },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        producto: { select: { id: true, nombre: true, slug: true } },
        variante: {
          select: {
            id: true,
            stock: true,
            talla: { select: { etiqueta: true } },
            color: { select: { nombre: true } },
          },
        },
      },
    });

    return CoreResponse.success(
      'Avisos pendientes obtenidos correctamente',
      suscripciones,
    );
  }
}
