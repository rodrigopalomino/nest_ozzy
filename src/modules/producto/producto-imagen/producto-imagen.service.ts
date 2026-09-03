// src/producto/producto-imagen.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { MinioService } from 'src/modules/minio/minio.service';
import { CreateImagenProductoType } from '../schema/createImagenProducto.schema';
import { ImagenProcesadorService } from 'src/modules/minio/imagen-procesador.service';
import { CoreResponse } from 'src/common/utils/response.util';

// Si te da error con crypto.randomUUID():
// import * as crypto from 'crypto';

@Injectable()
export class ProductoImagenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly procesador: ImagenProcesadorService,
  ) {}

  async presignUpload(
    productoId: number,
    params: { filename: string; contentType?: string },
  ) {
    const producto = await this.prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    // Valida extensión y tipo: sin esto se podía pedir presign para
    // cualquier archivo y escribir lo que fuera en el bucket.
    const { extension } = this.minio.validarImagen({
      filename: String(params.filename ?? ''),
      contentType: params.contentType,
    });

    const uuid = crypto.randomUUID();
    const objectKey = `productos/${productoId}/${uuid}.${extension}`;

    const { uploadUrl } = await this.minio.presignPutObject({ objectKey });

    return CoreResponse.success('URL de subida generada correctamente', {
      uploadUrl,
      objectKey,
      url: this.minio.buildPublicUrl(objectKey),
    });
  }

  async createImagen(productoId: number, dto: CreateImagenProductoType) {
    // 1) valida producto
    const producto = await this.prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true },
    });
    if (!producto) throw new NotFoundException('Producto no encontrado');

    // 2) calcula orden dentro de la galería de ese color
    const total = await this.prisma.imagenProducto.count({
      where: { producto_id: productoId, color_id: dto.color_id ?? null },
    });

    const orden =
      dto.orden === undefined || dto.orden === null ? total : Number(dto.orden);

    if (!Number.isFinite(orden) || orden < 0) {
      throw new BadRequestException('Orden inválido');
    }

    const esPrincipal = Boolean(dto.esPrincipal);
    const esHover = Boolean(dto.esHover);

    // El color debe existir; null = imagen genérica del producto.
    const colorId = dto.color_id ?? null;

    if (colorId !== null) {
      const color = await this.prisma.color.findUnique({
        where: { id: colorId },
        select: { id: true },
      });

      if (!color) throw new BadRequestException('El color no existe');
    }

    // 3) reglas: una imagen no debería ser principal y hover a la vez
    if (esPrincipal && esHover) {
      throw new BadRequestException(
        'La imagen no puede ser principal y hover a la vez',
      );
    }

    // 4) transacción: si setea principal/hover, desmarca el resto
    const imagen = await this.prisma.$transaction(async (tx) => {
      // Principal y hover son únicos por (producto, color): cada color
      // tiene su propia portada.
      if (esPrincipal) {
        await tx.imagenProducto.updateMany({
          where: { producto_id: productoId, color_id: colorId },
          data: { esPrincipal: false },
        });
      }

      if (esHover) {
        await tx.imagenProducto.updateMany({
          where: { producto_id: productoId, color_id: colorId },
          data: { esHover: false },
        });
      }

      const created = await tx.imagenProducto.create({
        data: {
          producto_id: productoId,
          color_id: colorId,
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
          color_id: true,
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

    return CoreResponse.created('Imagen creada correctamente', imagen);
  }

  // ===================================================================================
  // Subida directa: el front manda el archivo, aquí se generan las
  // miniaturas WebP y el placeholder, y se guarda todo en un solo paso.
  //
  // Es el camino recomendado. El presign se mantiene para compatibilidad,
  // pero sirve el original sin optimizar.
  async subirImagen(
    productoId: number,
    archivo: { buffer: Buffer; originalname: string; mimetype: string },
    opciones: {
      alt?: string | null;
      color_id?: number | null;
      esPrincipal?: boolean;
      esHover?: boolean;
    } = {},
  ) {
    const producto = await this.prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true },
    });

    if (!producto) throw new NotFoundException('Producto no encontrado');

    // Valida extensión y tipo declarado antes de gastar CPU procesando.
    this.minio.validarImagen({
      filename: archivo.originalname,
      contentType: archivo.mimetype,
      size: archivo.buffer.length,
    });

    const colorId = opciones.color_id ?? null;

    if (colorId !== null) {
      const color = await this.prisma.color.findUnique({
        where: { id: colorId },
        select: { id: true },
      });

      if (!color) throw new BadRequestException('El color no existe');
    }

    const esPrincipal = Boolean(opciones.esPrincipal);
    const esHover = Boolean(opciones.esHover);

    if (esPrincipal && esHover) {
      throw new BadRequestException(
        'La imagen no puede ser principal y hover a la vez',
      );
    }

    const procesada = await this.procesador.procesarYSubir({
      buffer: archivo.buffer,
      prefijo: `productos/${productoId}`,
    });

    const total = await this.prisma.imagenProducto.count({
      where: { producto_id: productoId, color_id: colorId },
    });

    const imagen = await this.prisma.$transaction(async (tx) => {
      if (esPrincipal) {
        await tx.imagenProducto.updateMany({
          where: { producto_id: productoId, color_id: colorId },
          data: { esPrincipal: false },
        });
      }

      if (esHover) {
        await tx.imagenProducto.updateMany({
          where: { producto_id: productoId, color_id: colorId },
          data: { esHover: false },
        });
      }

      return tx.imagenProducto.create({
        data: {
          producto_id: productoId,
          color_id: colorId,
          url: procesada.url,
          urlSm: procesada.urlSm,
          urlMd: procesada.urlMd,
          urlLg: procesada.urlLg,
          ancho: procesada.ancho,
          alto: procesada.alto,
          blurData: procesada.blurData,
          alt: opciones.alt ?? null,
          orden: total,
          // La primera imagen de una galería es su portada por defecto.
          esPrincipal: esPrincipal || total === 0,
          esHover,
        },
      });
    });

    return CoreResponse.created('Imagen subida correctamente', imagen);
  }

  // ===================================================================================
  // Reordena la galería: el front manda los ids en el orden deseado y aquí
  // se reasigna `orden` de forma consecutiva desde 0.
  async reordenarImagenes(productoId: number, imagenIds: number[]) {
    const imagenes = await this.prisma.imagenProducto.findMany({
      where: { id: { in: imagenIds }, producto_id: productoId },
      select: { id: true },
    });

    // Todos los ids deben pertenecer a este producto.
    if (imagenes.length !== imagenIds.length) {
      const validos = new Set(imagenes.map((i) => i.id));
      const invalidos = imagenIds.filter((id) => !validos.has(id));

      throw new BadRequestException({
        message: 'Algunas imágenes no pertenecen a este producto.',
        invalidos,
      });
    }

    await this.prisma.$transaction(
      imagenIds.map((id, index) =>
        this.prisma.imagenProducto.update({
          where: { id },
          data: { orden: index },
        }),
      ),
    );

    const data = await this.prisma.imagenProducto.findMany({
      where: { producto_id: productoId },
      orderBy: [{ orden: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        url: true,
        alt: true,
        orden: true,
        esPrincipal: true,
        esHover: true,
        color_id: true,
      },
    });

    return CoreResponse.updated('Orden actualizado correctamente', data);
  }

  // ===================================================================================
  // Marca una imagen como principal o como hover. El flag es único dentro
  // de la galería de su color, así que se desmarca el resto.
  async marcarImagen(
    productoId: number,
    imagenId: number,
    campo: 'esPrincipal' | 'esHover',
  ) {
    const img = await this.prisma.imagenProducto.findFirst({
      where: { id: imagenId, producto_id: productoId },
      select: { id: true, color_id: true },
    });

    if (!img) throw new NotFoundException('Imagen no encontrada');

    const contrario = campo === 'esPrincipal' ? 'esHover' : 'esPrincipal';

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.imagenProducto.updateMany({
        where: { producto_id: productoId, color_id: img.color_id },
        data: { [campo]: false },
      });

      // Una imagen no puede ser principal y hover a la vez.
      return tx.imagenProducto.update({
        where: { id: imagenId },
        data: { [campo]: true, [contrario]: false },
        select: {
          id: true,
          url: true,
          alt: true,
          orden: true,
          esPrincipal: true,
          esHover: true,
          color_id: true,
        },
      });
    });

    return CoreResponse.updated('Imagen actualizada correctamente', updated);
  }

  // ===================================================================================
  // Reasigna la imagen a otro color (o la vuelve genérica con null).
  async asignarColor(
    productoId: number,
    imagenId: number,
    colorId: number | null,
  ) {
    const img = await this.prisma.imagenProducto.findFirst({
      where: { id: imagenId, producto_id: productoId },
      select: { id: true },
    });

    if (!img) throw new NotFoundException('Imagen no encontrada');

    if (colorId !== null) {
      const color = await this.prisma.color.findUnique({
        where: { id: colorId },
        select: { id: true },
      });

      if (!color) throw new BadRequestException('El color no existe');
    }

    // Al cambiar de galería pierde los flags: pertenecen al color anterior.
    const updated = await this.prisma.imagenProducto.update({
      where: { id: imagenId },
      data: { color_id: colorId, esPrincipal: false, esHover: false },
      select: {
        id: true,
        url: true,
        alt: true,
        orden: true,
        esPrincipal: true,
        esHover: true,
        color_id: true,
      },
    });

    return CoreResponse.updated('Color de la imagen actualizado', updated);
  }

  async deleteImagen(productoId: number, imagenId: number) {
    // 1) valida pertenencia
    const img = await this.prisma.imagenProducto.findFirst({
      where: { id: imagenId, producto_id: productoId },
      select: {
        id: true,
        url: true,
        esPrincipal: true,
        esHover: true,
        color_id: true,
      },
    });
    if (!img) throw new NotFoundException('Imagen no encontrada');

    // 2) borra DB y reasigna si hacía falta
    await this.prisma.$transaction(async (tx) => {
      await tx.imagenProducto.delete({ where: { id: imagenId } });

      // si borraste principal => reasigna a la primera por orden
      if (img.esPrincipal) {
        const first = await tx.imagenProducto.findFirst({
          where: { producto_id: productoId, color_id: img.color_id },
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
          where: {
            producto_id: productoId,
            color_id: img.color_id,
            esPrincipal: true,
          },
          select: { id: true },
        });

        const hoverCandidate = await tx.imagenProducto.findFirst({
          where: {
            producto_id: productoId,
            color_id: img.color_id,
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

    return CoreResponse.deleted('Imagen eliminada correctamente');
  }
}
