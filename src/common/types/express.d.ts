import { Usuario } from '@prisma/client';
import { Request } from 'express';

export type JwtUser = Omit<Usuario, 'password'> & {
  id: number;
  username: string;
};

export interface AuthenticatedRequest extends Request {
  user: JwtUser;
}
