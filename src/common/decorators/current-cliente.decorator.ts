//* src/common/decorators/current-cliente.decorator.ts

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ClienteAutenticado } from '../types/express';

type RequestConCliente = Request & { cliente?: ClienteAutenticado };

// ===================================================================================
// Cliente autenticado por ClienteGuard. Distinto de @CurrentUser(), que
// devuelve el administrador.
export const CurrentCliente = createParamDecorator<
  ClienteAutenticado | undefined,
  unknown
>((_data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<RequestConCliente>();
  return req.cliente;
});
