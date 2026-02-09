// src/common/decoradores/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { JwtUser } from '../types/express';

type RequestWithUser = Request & { user?: JwtUser };

export const CurrentUser = createParamDecorator<JwtUser | undefined, unknown>(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<RequestWithUser>();
    return req.user;
  },
);
