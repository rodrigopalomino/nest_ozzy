//* src/modules/producto/utils/precio.util.ts

import { Prisma } from '@prisma/client';

// ===================================================================================
// Cálculo de precio y disponibilidad en el servidor.
//
// El front NO debe replicar estas reglas: la ventana de la oferta, el
// redondeo y la cascada de precios viven aquí, en un solo lugar.
// ===================================================================================

export interface PrecioEfectivo {
  // Precio que se cobra realmente.
  precio: number;
  // Precio tachado, sólo si hay descuento vigente.
  precioAnterior: number | null;
  // Descuento aplicado (0 si no hay oferta vigente).
  porcentajeDescuento: number;
  enOferta: boolean;
}

// ===================================================================================
type DecimalLike = Prisma.Decimal | number | string | null | undefined;

// Prisma serializa Decimal como string en JSON: se normaliza siempre a number.
export function toNumber(value: DecimalLike): number | null {
  if (value === null || value === undefined) return null;

  const n = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

// ===================================================================================
function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

// ===================================================================================
export interface PrecioProductoInput {
  precioOriginal: DecimalLike;
  porcentajeDescuento: number;
  precioOferta: DecimalLike;
  iniciaEn: Date | null;
  terminaEn: Date | null;
  activo: boolean;
}

// ===================================================================================
// La oferta cuenta sólo si está activa y la fecha actual cae en su ventana.
// Ventana abierta (iniciaEn o terminaEn en null) = sin límite por ese lado.
export function ofertaVigente(
  precio: PrecioProductoInput | null | undefined,
  ahora: Date = new Date(),
): boolean {
  if (!precio || !precio.activo) return false;

  if (precio.iniciaEn && ahora < precio.iniciaEn) return false;
  if (precio.terminaEn && ahora > precio.terminaEn) return false;

  return true;
}

// ===================================================================================
// Cascada de precios:
//   1. variante.precio, si la variante define uno propio
//   2. oferta vigente del producto (precioOferta, o el % sobre precioOriginal)
//   3. PrecioProducto.precioOriginal
//   4. producto.precioBase
//
// El precio de la variante manda sobre la oferta: es un precio ya definitivo
// fijado a mano para esa combinación.
export function calcularPrecioEfectivo(params: {
  precioBase: DecimalLike;
  precio?: PrecioProductoInput | null;
  precioVariante?: DecimalLike;
  ahora?: Date;
}): PrecioEfectivo {
  const { precioBase, precio, precioVariante, ahora = new Date() } = params;

  const varianteN = toNumber(precioVariante);

  if (varianteN !== null) {
    return {
      precio: redondear(varianteN),
      precioAnterior: null,
      porcentajeDescuento: 0,
      enOferta: false,
    };
  }

  const originalN = toNumber(precio?.precioOriginal);
  const baseN = toNumber(precioBase);

  // Precio de lista: el de PrecioProducto si existe, si no el del producto.
  const lista = originalN ?? baseN ?? 0;

  if (!ofertaVigente(precio, ahora)) {
    return {
      precio: redondear(lista),
      precioAnterior: null,
      porcentajeDescuento: 0,
      enOferta: false,
    };
  }

  // precioOferta explícito gana sobre el porcentaje.
  const ofertaN = toNumber(precio?.precioOferta);
  const pct = precio?.porcentajeDescuento ?? 0;

  const final =
    ofertaN !== null ? ofertaN : pct > 0 ? lista * (1 - pct / 100) : lista;

  // Una "oferta" que no baja el precio no se anuncia como oferta.
  if (final >= lista) {
    return {
      precio: redondear(lista),
      precioAnterior: null,
      porcentajeDescuento: 0,
      enOferta: false,
    };
  }

  const pctReal = lista > 0 ? Math.round((1 - final / lista) * 100) : 0;

  return {
    precio: redondear(final),
    precioAnterior: redondear(lista),
    porcentajeDescuento: pctReal,
    enOferta: true,
  };
}

// ===================================================================================
// Disponibilidad. `stock` en null significa "no se controla stock":
// la variante se considera disponible.
export function estaAgotado(stock: number | null | undefined): boolean {
  if (stock === null || stock === undefined) return false;
  return stock <= 0;
}
