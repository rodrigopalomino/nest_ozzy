import { RolUsuario } from '@prisma/client';
import { Request } from 'express';

// ===================================================================================
// Usuario administrador autenticado, tal como lo expone JwtStrategy.
// Se declara campo a campo (en vez de Omit<Usuario, 'password'>) para que
// añadir columnas internas al modelo no las filtre en /auth/me.
export interface JwtUser {
  id: number;
  username: string;
  rol: RolUsuario;
  activo: boolean;
}

// ===================================================================================
// Cliente de la tienda autenticado con Google. Es un sujeto distinto del
// administrador y nunca da acceso al panel.
export interface ClienteAutenticado {
  id: number;
  email: string;
  nombre: string;
  avatar: string | null;
}

export interface AuthenticatedRequest extends Request {
  user: JwtUser;
}

export interface ClienteRequest extends Request {
  cliente: ClienteAutenticado;
}
