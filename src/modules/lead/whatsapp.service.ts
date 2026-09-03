//* src/modules/lead/whatsapp.service.ts

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { EstadoProducto, OrigenLead, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CoreResponse } from 'src/common/utils/response.util';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { CONFIG_CLAVES } from '../configuracion/configuracion.constants';
import { calcularPrecioEfectivo } from '../producto/utils/precio.util';
import {
  construirUrlWhatsapp,
  normalizarNumeroWhatsapp,
  rellenarPlantilla,
} from './utils/plantilla.util';

// ===================================================================================
// Genera el enlace de WhatsApp y registra el lead en la misma llamada.
//
// Antes el front componía el texto y conocía el número: cada cambio de copy
// exigía desplegar, y si el front olvidaba llamar a POST /lead la visita se
// perdía sin registro. Ahora el copy vive en Configuracion y el lead se
// registra siempre, porque es la misma operación que devuelve el enlace.
// ===================================================================================

// Ventana de deduplicación: dos pulsaciones seguidas son un solo lead.
const VENTANA_DEDUPE_MS = 5 * 60 * 1000;

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfiguracionService,
  ) {}

  // ===================================================================================
  // Huella para deduplicar sin almacenar la IP en claro.
  private huella(
    productoId: number,
    varianteId: number | null,
    ip: string | null,
  ): string {
    return createHash('sha256')
      .update(`${productoId}:${varianteId ?? 0}:${ip ?? 'sin-ip'}`)
      .digest('hex')
      .slice(0, 32);
  }

  // ===================================================================================
  async generarEnlace(params: {
    slug: string;
    varianteId?: number | null;
    origen?: OrigenLead;
    cupon?: string | null;
    ip?: string | null;
  }) {
    const producto = await this.prisma.producto.findFirst({
      where: {
        slug: params.slug,
        estado: EstadoProducto.ACTIVO,
        deletedAt: null,
      },
      select: {
        id: true,
        nombre: true,
        slug: true,
        precioBase: true,
        precio: true,
      },
    });

    if (!producto) throw new NotFoundException('Producto no encontrado');

    // ===================================================================================
    let variante: {
      id: number;
      precio: Prisma.Decimal | null;
      talla: { etiqueta: string };
      color: { nombre: string };
    } | null = null;

    if (params.varianteId) {
      variante = await this.prisma.varianteProducto.findFirst({
        where: {
          id: params.varianteId,
          producto_id: producto.id,
          activo: true,
        },
        select: {
          id: true,
          precio: true,
          talla: { select: { etiqueta: true } },
          color: { select: { nombre: true } },
        },
      });

      if (!variante) {
        throw new BadRequestException(
          'La variante no pertenece a este producto o no está activa',
        );
      }
    }

    // ===================================================================================
    const ajustes = await this.config.getVarias([
      CONFIG_CLAVES.WHATSAPP_NUMERO,
      CONFIG_CLAVES.WHATSAPP_MENSAJE_PLANTILLA,
      CONFIG_CLAVES.TIENDA_URL,
      CONFIG_CLAVES.TIENDA_MONEDA_SIMBOLO,
    ]);

    const numero = normalizarNumeroWhatsapp(
      ajustes[CONFIG_CLAVES.WHATSAPP_NUMERO],
    );

    if (!numero) {
      throw new BadRequestException(
        'No hay número de WhatsApp configurado. Configúralo en el panel (clave whatsapp.numero).',
      );
    }

    // ===================================================================================
    const precio = calcularPrecioEfectivo({
      precioBase: producto.precioBase,
      precio: producto.precio,
      precioVariante: variante?.precio,
    });

    const simbolo = ajustes[CONFIG_CLAVES.TIENDA_MONEDA_SIMBOLO];
    const urlTienda = ajustes[CONFIG_CLAVES.TIENDA_URL].replace(/\/+$/, '');
    const urlProducto = `${urlTienda}/producto/${producto.slug}`;

    const talla = variante?.talla.etiqueta ?? '';
    const color = variante?.color.nombre ?? '';

    const mensaje = rellenarPlantilla(
      ajustes[CONFIG_CLAVES.WHATSAPP_MENSAJE_PLANTILLA],
      {
        producto: producto.nombre,
        talla,
        color,
        // Línea completa de la variante, vacía si no se eligió ninguna.
        variante: variante ? `Talla: ${talla}\nColor: ${color}\n` : '',
        precio: `${simbolo} ${precio.precio.toFixed(2)}`,
        url: urlProducto,
      },
    ).trim();

    // ===================================================================================
    const cupon = params.cupon ? await this.resolverCupon(params.cupon) : null;

    const mensajeFinal = cupon
      ? `${mensaje}\n\nCupón: ${cupon.codigo}`
      : mensaje;

    const url = construirUrlWhatsapp(numero, mensajeFinal);

    // ===================================================================================
    // El lead se registra aquí: es la misma operación, así que no puede
    // quedarse sin registrar por un olvido del front.
    const huella = this.huella(
      producto.id,
      variante?.id ?? null,
      params.ip ?? null,
    );

    const reciente = await this.prisma.leadWhatsApp.findFirst({
      where: {
        huella,
        createdAt: { gte: new Date(Date.now() - VENTANA_DEDUPE_MS) },
      },
      select: { id: true },
    });

    let leadId = reciente?.id ?? null;

    if (!reciente) {
      try {
        const lead = await this.prisma.leadWhatsApp.create({
          data: {
            producto_id: producto.id,
            variante_id: variante?.id ?? null,
            mensaje: mensajeFinal,
            origen: params.origen ?? OrigenLead.DETALLE_PRODUCTO,
            precioMostrado: precio.precio,
            huella,
            cupon_id: cupon?.id ?? null,
          },
          select: { id: true },
        });

        leadId = lead.id;
      } catch (e) {
        // Si el registro falla, el cliente debe recibir su enlace igual:
        // perder un lead es malo, perder la venta es peor.
        this.logger.error('No se pudo registrar el lead', e as Error);
      }
    }

    return CoreResponse.success('Enlace de WhatsApp generado', {
      url,
      mensaje: mensajeFinal,
      numero,
      lead_id: leadId,
      duplicado: Boolean(reciente),
      producto: {
        id: producto.id,
        nombre: producto.nombre,
        slug: producto.slug,
      },
      variante: variante ? { id: variante.id, talla, color } : null,
      precio,
      cupon: cupon ? { codigo: cupon.codigo } : null,
    });
  }

  // ===================================================================================
  // Valida el cupón sin consumirlo: el uso se confirma al cerrar la venta.
  private async resolverCupon(codigo: string) {
    const ahora = new Date();

    const cupon = await this.prisma.cupon.findFirst({
      where: {
        codigo: codigo.trim().toUpperCase(),
        activo: true,
        OR: [{ iniciaEn: null }, { iniciaEn: { lte: ahora } }],
        AND: [{ OR: [{ terminaEn: null }, { terminaEn: { gte: ahora } }] }],
      },
      select: { id: true, codigo: true, usoMaximo: true, usos: true },
    });

    if (!cupon) return null;

    if (cupon.usoMaximo !== null && cupon.usos >= cupon.usoMaximo) return null;

    return cupon;
  }
}
