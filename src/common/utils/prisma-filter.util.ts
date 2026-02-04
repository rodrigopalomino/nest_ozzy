// src/common/utils/prisma-filter.util.ts
import { BadRequestException } from '@nestjs/common';

export function handlePrismaFilterError(err: unknown): never {
  const message =
    typeof err === 'object' && err !== null && 'message' in err
      ? String((err as any).message ?? '')
      : '';

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
