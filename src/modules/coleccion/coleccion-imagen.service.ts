// src/coleccion/coleccion-imagen.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MinioService } from 'src/modules/minio/minio.service';
import crypto from 'crypto';

@Injectable()
export class ColeccionImagenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  async presignUpload(coleccionId: number, params: { filename: string }) {
    const coleccion = await this.prisma.coleccion.findUnique({
      where: { id: coleccionId },
      select: { id: true },
    });
    if (!coleccion) throw new NotFoundException('Colección no encontrada');

    const filename = String(params.filename ?? '');
    const clean = filename.split('?')[0].split('#')[0];
    const dot = clean.lastIndexOf('.');
    const ext = dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';

    const uuid = crypto.randomUUID();
    const objectKey = `colecciones/${coleccionId}/${uuid}${ext ? `.${ext}` : ''}`;

    const { uploadUrl } = await this.minio.presignPutObject({ objectKey });

    return {
      uploadUrl,
      objectKey,
      url: this.minio.buildPublicUrl(objectKey),
    };
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

    return updated;
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

    return { ok: true };
  }

  private async tryRemoveFromMinio(url: string) {
    try {
      const bucket = this.minio.getBucket();
      const needle = `/${bucket}/`;
      const idx = url.indexOf(needle);
      if (idx < 0) return;

      const objectKey = url.slice(idx + needle.length).replace(/^\/+/, '');
      if (!objectKey) return;

      await this.minio.removeObject(objectKey);
    } catch {
      // silencioso: no queremos romper la operación principal por limpieza
    }
  }
}
