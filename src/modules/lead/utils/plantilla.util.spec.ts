import {
  construirUrlWhatsapp,
  normalizarNumeroWhatsapp,
  rellenarPlantilla,
} from './plantilla.util';

describe('rellenarPlantilla', () => {
  it('sustituye las variables presentes', () => {
    expect(
      rellenarPlantilla('Hola {{nombre}}, cuesta {{precio}}', {
        nombre: 'Ana',
        precio: 'S/ 80.00',
      }),
    ).toBe('Hola Ana, cuesta S/ 80.00');
  });

  it('sustituye por cadena vacía las variables sin valor', () => {
    expect(rellenarPlantilla('A{{falta}}B', {})).toBe('AB');
  });

  it('repite el valor si la variable aparece varias veces', () => {
    expect(rellenarPlantilla('{{x}}-{{x}}', { x: '1' })).toBe('1-1');
  });

  it('deja intacto el texto sin variables', () => {
    expect(rellenarPlantilla('sin variables', { x: '1' })).toBe(
      'sin variables',
    );
  });

  it('respeta los saltos de línea de la plantilla', () => {
    expect(rellenarPlantilla('a\n{{v}}b', { v: 'X\n' })).toBe('a\nX\nb');
  });
});

describe('normalizarNumeroWhatsapp', () => {
  it('elimina espacios, guiones y paréntesis', () => {
    expect(normalizarNumeroWhatsapp('+51 (987) 654-321')).toBe('51987654321');
  });

  it('devuelve cadena vacía si no hay dígitos', () => {
    expect(normalizarNumeroWhatsapp('sin numero')).toBe('');
  });
});

describe('construirUrlWhatsapp', () => {
  it('codifica el mensaje para la URL', () => {
    const url = construirUrlWhatsapp('+51 987 654 321', 'Hola: ¿cuánto?');

    expect(url).toContain('https://wa.me/51987654321?text=');
    expect(url).not.toContain(' ');
    expect(decodeURIComponent(url.split('text=')[1])).toBe('Hola: ¿cuánto?');
  });

  it('codifica los saltos de línea', () => {
    const url = construirUrlWhatsapp('51987654321', 'linea1\nlinea2');

    expect(url).toContain('%0A');
    expect(decodeURIComponent(url.split('text=')[1])).toBe('linea1\nlinea2');
  });

  it('preserva el asterisco del formato en negrita de WhatsApp', () => {
    const url = construirUrlWhatsapp('51987654321', '*Polo*');
    expect(decodeURIComponent(url.split('text=')[1])).toBe('*Polo*');
  });
});
