// src/common/utils/prisma-filter.util.ts
import { BadRequestException, HttpException } from '@nestjs/common';

export function handlePrismaFilterError(err: unknown): never {
  // Las excepciones que ya lanzamos a propósito (whitelist de filtros,
  // includes inválidos) deben propagarse tal cual: si se reemplazan por
  // un mensaje genérico, el cliente pierde la lista de campos permitidos.
  if (err instanceof HttpException) throw err;

  const raw =
    typeof err === 'object' && err !== null && 'message' in err
      ? (err as { message?: unknown }).message
      : undefined;

  const message = typeof raw === 'string' ? raw : '';

  const isPrismaFilterError =
    message.includes('Unknown argument') || message.includes('Argument');

  if (isPrismaFilterError) {
    const match = message.match(/where:\s*{\s*(\w+)/);
    const campo = match?.[1] ?? null;

    throw new BadRequestException({
      message: 'El filtro aplicado no es válido para este campo.',
      campo,
      detalle:
        'Verifica que el tipo del filtro coincida con el tipo del campo.',
    });
  }

  throw new BadRequestException('Error inesperado al procesar los filtros.');
}
