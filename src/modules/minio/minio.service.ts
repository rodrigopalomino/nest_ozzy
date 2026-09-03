// src/modules/minio/minio.service.ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Client } from 'minio';
import {
  EXTENSIONES_IMAGEN_PERMITIDAS,
  PRESIGN_EXPIRA_SEGUNDOS,
  TAMANO_MAXIMO_IMAGEN,
  TIPOS_IMAGEN_PERMITIDOS,
} from './minio.constants';

@Injectable()
export class MinioService {
  private readonly logger = new Logger(MinioService.name);
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  // El cliente se crea al primer uso, no al arrancar. Antes el constructor
  // lanzaba si faltaban las credenciales y la API no levantaba ni para
  // mostrar el catálogo, aunque leer imágenes ya subidas sólo necesita la
  // URL pública.
  private client: Client | null = null;

  constructor() {
    const useSSL =
      String(process.env.MINIO_USE_SSL ?? 'false').toLowerCase() === 'true';

    const endPoint = process.env.MINIO_ENDPOINT ?? 'localhost';
    const port = Number(process.env.MINIO_PORT ?? '9000');

    const publicUrl =
      process.env.MINIO_PUBLIC_URL ??
      `${useSSL ? 'https' : 'http'}://${endPoint}:${port}`;

    this.bucket = process.env.MINIO_BUCKET ?? '';
    this.publicBaseUrl = publicUrl.replace(/\/+$/, '');
  }

  // ===================================================================================
  // Subir, borrar y listar sí exigen credenciales: si faltan, la operación
  // falla con un mensaje claro en lugar de impedir el arranque.
  private getClient(): Client {
    if (this.client) return this.client;

    const accessKey = process.env.MINIO_ACCESS_KEY ?? '';
    const secretKey = process.env.MINIO_SECRET_KEY ?? '';

    if (!accessKey || !secretKey || !this.bucket) {
      throw new InternalServerErrorException(
        'Almacenamiento de imágenes no configurado: faltan MINIO_ACCESS_KEY / MINIO_SECRET_KEY / MINIO_BUCKET',
      );
    }

    this.client = new Client({
      endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
      port: Number(process.env.MINIO_PORT ?? '9000'),
      useSSL:
        String(process.env.MINIO_USE_SSL ?? 'false').toLowerCase() === 'true',
      accessKey,
      secretKey,
    });

    return this.client;
  }

  // ===================================================================================
  getBucket() {
    return this.bucket;
  }

  // ===================================================================================
  buildPublicUrl(objectKey: string) {
    const key = objectKey.replace(/^\/+/, '');
    return `${this.publicBaseUrl}/${this.bucket}/${key}`;
  }

  // ===================================================================================
  // Extrae la clave del objeto a partir de su URL pública.
  // Devuelve null si la URL no pertenece a este bucket.
  extraerObjectKey(url: string): string | null {
    const needle = `/${this.bucket}/`;
    const idx = url.indexOf(needle);

    if (idx < 0) return null;

    const key = url.slice(idx + needle.length).replace(/^\/+/, '');
    return key || null;
  }

  // ===================================================================================
  // Valida nombre y tipo antes de permitir cualquier subida.
  validarImagen(params: {
    filename: string;
    contentType?: string;
    size?: number;
  }): { extension: string } {
    const { filename, contentType, size } = params;

    // Se descarta la ruta y la query: sólo interesa el nombre real.
    const limpio = filename.split('?')[0].split('#')[0].split('/').pop() ?? '';

    if (!limpio || limpio.length > 200) {
      throw new BadRequestException('Nombre de archivo inválido');
    }

    const punto = limpio.lastIndexOf('.');
    const extension = punto >= 0 ? limpio.slice(punto + 1).toLowerCase() : '';

    if (!EXTENSIONES_IMAGEN_PERMITIDAS.includes(extension)) {
      throw new BadRequestException({
        message: 'Extensión de archivo no permitida.',
        recibida: extension || null,
        permitidas: EXTENSIONES_IMAGEN_PERMITIDAS,
      });
    }

    if (contentType && !(contentType in TIPOS_IMAGEN_PERMITIDOS)) {
      throw new BadRequestException({
        message: 'Tipo de contenido no permitido.',
        recibido: contentType,
        permitidos: Object.keys(TIPOS_IMAGEN_PERMITIDOS),
      });
    }

    if (size !== undefined && size > TAMANO_MAXIMO_IMAGEN) {
      throw new BadRequestException({
        message: 'La imagen supera el tamaño máximo permitido.',
        tamanoMaximoMB: Math.round(TAMANO_MAXIMO_IMAGEN / (1024 * 1024)),
      });
    }

    return { extension };
  }

  // ===================================================================================
  async presignPutObject(params: {
    objectKey: string;
    expiresInSeconds?: number;
  }) {
    const expires = params.expiresInSeconds ?? PRESIGN_EXPIRA_SEGUNDOS;

    try {
      const url = await this.getClient().presignedPutObject(
        this.bucket,
        params.objectKey,
        expires,
      );

      return { uploadUrl: url, expiraEnSegundos: expires };
    } catch (e) {
      this.logger.error('No se pudo generar el presign PUT', e as Error);
      throw new InternalServerErrorException('No se pudo generar presign PUT');
    }
  }

  // ===================================================================================
  // Sube un buffer ya procesado (miniaturas, WebP).
  async putObject(params: {
    objectKey: string;
    buffer: Buffer;
    contentType: string;
    cacheSegundos?: number;
  }) {
    const {
      objectKey,
      buffer,
      contentType,
      cacheSegundos = 31_536_000,
    } = params;

    try {
      await this.getClient().putObject(
        this.bucket,
        objectKey,
        buffer,
        buffer.length,
        {
          'Content-Type': contentType,
          // Las claves incluyen un uuid, así que el contenido es inmutable.
          'Cache-Control': `public, max-age=${cacheSegundos}, immutable`,
        },
      );

      return { objectKey, url: this.buildPublicUrl(objectKey) };
    } catch (e) {
      this.logger.error(`No se pudo subir ${objectKey}`, e as Error);
      throw new InternalServerErrorException('No se pudo subir el archivo');
    }
  }

  // ===================================================================================
  async removeObject(objectKey: string) {
    try {
      await this.getClient().removeObject(this.bucket, objectKey);
      return true;
    } catch (e) {
      // Si el objeto no existe no se rompe el flujo de la aplicación.
      this.logger.warn(
        `No se pudo borrar ${objectKey}: ${(e as Error).message}`,
      );
      return false;
    }
  }

  // ===================================================================================
  async removeObjects(objectKeys: string[]) {
    if (objectKeys.length === 0) return 0;

    try {
      await this.getClient().removeObjects(this.bucket, objectKeys);
      return objectKeys.length;
    } catch (e) {
      this.logger.warn(`Borrado en lote falló: ${(e as Error).message}`);

      // Se reintenta uno a uno para no perder los que sí se pueden borrar.
      let borrados = 0;
      for (const key of objectKeys) {
        if (await this.removeObject(key)) borrados++;
      }
      return borrados;
    }
  }

  // ===================================================================================
  // Lista las claves del bucket bajo un prefijo. Lo usa el job que detecta
  // imágenes huérfanas (subidas que nunca se guardaron en la base de datos).
  listarObjetos(
    prefijo = '',
  ): Promise<{ objectKey: string; size: number; modificado: Date }[]> {
    return new Promise((resolve, reject) => {
      const objetos: { objectKey: string; size: number; modificado: Date }[] =
        [];

      const stream = this.getClient().listObjectsV2(this.bucket, prefijo, true);

      stream.on('data', (obj) => {
        if (obj.name) {
          objetos.push({
            objectKey: obj.name,
            size: obj.size ?? 0,
            modificado: obj.lastModified ?? new Date(0),
          });
        }
      });

      stream.on('error', (e) => {
        this.logger.error('Error al listar objetos', e);
        reject(e instanceof Error ? e : new Error(String(e)));
      });

      stream.on('end', () => resolve(objetos));
    });
  }
}
