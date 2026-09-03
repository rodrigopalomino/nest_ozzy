//* src/modules/minio/minio.constants.ts

// ===================================================================================
// Reglas de subida. Sin esta whitelist, un usuario autenticado podía pedir
// un presign para cualquier nombre de archivo y subir un ejecutable o un
// fichero de varios GB al bucket.
// ===================================================================================

export const TIPOS_IMAGEN_PERMITIDOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

export const EXTENSIONES_IMAGEN_PERMITIDAS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'avif',
];

// 12 MB: una foto de móvil sin procesar cabe de sobra.
export const TAMANO_MAXIMO_IMAGEN = 12 * 1024 * 1024;

// Los presign caducan pronto: son de un solo uso inmediato.
export const PRESIGN_EXPIRA_SEGUNDOS = 60 * 5;

// ===================================================================================
// Tamaños que se generan por cada imagen subida.
export const VARIANTES_IMAGEN = [
  { nombre: 'sm', ancho: 300 },
  { nombre: 'md', ancho: 600 },
  { nombre: 'lg', ancho: 1200 },
] as const;

export type NombreVarianteImagen = (typeof VARIANTES_IMAGEN)[number]['nombre'];
