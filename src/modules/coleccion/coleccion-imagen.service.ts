// src/coleccion/coleccion-imagen.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MinioService } from 'src/modules/minio/minio.service';
import crypto from 'crypto';
import { CoreResponse } from 'src/common/utils/response.util';

@Injectable()
export class ColeccionImagenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  async presignUpload(
    coleccionId: number,
    params: { filename: string; contentType?: string },
  ) {
    const coleccion = await this.prisma.coleccion.findUnique({
      where: { id: coleccionId },
      select: { id: true },
    });
    if (!coleccion) throw new NotFoundException('Colección no encontrada');

    const { extension } = this.minio.validarImagen({
      filename: String(params.filename ?? ''),
      contentType: params.contentType,
    });

    const uuid = crypto.randomUUID();
    const objectKey = `colecciones/${coleccionId}/${uuid}.${extension}`;

    const { uploadUrl } = await this.minio.presignPutObject({ objectKey });

    return CoreResponse.success('URL de subida generada correctamente', {
      uploadUrl,
      objectKey,
      url: this.minio.buildPublicUrl(objectKey),
    });
  }

  /**
   * Guarda la imagen de portada (url pública) en Coleccion.imagenPortada
   * Opcionalmente borra la anterior en MinIO si pertenecía a tu bucket.
   */
  async setImagenPortada(coleccionId: number, dto: { url: string }) {
    const coleccion = await this.prisma.coleccion.findUnique({
      where: { id: coleccionId },
      select: { id: true, imagenPortada: true },
    });
    if (!coleccion) throw new NotFoundException('Colección no encontrada');

    const nextUrl = String(dto.url ?? '').trim();
    if (!nextUrl) {
      // Si quieres permitir "quitar portada" cambia esto por update null.
      throw new NotFoundException('URL inválida');
    }

    // 1) actualiza DB
    const updated = await this.prisma.coleccion.update({
      where: { id: coleccionId },
      data: { imagenPortada: nextUrl },
      select: {
        id: true,
        nombre: true,
        slug: true,
        imagenPortada: true,
        updatedAt: true,
      },
    });

    // 2) intenta borrar la anterior en MinIO (si existía y era del bucket)
    //    (no bloquea el update si falla)
    const prevUrl = coleccion.imagenPortada;
    if (prevUrl && prevUrl !== nextUrl) {
      await this.tryRemoveFromMinio(prevUrl);
    }

    return CoreResponse.updated(
      'Imagen de portada actualizada correctamente',
      updated,
    );
  }

  /**
   * Quita la imagen de portada (pone null) y borra del bucket si aplica.
   */
  async removeImagenPortada(coleccionId: number) {
    const coleccion = await this.prisma.coleccion.findUnique({
      where: { id: coleccionId },
      select: { id: true, imagenPortada: true },
    });
    if (!coleccion) throw new NotFoundException('Colección no encontrada');

    await this.prisma.coleccion.update({
      where: { id: coleccionId },
      data: { imagenPortada: null },
    });

    if (coleccion.imagenPortada) {
      await this.tryRemoveFromMinio(coleccion.imagenPortada);
    }

    return CoreResponse.deleted('Imagen de portada eliminada correctamente');
  }

  private async tryRemoveFromMinio(url: string) {
    // La limpieza nunca debe romper la operación principal.
    const objectKey = this.minio.extraerObjectKey(url);
    if (!objectKey) return;

    await this.minio.removeObject(objectKey);
  }
}
