//* src/modules/auth/auth.fuga-password.spec.ts

// ===================================================================================
// El hash de la contraseña no debe salir en ninguna respuesta de auth.
//
// El repositorio sí lo selecciona, porque argon2 lo necesita para verificar
// el login, así que la garantía no puede venir de "no consultarlo nunca":
// tiene que estar en lo que cada método devuelve. Estas pruebas fijan esa
// propiedad para que un `select` ampliado o un `...user` por descuido rompa
// aquí y no en producción.
// ===================================================================================

import * as argon2 from 'argon2';
import { AuthService } from './auth.service';

jest.mock('@nestjs/schedule', () => ({
  Cron: () => () => undefined,
  CronExpression: {},
}));

// ===================================================================================
const USUARIO = {
  id: 1,
  username: 'admin',
  // Un hash con la forma real, para que nadie lo confunda con un hueco.
  password: '$argon2id$v=19$m=65536,t=3,p=4$c2FsdA$aGFzaA',
  rol: 'ADMIN',
  activo: true,
  tokenVersion: 0,
};

function servicio() {
  const prisma = {
    usuario: {
      update: () => Promise.resolve(USUARIO),
      findUnique: () => Promise.resolve(USUARIO),
    },
  } as never;

  const repo = { findUnique: () => Promise.resolve(USUARIO) } as never;
  const jwt = { sign: () => 'token-firmado' } as never;
  const refresh = { emitir: () => Promise.resolve('refresh-token') } as never;

  return new AuthService(repo, prisma, jwt, refresh);
}

// Busca la cadena del hash en cualquier nivel de la respuesta: un objeto
// anidado que lo lleve es igual de grave que uno de primer nivel.
function contieneHash(valor: unknown): boolean {
  return JSON.stringify(valor ?? null).includes('$argon2');
}

// ===================================================================================
describe('auth no filtra el hash de la contraseña', () => {
  beforeAll(() => {
    // El login verifica con argon2; el hash de la ficha no es real.
    jest.spyOn(argon2, 'verify').mockResolvedValue(true);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('la respuesta del login no lo lleva', async () => {
    const resultado = await servicio().signin({
      username: 'admin',
      password: 'correcta',
    } as never);

    expect(contieneHash(resultado)).toBe(false);

    // Y devuelve exactamente los campos previstos, ni uno más.
    expect(Object.keys(resultado.user).sort()).toEqual([
      'activo',
      'id',
      'rol',
      'username',
    ]);
  });

  it('el detector reconocería el hash si se filtrara', () => {
    // Sin esta comprobación, un detector roto haría pasar las demás.
    expect(contieneHash({ user: USUARIO })).toBe(true);
    expect(
      contieneHash({ user: { anidado: { password: USUARIO.password } } }),
    ).toBe(true);
  });
});
