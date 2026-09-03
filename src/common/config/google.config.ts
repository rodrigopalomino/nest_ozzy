//* src/common/config/google.config.ts

// ===================================================================================
// Configuración del login con Google.
//
// GOOGLE_CLIENT_ID es obligatorio para verificar los id_token: sin él no se
// puede comprobar que el token lo emitió Google para esta aplicación, y
// aceptarlo sin verificar permitiría suplantar cualquier correo.
// ===================================================================================

export function getGoogleClientId(): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId || clientId.trim().length === 0) {
    throw new Error(
      'GOOGLE_CLIENT_ID no está definido. Es necesario para validar el login con Google.',
    );
  }

  return clientId;
}

// ===================================================================================
// Las sesiones de cliente duran más que las de administrador: no dan acceso
// a nada sensible y volver a entrar continuamente estorba.
export const CLIENTE_TOKEN_EXPIRA = '30d';
export const CLIENTE_TOKEN_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

export const CLIENTE_TOKEN_COOKIE = 'cliente_token';
