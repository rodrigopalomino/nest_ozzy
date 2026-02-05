// src/media/minio.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Client } from 'minio';

@Injectable()
export class MinioService {
  private readonly client: Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor() {
    const endPoint = process.env.MINIO_ENDPOINT ?? 'localhost';
    const port = Number(process.env.MINIO_PORT ?? '9000');
    const useSSL =
      String(process.env.MINIO_USE_SSL ?? 'false').toLowerCase() === 'true';

    const accessKey = process.env.MINIO_ACCESS_KEY ?? '';
    const secretKey = process.env.MINIO_SECRET_KEY ?? '';
    const bucket = process.env.MINIO_BUCKET ?? '';

    const publicUrl =
      process.env.MINIO_PUBLIC_URL ??
      `${useSSL ? 'https' : 'http'}://${endPoint}:${port}`;

    if (!accessKey || !secretKey || !bucket) {
      throw new Error(
        'Faltan variables MINIO_ACCESS_KEY / MINIO_SECRET_KEY / MINIO_BUCKET',
      );
    }

    this.client = new Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });

    this.bucket = bucket;
    this.publicBaseUrl = publicUrl.replace(/\/+$/, '');
  }

  getBucket() {
    return this.bucket;
  }

  buildPublicUrl(objectKey: string) {
    const key = objectKey.replace(/^\/+/, '');
    return `${this.publicBaseUrl}/${this.bucket}/${key}`;
  }

  async presignPutObject(params: {
    objectKey: string;
    expiresInSeconds?: number;
    contentType?: string;
  }) {
    const expires = params.expiresInSeconds ?? 60 * 5;

    try {
      const url = await this.client.presignedPutObject(
        this.bucket,
        params.objectKey,
        expires,
      );

      return { uploadUrl: url };
    } catch (e) {
      console.log('e => ', e);

      throw new InternalServerErrorException('No se pudo generar presign PUT');
    }
  }

  async removeObject(objectKey: string) {
    try {
      await this.client.removeObject(this.bucket, objectKey);
    } catch (e) {
      console.log('e => ', e);
      // si no existe, no rompas el flujo de la app
    }
  }
}
