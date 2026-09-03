//* src/modules/minio/imagen-procesador.service.ts

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import type { Metadata } from 'sharp';
import { MinioService } from './minio.service';
import { TAMANO_MAXIMO_IMAGEN, VARIANTES_IMAGEN } from './minio.constants';

// ===================================================================================
// Procesa las imágenes al subirlas: genera WebP en tres tamaños y un
// placeholder diminuto.
//
// Sin esto el catálogo sirve el JPG original del móvil (3-8 MB) en las
// tarjetas, que es el mayor problema de velocidad de una tienda con fotos.
// ===================================================================================

export interface ImagenProcesada {
  // Original re-codificado a WebP.
  url: string;
  urlSm: string;
  urlMd: string;
  urlLg: string;
  ancho: number;
  alto: number;
  // data URI base64 de ~20-30 bytes para el blurDataURL de next/image.
  blurData: string;
}

// Calidad que mantiene la foto limpia sin inflar el peso.
const CALIDAD_WEBP = 82;
const CALIDAD_WEBP_GRANDE = 86;

@Injectable()
export class ImagenProcesadorService {
  private readonly logger = new Logger(ImagenProcesadorService.name);

  constructor(private readonly minio: MinioService) {}

  // ===================================================================================
  async procesarYSubir(params: {
    buffer: Buffer;
    prefijo: string;
  }): Promise<ImagenProcesada> {
    const { buffer, prefijo } = params;

    if (buffer.length > TAMANO_MAXIMO_IMAGEN) {
      throw new BadRequestException({
        message: 'La imagen supera el tamaño máximo permitido.',
        tamanoMaximoMB: Math.round(TAMANO_MAXIMO_IMAGEN / (1024 * 1024)),
      });
    }

    // ===================================================================================
    // sharp valida el contenido real: un .jpg que en realidad es un
    // ejecutable falla aquí, no sólo en la extensión.
    let metadatos: Metadata;

    try {
      metadatos = await sharp(buffer).metadata();
    } catch {
      throw new BadRequestException(
        'El archivo no es una imagen válida o está corrupto.',
      );
    }

    const anchoOriginal = metadatos.width;
    const altoOriginal = metadatos.height;

    if (!anchoOriginal || !altoOriginal) {
      throw new BadRequestException('No se pudieron leer las dimensiones.');
    }

    const uuid = randomUUID();
    const base = `${prefijo.replace(/\/+$/, '')}/${uuid}`;

    // ===================================================================================
    // `rotate()` sin argumentos aplica la orientación EXIF: las fotos de
    // móvil salen derechas en lugar de giradas.
    const normalizada = sharp(buffer).rotate();

    const principal = await normalizada
      .clone()
      .webp({ quality: CALIDAD_WEBP_GRANDE })
      .toBuffer({ resolveWithObject: true });

    const subidas = await Promise.all([
      this.minio.putObject({
        objectKey: `${base}.webp`,
        buffer: principal.data,
        contentType: 'image/webp',
      }),
      ...VARIANTES_IMAGEN.map(async (variante) => {
        const redimensionada = await normalizada
          .clone()
          // `withoutEnlargement` evita agrandar una foto pequeña, que sólo
          // añadiría peso sin ganar calidad.
          .resize({ width: variante.ancho, withoutEnlargement: true })
          .webp({ quality: CALIDAD_WEBP })
          .toBuffer();

        return this.minio.putObject({
          objectKey: `${base}-${variante.nombre}.webp`,
          buffer: redimensionada,
          contentType: 'image/webp',
        });
      }),
    ]);

    // ===================================================================================
    // Placeholder: 16 px de ancho, suficiente para un degradado difuso.
    const blur = await normalizada
      .clone()
      .resize({ width: 16 })
      .webp({ quality: 30 })
      .toBuffer();

    const blurData = `data:image/webp;base64,${blur.toString('base64')}`;

    const [original, sm, md, lg] = subidas;

    this.logger.log(
      `Imagen procesada ${base}: ${anchoOriginal}x${altoOriginal}, ` +
        `${Math.round(buffer.length / 1024)} KB -> ${Math.round(principal.data.length / 1024)} KB`,
    );

    return {
      url: original.url,
      urlSm: sm.url,
      urlMd: md.url,
      urlLg: lg.url,
      ancho: principal.info.width,
      alto: principal.info.height,
      blurData,
    };
  }

  // ===================================================================================
  // Procesa una imagen que ya está en el bucket (subida por presign).
  // La usa el job que optimiza lo que entró antes de existir este flujo.
  async procesarExistente(params: {
    urlOriginal: string;
    prefijo: string;
  }): Promise<ImagenProcesada | null> {
    const objectKey = this.minio.extraerObjectKey(params.urlOriginal);

    if (!objectKey) {
      this.logger.warn(
        `La URL no pertenece al bucket, se omite: ${params.urlOriginal}`,
      );
      return null;
    }

    try {
      const respuesta = await fetch(params.urlOriginal);

      if (!respuesta.ok) {
        this.logger.warn(
          `No se pudo descargar ${params.urlOriginal} (${respuesta.status})`,
        );
        return null;
      }

      const buffer = Buffer.from(await respuesta.arrayBuffer());

      return await this.procesarYSubir({ buffer, prefijo: params.prefijo });
    } catch (e) {
      this.logger.warn(
        `Fallo al procesar ${params.urlOriginal}: ${(e as Error).message}`,
      );
      return null;
    }
  }
}
