import {
  calcularPrecioEfectivo,
  estaAgotado,
  ofertaVigente,
  toNumber,
} from './precio.util';

const precioBase = {
  precioOriginal: 100,
  porcentajeDescuento: 0,
  precioOferta: null,
  iniciaEn: null,
  terminaEn: null,
  activo: true,
};

describe('toNumber', () => {
  it('normaliza el string que devuelve Prisma para Decimal', () => {
    expect(toNumber('19.90')).toBe(19.9);
  });

  it('devuelve null para null y undefined', () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
  });
});

describe('ofertaVigente', () => {
  const ahora = new Date('2026-06-15T12:00:00Z');

  it('es falsa sin registro de precio', () => {
    expect(ofertaVigente(null, ahora)).toBe(false);
  });

  it('es falsa si el registro está inactivo', () => {
    expect(ofertaVigente({ ...precioBase, activo: false }, ahora)).toBe(false);
  });

  it('es falsa antes de iniciaEn', () => {
    expect(
      ofertaVigente(
        { ...precioBase, iniciaEn: new Date('2026-07-01T00:00:00Z') },
        ahora,
      ),
    ).toBe(false);
  });

  it('es falsa después de terminaEn', () => {
    expect(
      ofertaVigente(
        { ...precioBase, terminaEn: new Date('2026-06-01T00:00:00Z') },
        ahora,
      ),
    ).toBe(false);
  });

  it('es verdadera dentro de la ventana', () => {
    expect(
      ofertaVigente(
        {
          ...precioBase,
          iniciaEn: new Date('2026-06-01T00:00:00Z'),
          terminaEn: new Date('2026-06-30T00:00:00Z'),
        },
        ahora,
      ),
    ).toBe(true);
  });

  it('es verdadera con ventana abierta por ambos lados', () => {
    expect(ofertaVigente(precioBase, ahora)).toBe(true);
  });
});

describe('calcularPrecioEfectivo', () => {
  it('usa precioBase cuando no hay registro de precio', () => {
    expect(calcularPrecioEfectivo({ precioBase: 59.9 })).toEqual({
      precio: 59.9,
      precioAnterior: null,
      porcentajeDescuento: 0,
      enOferta: false,
    });
  });

  it('el precio de la variante manda sobre todo lo demás', () => {
    const r = calcularPrecioEfectivo({
      precioBase: 100,
      precio: { ...precioBase, porcentajeDescuento: 50 },
      precioVariante: 80,
    });

    expect(r.precio).toBe(80);
    expect(r.enOferta).toBe(false);
  });

  it('aplica el porcentaje de descuento vigente', () => {
    const r = calcularPrecioEfectivo({
      precioBase: 100,
      precio: { ...precioBase, precioOriginal: 200, porcentajeDescuento: 25 },
    });

    expect(r).toEqual({
      precio: 150,
      precioAnterior: 200,
      porcentajeDescuento: 25,
      enOferta: true,
    });
  });

  it('precioOferta explícito gana sobre el porcentaje', () => {
    const r = calcularPrecioEfectivo({
      precioBase: 100,
      precio: {
        ...precioBase,
        precioOriginal: 100,
        porcentajeDescuento: 90,
        precioOferta: 75,
      },
    });

    expect(r.precio).toBe(75);
    expect(r.porcentajeDescuento).toBe(25);
  });

  it('ignora la oferta fuera de su ventana', () => {
    const r = calcularPrecioEfectivo({
      precioBase: 100,
      precio: {
        ...precioBase,
        precioOriginal: 200,
        porcentajeDescuento: 50,
        terminaEn: new Date('2020-01-01T00:00:00Z'),
      },
    });

    expect(r.precio).toBe(200);
    expect(r.enOferta).toBe(false);
  });

  it('no anuncia oferta si el precio no baja', () => {
    const r = calcularPrecioEfectivo({
      precioBase: 100,
      precio: { ...precioBase, precioOriginal: 100, precioOferta: 120 },
    });

    expect(r.precio).toBe(100);
    expect(r.enOferta).toBe(false);
    expect(r.precioAnterior).toBeNull();
  });

  it('redondea a dos decimales', () => {
    const r = calcularPrecioEfectivo({
      precioBase: 100,
      precio: { ...precioBase, precioOriginal: 99.99, porcentajeDescuento: 33 },
    });

    expect(r.precio).toBe(66.99);
  });

  it('acepta los Decimal serializados como string', () => {
    const r = calcularPrecioEfectivo({
      precioBase: '49.90',
      precio: { ...precioBase, precioOriginal: '49.90', precioOferta: '39.90' },
    });

    expect(r.precio).toBe(39.9);
    expect(r.precioAnterior).toBe(49.9);
  });
});

describe('estaAgotado', () => {
  it('stock null significa que no se controla stock', () => {
    expect(estaAgotado(null)).toBe(false);
    expect(estaAgotado(undefined)).toBe(false);
  });

  it('stock cero o negativo está agotado', () => {
    expect(estaAgotado(0)).toBe(true);
    expect(estaAgotado(-3)).toBe(true);
  });

  it('stock positivo está disponible', () => {
    expect(estaAgotado(5)).toBe(false);
  });
});
