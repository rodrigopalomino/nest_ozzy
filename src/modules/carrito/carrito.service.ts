//* src/modules/carrito/carrito.service.ts

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EstadoProducto, Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { CoreResponse } from 'src/common/utils/response.util';
import { ConfiguracionService } from '../configuracion/configuracion.service';
import { CONFIG_CLAVES } from '../configuracion/configuracion.constants';
import {
  calcularPrecioEfectivo,
  estaAgotado,
  type PrecioEfectivo,
} from '../producto/utils/precio.util';
import {
  construirUrlWhatsapp,
  normalizarNumeroWhatsapp,
  rellenarPlantilla,
} from '../lead/utils/plantilla.util';

// ===================================================================================
// Carrito que se cierra por WhatsApp.
//
// No exige cuenta: hasta que el cliente inicia sesión se identifica por el
// id de dispositivo, igual que los favoritos, y al entrar con Google se
// adopta. Así se puede añadir al carrito desde el primer clic.
//
// El precio y el total NUNCA vienen del cliente: se recalculan aquí con la
// misma cascada que el catálogo, para que el mensaje que llega al vendedor
// no pueda manipularse desde el navegador.
// ===================================================================================

// Igual que en favoritos: lo genera el navegador con crypto.randomUUID().
const DISPOSITIVO_REGEX = /^[a-zA-Z0-9-]{8,64}$/;

// Tope por línea: evita pedidos absurdos por un error de teclado.
const CANTIDAD_MAXIMA = 20;

// Tope de líneas distintas: el mensaje de WhatsApp tiene límite de longitud.
const LINEAS_MAXIMAS = 30;

interface Identidad {
  clienteId?: number | null;
  dispositivo?: string | null;
}

// ===================================================================================
const CARRITO_INCLUDE = Prisma.validator<Prisma.CarritoInclude>()({
  items: {
    orderBy: { createdAt: 'asc' },
    include: {
      variante: {
        include: {
          talla: { select: { id: true, etiqueta: true, activo: true } },
          color: {
            select: { id: true, nombre: true, hex: true, activo: true },
          },
          producto: {
            select: {
              id: true,
              nombre: true,
              slug: true,
              estado: true,
              deletedAt: true,
              precioBase: true,
              precio: true,
              imagenes: {
                where: { esPrincipal: true },
                take: 1,
                select: { url: true, urlSm: true, alt: true },
              },
            },
          },
        },
      },
    },
  },
});

type CarritoConItems = Prisma.CarritoGetPayload<{
  include: typeof CARRITO_INCLUDE;
}>;

// ===================================================================================
export interface CarritoItemSalida {
  id: number;
  variante_id: number;
  cantidad: number;

  producto: { id: number; nombre: string; slug: string };
  talla: { id: number; etiqueta: string };
  color: { id: number; nombre: string; hex: string | null };

  imagen: { url: string; urlSm: string | null; alt: string | null } | null;

  precio: PrecioEfectivo;
  subtotal: number;

  agotado: boolean;
  // Una línea deja de ser pedible si el producto se ocultó o la variante se
  // desactivó después de añadirla. Se marca en lugar de borrarla en
  // silencio, para que el cliente entienda por qué cambió su carrito.
  disponible: boolean;
}

export interface CarritoSalida {
  id: number | null;
  items: CarritoItemSalida[];
  cantidad: number;
  total: number;
  moneda: string;
  simbolo: string;
}

// ===================================================================================
@Injectable()
export class CarritoService {
  private readonly logger = new Logger(CarritoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfiguracionService,
  ) {}

  // ===================================================================================
  // La identidad es o el cliente autenticado, o el dispositivo. El cliente
  // manda: si hay sesión, el dispositivo se ignora.
  private resolver(identidad: Identidad): {
    cliente_id: number | null;
    dispositivo: string | null;
  } {
    const { clienteId, dispositivo } = identidad;

    if (clienteId) return { cliente_id: clienteId, dispositivo: null };

    if (!dispositivo || !DISPOSITIVO_REGEX.test(dispositivo)) {
      throw new BadRequestException(
        'Se requiere iniciar sesión o enviar un identificador de dispositivo válido.',
      );
    }

    return { cliente_id: null, dispositivo };
  }

  // ===================================================================================
  private async buscar(identidad: Identidad) {
    const clave = this.resolver(identidad);

    return this.prisma.carrito.findFirst({
      where: clave.cliente_id
        ? { cliente_id: clave.cliente_id }
        : { dispositivo: clave.dispositivo },
      include: CARRITO_INCLUDE,
    });
  }

  private async buscarOCrear(identidad: Identidad) {
    const existente = await this.buscar(identidad);
    if (existente) return existente;

    const clave = this.resolver(identidad);

    return this.prisma.carrito.create({
      data: clave,
      include: CARRITO_INCLUDE,
    });
  }

  // ===================================================================================
  // Precio y disponibilidad calculados en el servidor, línea por línea.
  private async mapear(
    carrito: CarritoConItems | null,
  ): Promise<CarritoSalida> {
    const ajustes = await this.config.getVarias([
      CONFIG_CLAVES.TIENDA_MONEDA,
      CONFIG_CLAVES.TIENDA_MONEDA_SIMBOLO,
    ]);

    const moneda = ajustes[CONFIG_CLAVES.TIENDA_MONEDA];
    const simbolo = ajustes[CONFIG_CLAVES.TIENDA_MONEDA_SIMBOLO];

    if (!carrito) {
      return {
        id: null,
        items: [],
        cantidad: 0,
        total: 0,
        moneda,
        simbolo,
      };
    }

    const ahora = new Date();

    const items: CarritoItemSalida[] = carrito.items.map((item) => {
      const { variante } = item;
      const { producto } = variante;

      const precio = calcularPrecioEfectivo({
        precioBase: producto.precioBase,
        precio: producto.precio,
        precioVariante: variante.precio,
        ahora,
      });

      const disponible =
        producto.estado === EstadoProducto.ACTIVO &&
        producto.deletedAt === null &&
        variante.activo &&
        variante.talla.activo &&
        variante.color.activo;

      const imagen = producto.imagenes[0] ?? null;

      return {
        id: item.id,
        variante_id: variante.id,
        cantidad: item.cantidad,

        producto: {
          id: producto.id,
          nombre: producto.nombre,
          slug: producto.slug,
        },
        talla: { id: variante.talla.id, etiqueta: variante.talla.etiqueta },
        color: {
          id: variante.color.id,
          nombre: variante.color.nombre,
          hex: variante.color.hex,
        },

        imagen: imagen
          ? { url: imagen.url, urlSm: imagen.urlSm, alt: imagen.alt }
          : null,

        precio,
        subtotal: Number((precio.precio * item.cantidad).toFixed(2)),

        agotado: estaAgotado(variante.stock),
        disponible,
      };
    });

    // El total suma sólo lo que se puede pedir: incluir una línea caída
    // daría un total que el vendedor no va a cobrar.
    const pedibles = items.filter((i) => i.disponible);

    return {
      id: carrito.id,
      items,
      cantidad: pedibles.reduce((n, i) => n + i.cantidad, 0),
      total: Number(pedibles.reduce((s, i) => s + i.subtotal, 0).toFixed(2)),
      moneda,
      simbolo,
    };
  }

  // ===================================================================================
  async ver(identidad: Identidad) {
    const carrito = await this.buscar(identidad);

    return CoreResponse.success(
      'Carrito obtenido correctamente',
      await this.mapear(carrito),
    );
  }

  // ===================================================================================
  // Añadir suma a la cantidad existente en lugar de duplicar la línea.
  async agregar(varianteId: number, cantidad: number, identidad: Identidad) {
    if (cantidad < 1 || cantidad > CANTIDAD_MAXIMA) {
      throw new BadRequestException(
        `La cantidad debe estar entre 1 y ${CANTIDAD_MAXIMA}`,
      );
    }

    const variante = await this.prisma.varianteProducto.findFirst({
      where: {
        id: varianteId,
        activo: true,
        talla: { activo: true },
        color: { activo: true },
        producto: { estado: EstadoProducto.ACTIVO, deletedAt: null },
      },
      select: { id: true },
    });

    if (!variante) {
      throw new BadRequestException('La variante no está disponible');
    }

    const carrito = await this.buscarOCrear(identidad);

    const existente = carrito.items.find((i) => i.variante_id === varianteId);

    if (!existente && carrito.items.length >= LINEAS_MAXIMAS) {
      throw new BadRequestException(
        `El carrito no puede tener más de ${LINEAS_MAXIMAS} productos distintos`,
      );
    }

    // El tope se aplica también al sumar: 15 + 10 no puede acabar en 25.
    const nueva = Math.min(
      (existente?.cantidad ?? 0) + cantidad,
      CANTIDAD_MAXIMA,
    );

    await this.prisma.carritoItem.upsert({
      where: {
        carrito_id_variante_id: {
          carrito_id: carrito.id,
          variante_id: varianteId,
        },
      },
      create: {
        carrito_id: carrito.id,
        variante_id: varianteId,
        cantidad: nueva,
      },
      update: { cantidad: nueva },
    });

    // `updatedAt` del carrito sirve para detectar carritos abandonados.
    await this.prisma.carrito.update({
      where: { id: carrito.id },
      data: { updatedAt: new Date() },
    });

    const actualizado = await this.buscar(identidad);

    return CoreResponse.created(
      'Producto agregado al carrito',
      await this.mapear(actualizado),
    );
  }

  // ===================================================================================
  // Cantidad 0 equivale a quitar la línea: ahorra al front una rama.
  async actualizarCantidad(
    varianteId: number,
    cantidad: number,
    identidad: Identidad,
  ) {
    if (cantidad < 0 || cantidad > CANTIDAD_MAXIMA) {
      throw new BadRequestException(
        `La cantidad debe estar entre 0 y ${CANTIDAD_MAXIMA}`,
      );
    }

    const carrito = await this.buscar(identidad);

    if (!carrito) throw new NotFoundException('El carrito está vacío');

    const item = carrito.items.find((i) => i.variante_id === varianteId);

    if (!item) throw new NotFoundException('El producto no está en el carrito');

    if (cantidad === 0) {
      await this.prisma.carritoItem.delete({ where: { id: item.id } });
    } else {
      await this.prisma.carritoItem.update({
        where: { id: item.id },
        data: { cantidad },
      });
    }

    const actualizado = await this.buscar(identidad);

    return CoreResponse.updated(
      cantidad === 0 ? 'Producto quitado del carrito' : 'Carrito actualizado',
      await this.mapear(actualizado),
    );
  }

  // ===================================================================================
  async quitar(varianteId: number, identidad: Identidad) {
    return this.actualizarCantidad(varianteId, 0, identidad);
  }

  // ===================================================================================
  async vaciar(identidad: Identidad) {
    const carrito = await this.buscar(identidad);

    if (carrito) {
      await this.prisma.carritoItem.deleteMany({
        where: { carrito_id: carrito.id },
      });
    }

    return CoreResponse.deleted('Carrito vaciado');
  }

  // ===================================================================================
  // Al iniciar sesión, el carrito del dispositivo pasa al cliente.
  //
  // Si el cliente ya tenía uno (entró desde otro navegador), se fusionan
  // sumando cantidades en lugar de descartar uno de los dos.
  async adoptarDeDispositivo(clienteId: number, dispositivo: string) {
    if (!DISPOSITIVO_REGEX.test(dispositivo)) {
      throw new BadRequestException('Identificador de dispositivo inválido');
    }

    const [delDispositivo, delCliente] = await Promise.all([
      this.prisma.carrito.findFirst({
        where: { dispositivo },
        include: { items: true },
      }),
      this.prisma.carrito.findFirst({
        where: { cliente_id: clienteId },
        include: { items: true },
      }),
    ]);

    if (!delDispositivo) {
      return CoreResponse.success('No había carrito que adoptar', {
        adoptados: 0,
        fusionados: 0,
      });
    }

    // Sin carrito previo del cliente: basta reasignar el dueño.
    if (!delCliente) {
      await this.prisma.carrito.update({
        where: { id: delDispositivo.id },
        data: { cliente_id: clienteId, dispositivo: null },
      });

      return CoreResponse.success('Carrito sincronizado', {
        adoptados: delDispositivo.items.length,
        fusionados: 0,
      });
    }

    const previos = new Map(delCliente.items.map((i) => [i.variante_id, i]));

    let adoptados = 0;
    let fusionados = 0;

    const operaciones: Prisma.PrismaPromise<unknown>[] = [];

    for (const item of delDispositivo.items) {
      const previo = previos.get(item.variante_id);

      if (previo) {
        operaciones.push(
          this.prisma.carritoItem.update({
            where: { id: previo.id },
            data: {
              cantidad: Math.min(
                previo.cantidad + item.cantidad,
                CANTIDAD_MAXIMA,
              ),
            },
          }),
        );
        fusionados++;
      } else {
        operaciones.push(
          this.prisma.carritoItem.update({
            where: { id: item.id },
            data: { carrito_id: delCliente.id },
          }),
        );
        adoptados++;
      }
    }

    // El carrito del dispositivo se borra al final: sus líneas ya se
    // movieron o se sumaron, y dejarlo permitiría adoptarlo dos veces.
    operaciones.push(
      this.prisma.carrito.delete({ where: { id: delDispositivo.id } }),
    );

    await this.prisma.$transaction(operaciones);

    return CoreResponse.success('Carrito sincronizado', {
      adoptados,
      fusionados,
    });
  }

  // ===================================================================================
  // Vista de administración: carritos con contenido, del más reciente al más
  // antiguo. Sirve para ver qué se quedó sin cerrar por WhatsApp.
  //
  // `updatedAt` está indexado justamente para esto. No expone el id de
  // dispositivo completo: identifica al visitante entre sesiones y no hace
  // falta para decidir a quién seguir.
  async listarAdmin(opciones: { pagina?: number; limite?: number } = {}) {
    const limite = Math.min(Math.max(opciones.limite ?? 20, 1), 100);
    const pagina = Math.max(opciones.pagina ?? 1, 1);

    const where: Prisma.CarritoWhereInput = { items: { some: {} } };

    const [total, carritos] = await this.prisma.$transaction([
      this.prisma.carrito.count({ where }),
      this.prisma.carrito.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limite,
        skip: (pagina - 1) * limite,
        include: {
          ...CARRITO_INCLUDE,
          cliente: { select: { id: true, nombre: true, email: true } },
        },
      }),
    ]);

    const ahora = new Date();

    const filas = await Promise.all(
      carritos.map(async (carrito) => {
        const datos = await this.mapear(carrito);

        return {
          id: carrito.id,
          // Un carrito es de un cliente identificado o de un visitante anónimo.
          cliente: carrito.cliente,
          anonimo: carrito.cliente === null,
          items: datos.items,
          cantidad: datos.cantidad,
          total: datos.total,
          moneda: datos.moneda,
          simbolo: datos.simbolo,
          // Días sin tocarlo: el criterio práctico de "abandonado".
          diasInactivo: Math.floor(
            (ahora.getTime() - carrito.updatedAt.getTime()) / 86_400_000,
          ),
          createdAt: carrito.createdAt,
          updatedAt: carrito.updatedAt,
        };
      }),
    );

    return CoreResponse.paginated(
      'Carritos obtenidos correctamente',
      filas,
      total,
      pagina,
      limite,
    );
  }

  // ===================================================================================
  // El pedido completo como enlace de WhatsApp, con el texto ya armado.
  async generarEnlace(identidad: Identidad) {
    const carrito = await this.buscar(identidad);
    const datos = await this.mapear(carrito);

    const pedibles = datos.items.filter((i) => i.disponible);

    if (pedibles.length === 0) {
      throw new BadRequestException(
        'El carrito está vacío o sus productos ya no están disponibles',
      );
    }

    const ajustes = await this.config.getVarias([
      CONFIG_CLAVES.WHATSAPP_NUMERO,
      CONFIG_CLAVES.WHATSAPP_CARRITO_PLANTILLA,
      CONFIG_CLAVES.WHATSAPP_CARRITO_LINEA,
      CONFIG_CLAVES.TIENDA_URL,
    ]);

    const numero = normalizarNumeroWhatsapp(
      ajustes[CONFIG_CLAVES.WHATSAPP_NUMERO],
    );

    if (!numero) {
      throw new BadRequestException(
        'La tienda no tiene número de WhatsApp configurado',
      );
    }

    const simbolo = datos.simbolo;
    const dinero = (v: number) => `${simbolo} ${v.toFixed(2)}`;

    const urlTienda = ajustes[CONFIG_CLAVES.TIENDA_URL].replace(/\/+$/, '');

    const lineas = pedibles
      .map((item, indice) =>
        rellenarPlantilla(ajustes[CONFIG_CLAVES.WHATSAPP_CARRITO_LINEA], {
          n: String(indice + 1),
          producto: item.producto.nombre,
          talla: item.talla.etiqueta,
          color: item.color.nombre,
          cantidad: String(item.cantidad),
          precio: dinero(item.precio.precio),
          subtotal: dinero(item.subtotal),
          url: `${urlTienda}/producto/${item.producto.slug}`,
        }),
      )
      .join('');

    const mensaje = rellenarPlantilla(
      ajustes[CONFIG_CLAVES.WHATSAPP_CARRITO_PLANTILLA],
      {
        items: lineas,
        total: dinero(datos.total),
        cantidad: String(datos.cantidad),
        url: urlTienda,
      },
    );

    return CoreResponse.success('Enlace de WhatsApp generado', {
      url: construirUrlWhatsapp(numero, mensaje),
      mensaje,
      numero,
      total: datos.total,
      cantidad: datos.cantidad,
      moneda: datos.moneda,
      // Las líneas que quedaron fuera por no estar disponibles, para que el
      // front pueda avisar en lugar de que el cliente lo note en el chat.
      omitidos: datos.items
        .filter((i) => !i.disponible)
        .map((i) => ({
          variante_id: i.variante_id,
          producto: i.producto.nombre,
        })),
    });
  }
}
