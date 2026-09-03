//* src/modules/mantenimiento/mantenimiento.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { MinioService } from '../minio/minio.service';
import { CoreResponse } from 'src/common/utils/response.util';

// ===================================================================================
// Tareas de limpieza.
//
// Sin esto, cada presign que el front pide y no llega a guardar en la base
// deja un objeto pagando espacio en MinIO para siempre.
// ===================================================================================

// Sólo se consideran huérfanos los objetos con cierta antigüedad: uno recién
// subido puede estar a medio camino de guardarse en la base de datos.
const HORAS_GRACIA = 24;

@Injectable()
export class MantenimientoService {
  private readonly logger = new Logger(MantenimientoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  // ===================================================================================
  // Todas las URLs de imagen referenciadas desde la base de datos.
  private async clavesEnUso(): Promise<Set<string>> {
    const [imagenes, colecciones, productos] = await Promise.all([
      this.prisma.imagenProducto.findMany({
        select: { url: true, urlSm: true, urlMd: true, urlLg: true },
      }),
      this.prisma.coleccion.findMany({
        where: { imagenPortada: { not: null } },
        select: { imagenPortada: true },
      }),
      this.prisma.producto.findMany({
        where: { ogImagen: { not: null } },
        select: { ogImagen: true },
      }),
    ]);

    const urls: (string | null)[] = [
      ...imagenes.flatMap((i) => [i.url, i.urlSm, i.urlMd, i.urlLg]),
      ...colecciones.map((c) => c.imagenPortada),
      ...productos.map((p) => p.ogImagen),
    ];

    const claves = new Set<string>();

    for (const url of urls) {
      if (!url) continue;
      const clave = this.minio.extraerObjectKey(url);
      if (clave) claves.add(clave);
    }

    return claves;
  }

  // ===================================================================================
  // Analiza el bucket sin tocar nada. Se separa del borrado para poder
  // auditar primero y para que el cron reutilice el mismo cálculo.
  async analizarHuerfanas() {
    const [objetos, enUso] = await Promise.all([
      this.minio.listarObjetos(),
      this.clavesEnUso(),
    ]);

    const limite = new Date(Date.now() - HORAS_GRACIA * 60 * 60 * 1000);

    const huerfanas = objetos.filter(
      (o) => !enUso.has(o.objectKey) && o.modificado < limite,
    );

    const bytes = huerfanas.reduce((suma, o) => suma + o.size, 0);

    return {
      objetosEnBucket: objetos.length,
      referenciadas: enUso.size,
      huerfanas: huerfanas.length,
      espacioRecuperableMB: Math.round((bytes / (1024 * 1024)) * 100) / 100,
      claves: huerfanas.map((o) => o.objectKey),
    };
  }

  // ===================================================================================
  async limpiarHuerfanas(borrar = false) {
    const analisis = await this.analizarHuerfanas();

    if (!borrar) {
      return CoreResponse.success('Análisis de huérfanas completado', {
        ...analisis,
        claves: undefined,
        ejemplos: analisis.claves.slice(0, 20),
        borradas: 0,
      });
    }

    const borradas = await this.minio.removeObjects(analisis.claves);

    this.logger.log(
      `Limpieza de huérfanas: ${borradas} objetos, ` +
        `${analisis.espacioRecuperableMB} MB liberados`,
    );

    return CoreResponse.success(
      `Se eliminaron ${borradas} imágenes huérfanas`,
      { ...analisis, claves: undefined, borradas },
    );
  }

  // ===================================================================================
  // Sólo reporta: borrar en automático es arriesgado si algún flujo nuevo
  // guarda URLs en un sitio que este job todavía no consulta.
  @Cron(CronExpression.EVERY_WEEK)
  async reporteSemanalHuerfanas() {
    try {
      const analisis = await this.analizarHuerfanas();

      if (analisis.huerfanas > 0) {
        this.logger.warn(
          `Hay ${analisis.huerfanas} imágenes huérfanas ocupando ` +
            `${analisis.espacioRecuperableMB} MB. ` +
            'Ejecuta POST /admin/mantenimiento/huerfanas?borrar=true para liberarlas.',
        );
      }
    } catch (e) {
      this.logger.error('Falló el reporte de huérfanas', e as Error);
    }
  }

  // ===================================================================================
  // Purga los refresh token caducados o revocados hace más de 30 días.
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgarTokens() {
    const hace30dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const { count } = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiraEn: { lt: new Date() } },
          { revocadoEn: { lt: hace30dias } },
        ],
      },
    });

    if (count > 0) {
      this.logger.log(`Refresh tokens purgados: ${count}`);
    }
  }

  // ===================================================================================
  // Recalcula precioDesde de todos los productos. Es la red de seguridad si
  // alguna escritura se hizo por fuera del servicio que lo mantiene.
  async recalcularPreciosDesde() {
    const productos = await this.prisma.producto.findMany({
      where: { deletedAt: null },
      select: { id: true },
    });

    let actualizados = 0;

    for (const p of productos) {
      const cambio = await this.recalcularPrecioDesde(p.id);
      if (cambio) actualizados++;
    }

    return CoreResponse.updated('Precios recalculados', {
      revisados: productos.length,
      actualizados,
    });
  }

  // ===================================================================================
  // Deja en precioDesde el precio efectivo más bajo del producto, para que
  // ordenar y filtrar por precio se pueda hacer en SQL.
  async recalcularPrecioDesde(productoId: number): Promise<boolean> {
    const producto = await this.prisma.producto.findUnique({
      where: { id: productoId },
      select: {
        id: true,
        precioBase: true,
        precioDesde: true,
        precio: true,
        variantes: {
          where: { activo: true },
          select: { precio: true },
        },
      },
    });

    if (!producto) return false;

    // Se importa aquí para no crear dependencia circular entre módulos.
    const { calcularPrecioEfectivo } =
      await import('../producto/utils/precio.util');

    const precios = producto.variantes.map(
      (v) =>
        calcularPrecioEfectivo({
          precioBase: producto.precioBase,
          precio: producto.precio,
          precioVariante: v.precio,
        }).precio,
    );

    const minimo =
      precios.length > 0
        ? Math.min(...precios)
        : calcularPrecioEfectivo({
            precioBase: producto.precioBase,
            precio: producto.precio,
          }).precio;

    const actual =
      producto.precioDesde !== null ? Number(producto.precioDesde) : null;

    if (actual === minimo) return false;

    await this.prisma.producto.update({
      where: { id: productoId },
      data: { precioDesde: minimo },
    });

    return true;
  }
}
