// src/producto/producto-imagen.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MinioService } from 'src/modules/minio/minio.service';
import { CreateImagenProductoType } from '../schema/createImagenProducto.schema';

// Si te da error con crypto.randomUUID():
// import * as crypto from 'crypto';

@Injectable()
export class ProductoImagenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {}

  async presignUpload(productoId: number, params: { filename: string }) {
    const producto = await this.prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    const filename = String(params.filename ?? '');
    const clean = filename.split('?')[0].split('#')[0];
    const dot = clean.lastIndexOf('.');
    const ext = dot >= 0 ? clean.slice(dot + 1).toLowerCase() : '';

    const uuid = crypto.randomUUID();
    const objectKey = `productos/${productoId}/${uuid}${ext ? `.${ext}` : ''}`;

    const { uploadUrl } = await this.minio.presignPutObject({ objectKey });

    return {
      uploadUrl,
      objectKey,
      url: this.minio.buildPublicUrl(objectKey),
    };
  }

  async createImagen(productoId: number, dto: CreateImagenProductoType) {
    // 1) valida producto
    const producto = await this.prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    // 2) calcula orden
    const total = await this.prisma.imagenProducto.count({
      where: { producto_id: productoId },
    });

    const orden =
      dto.orden === undefined || dto.orden === null ? total : Number(dto.orden);

    if (!Number.isFinite(orden) || orden < 0) {
      throw new BadRequestException('Orden inválido');
    }

    const esPrincipal = Boolean(dto.esPrincipal); // si aún no lo tienes tipado en el dto
    const esHover = Boolean(dto.esHover);

    // 3) reglas: una imagen no debería ser principal y hover a la vez
    if (esPrincipal && esHover) {
      throw new BadRequestException(
        'La imagen no puede ser principal y hover a la vez',
      );
    }

    // 4) transacción: si setea principal/hover, desmarca el resto
    return this.prisma.$transaction(async (tx) => {
      if (esPrincipal) {
        await tx.imagenProducto.updateMany({
          where: { producto_id: productoId },
          data: { esPrincipal: false },
        });
      }

      if (esHover) {
        await tx.imagenProducto.updateMany({
          where: { producto_id: productoId },
          data: { esHover: false },
        });
      }

      const created = await tx.imagenProducto.create({
        data: {
          producto_id: productoId,
          url: dto.url,
          alt: dto.alt ?? null,
          orden,
          esPrincipal,
          esHover,
        },
        select: {
          id: true,
          url: true,
          alt: true,
          orden: true,
          esPrincipal: true,
          esHover: true,
          createdAt: true,
        },
      });

      // 5) si es la primera imagen del producto y no marcaron nada,
      //    la hacemos principal por defecto (buen UX)
      if (!esPrincipal && !esHover && total === 0) {
        await tx.imagenProducto.update({
          where: { id: created.id },
          data: { esPrincipal: true },
        });

        return {
          ...created,
          esPrincipal: true,
        };
      }

      return created;
    });
  }

  async deleteImagen(productoId: number, imagenId: number) {
    // 1) valida pertenencia
    const img = await this.prisma.imagenProducto.findFirst({
      where: { id: imagenId, producto_id: productoId },
      select: { id: true, url: true, esPrincipal: true, esHover: true },
    });
    if (!img) throw new NotFoundException('Imagen no encontrada');

    // 2) borra DB y reasigna si hacía falta
    await this.prisma.$transaction(async (tx) => {
      await tx.imagenProducto.delete({ where: { id: imagenId } });

      // si borraste principal => reasigna a la primera por orden
      if (img.esPrincipal) {
        const first = await tx.imagenProducto.findFirst({
          where: { producto_id: productoId },
          orderBy: { orden: 'asc' },
          select: { id: true },
        });

        if (first) {
          await tx.imagenProducto.update({
            where: { id: first.id },
            data: { esPrincipal: true },
          });
        }
      }

      // si borraste hover => reasigna a "la primera que no sea principal"
      if (img.esHover) {
        const currentPrincipal = await tx.imagenProducto.findFirst({
          where: { producto_id: productoId, esPrincipal: true },
          select: { id: true },
        });

        const hoverCandidate = await tx.imagenProducto.findFirst({
          where: {
            producto_id: productoId,
            ...(currentPrincipal?.id
              ? { id: { not: currentPrincipal.id } }
              : {}),
          },
          orderBy: { orden: 'asc' },
          select: { id: true },
        });

        if (hoverCandidate) {
          await tx.imagenProducto.update({
            where: { id: hoverCandidate.id },
            data: { esHover: true },
          });
        }
      }
    });

    // 3) borra en MinIO si la url pertenece a tu bucket público
    const bucket = this.minio.getBucket();
    const needle = `/${bucket}/`;
    const idx = img.url.indexOf(needle);

    if (idx >= 0) {
      const objectKey = img.url.slice(idx + needle.length).replace(/^\/+/, '');
      await this.minio.removeObject(objectKey);
    }

    return { ok: true };
  }
}
