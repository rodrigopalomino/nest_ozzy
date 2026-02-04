// src/errors/global-exception.filter.ts

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ZodError } from 'zod';
import type { Response } from 'express';
import { formatZodErrors } from './zod-formatter';

// ===================================================================================
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // ===================================================================================
    // ✅ Caso: HttpException que trae un ZodError embebido (custom payload)
    if (
      exception instanceof HttpException &&
      'error' in exception &&
      (exception as HttpException & { error?: unknown }).error instanceof
        ZodError
    ) {
      const zodErr = (exception as HttpException & { error: ZodError }).error;
      const details = formatZodErrors(zodErr);

      // ✅ Devolver con excepción estándar de Nest
      const nestErr = new BadRequestException({
        message: 'Validación fallida.',
        details,
      });

      response.status(nestErr.getStatus()).json(nestErr.getResponse());
      return;
    }

    // ===================================================================================
    // ✅ Caso: ZodError directo
    if (exception instanceof ZodError) {
      const details = formatZodErrors(exception);

      const nestErr = new BadRequestException({
        message: 'Validación fallida.',
        details,
      });

      response.status(nestErr.getStatus()).json(nestErr.getResponse());
      return;
    }

    // ===================================================================================
    // ✅ HttpException normal (BadRequest, Unauthorized, Forbidden, etc.)
    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    // ===================================================================================
    // ✅ Cualquier otro error inesperado
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Error interno del servidor.',
    });
  }
}
