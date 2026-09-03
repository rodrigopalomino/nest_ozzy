//* src/common/config/jwt.config.ts

// ===================================================================================
// Lectura estricta de la configuración de autenticación.
//
// Antes JWT_SECRET tenía fallback a la cadena literal 'MISSING_JWT_SECRET':
// si la variable faltaba en producción, la API arrancaba con un secreto
// conocido y público en lugar de fallar. Ahora si falta, la app no arranca.
// ===================================================================================
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.trim().length === 0) {
    throw new Error(
      'JWT_SECRET no está definido. Defínelo en el entorno antes de iniciar la API.',
    );
  }

  if (secret.length < 32) {
    throw new Error(
      'JWT_SECRET es demasiado corto. Usa al menos 32 caracteres aleatorios.',
    );
  }

  return secret;
}

// ===================================================================================
// El token de acceso es corto porque no se puede revocar de inmediato; la
// sesión se mantiene con el refresh token, que sí vive en la base y se
// puede invalidar.
export const TOKEN_EXPIRES_IN = '15m';
export const TOKEN_MAX_AGE_MS = 1000 * 60 * 15;

export const REFRESH_EXPIRES_DIAS = 30;
export const REFRESH_MAX_AGE_MS = 1000 * 60 * 60 * 24 * REFRESH_EXPIRES_DIAS;

export const REFRESH_TOKEN_COOKIE = 'refresh_token';

// ===================================================================================
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ===================================================================================
// Nombre de la cookie de sesión, compartido por login y logout.
export const ACCESS_TOKEN_COOKIE = 'access_token';
