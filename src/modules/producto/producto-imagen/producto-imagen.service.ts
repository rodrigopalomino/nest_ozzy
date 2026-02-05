// src/producto/producto-imagen.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateImagenProductoDto } from 'src/modules/minio/dto/create-imagen-producto.dto';
import { MinioService } from 'src/modules/minio/minio.service';
import { PrismaService } from 'src/prisma/prisma.service';

function getExt(filename: string) {
  const clean = filename.split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';
}

function safeKeyPart(v: string) {
  return v.replace(/[^a-zA-Z0-9_-]/g, '-');
}

@Injectable()
export class ProductoImagenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  async presignUpload(productoId: number, params: { filename: string }) {
    const exists = await this.prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Producto no encontrado');

    const ext = getExt(params.filename);
    const uuid = crypto.randomUUID();

    const objectKey = `productos/${safeKeyPart(productoId)}/${uuid}${
      ext ? `.${ext}` : ''
    }`;

    const { uploadUrl } = await this.minio.presignPutObject({ objectKey });

    return {
      uploadUrl,
      objectKey,
      url: this.minio.buildPublicUrl(objectKey),
    };
  }

  async createImagen(productoId: string, dto: CreateImagenProductoDto) {
    const producto = await this.prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    // Orden por defecto = al final
    const count = await this.prisma.imagenProducto.count({
      where: { productoId },
    });

    const orden = Number.isFinite(dto.orden as any) ? Number(dto.orden) : count;

    // Si viene tipo=principal => dejar solo 1 principal
    if (dto.tipo === 'principal') {
      await this.prisma.imagenProducto.updateMany({
        where: { productoId },
        data: { tipo: 'galeria' },
      });
    }

    return this.prisma.imagenProducto.create({
      data: {
        productoId,
        url: dto.url,
        alt: dto.alt ?? null,
        orden,
        tipo: dto.tipo ?? 'galeria',
      },
      select: {
        id: true,
        url: true,
        alt: true,
        orden: true,
        tipo: true,
        createdAt: true,
      },
    });
  }

  async deleteImagen(productoId: string, imagenId: string) {
    const img = await this.prisma.imagenProducto.findFirst({
      where: { id: imagenId, productoId },
      select: { id: true, url: true, tipo: true },
    });
    if (!img) throw new NotFoundException('Imagen no encontrada');

    await this.prisma.imagenProducto.delete({ where: { id: imagenId } });

    // borrar en MinIO si la URL es del bucket (public url)
    const bucket = this.minio.getBucket();
    const needle = `/${bucket}/`;
    const idx = img.url.indexOf(needle);
    if (idx >= 0) {
      const objectKey = img.url.slice(idx + needle.length).replace(/^\/+/, '');
      await this.minio.removeObject(objectKey);
    }

    // si borraste principal, reasigna
    if (img.tipo === 'principal') {
      const first = await this.prisma.imagenProducto.findFirst({
        where: { productoId },
        orderBy: { orden: 'asc' },
        select: { id: true },
      });
      if (first) {
        await this.prisma.imagenProducto.update({
          where: { id: first.id },
          data: { tipo: 'principal' },
        });
      }
    }

    return { ok: true };
  }
}
