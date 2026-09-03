//* src/modules/auth/schemas/usuario.schema.ts

import { RolUsuario } from '@prisma/client';
import { z } from 'zod';

// ===================================================================================
// Contraseñas del panel: sin exigencias de longitud ni composición, por
// decisión explícita del dueño del proyecto (2026-09-03), que quiere poder
// usar credenciales cortas como admin/admin.
//
// Consecuencia asumida: admin/admin es la primera combinación que prueba
// cualquier escáner automático contra /auth/login, y acierta. Si esta API
// llega a estar accesible desde internet, conviene subir este mínimo y
// cambiar la contraseña del panel antes.
const passwordSchema = z
  .string()
  .min(1, 'La contraseña es obligatoria')
  .max(128);

// ===================================================================================
export const CrearUsuarioSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      'Sólo letras, números, punto, guion y guion bajo',
    ),
  password: passwordSchema,
  rol: z.enum(RolUsuario).optional(),
});

export type CrearUsuarioType = z.infer<typeof CrearUsuarioSchema>;

// ===================================================================================
export const ActualizarUsuarioSchema = z
  .object({
    rol: z.enum(RolUsuario).optional(),
    activo: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Envía al menos un campo para actualizar',
  });

export type ActualizarUsuarioType = z.infer<typeof ActualizarUsuarioSchema>;

// ===================================================================================
export const CambiarPasswordSchema = z
  .object({
    passwordActual: z.string().min(1, 'La contraseña actual es obligatoria'),
    passwordNueva: passwordSchema,
  })
  .refine((d) => d.passwordActual !== d.passwordNueva, {
    path: ['passwordNueva'],
    message: 'La contraseña nueva debe ser distinta de la actual',
  });

export type CambiarPasswordType = z.infer<typeof CambiarPasswordSchema>;

// ===================================================================================
export const RestablecerPasswordSchema = z.object({
  passwordNueva: passwordSchema,
});

export type RestablecerPasswordType = z.infer<typeof RestablecerPasswordSchema>;
