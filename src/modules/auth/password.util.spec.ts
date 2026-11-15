import {
  comparePassword,
  DEFAULT_BCRYPT_ROUNDS,
  hashPassword,
  resolveBcryptRounds,
  verifyPassword,
} from './password.util';

const PASSWORD_SINTETICA = 'TestPassword123!';

describe('password.util (hash seguro centralizado)', () => {
  it('resolveBcryptRounds usa default 10 y rechaza valores bajos', () => {
    expect(resolveBcryptRounds()).toBe(DEFAULT_BCRYPT_ROUNDS);
    expect(resolveBcryptRounds(4)).toBe(DEFAULT_BCRYPT_ROUNDS);
    expect(resolveBcryptRounds(12)).toBe(12);
  });

  it('hashPassword genera bcrypt distinto del texto plano', async () => {
    const hash = await hashPassword(PASSWORD_SINTETICA);
    expect(hash).not.toBe(PASSWORD_SINTETICA);
    expect(hash.startsWith('$2')).toBe(true);
    expect(hash.length).toBeGreaterThanOrEqual(50);
  });

  it('dos hashes de la misma password no son necesariamente iguales (salt)', async () => {
    const a = await hashPassword(PASSWORD_SINTETICA);
    const b = await hashPassword(PASSWORD_SINTETICA);
    expect(a).not.toBe(b);
    expect(await comparePassword(PASSWORD_SINTETICA, a)).toBe(true);
    expect(await comparePassword(PASSWORD_SINTETICA, b)).toBe(true);
  });

  it('comparePassword correcta → true; incorrecta → false', async () => {
    const hash = await hashPassword(PASSWORD_SINTETICA);
    expect(await comparePassword(PASSWORD_SINTETICA, hash)).toBe(true);
    expect(await comparePassword('OtraPassword999!', hash)).toBe(false);
  });

  it('verifyPassword es alias de comparePassword', async () => {
    const hash = await hashPassword(PASSWORD_SINTETICA);
    expect(await verifyPassword(PASSWORD_SINTETICA, hash)).toBe(true);
  });

  it('hashPassword rechaza string vacío sin persistir nada', async () => {
    await expect(hashPassword('')).rejects.toThrow(
      'Error generating password hash',
    );
  });

  it('comparePassword con hash inválido o vacío → false (sin throw)', async () => {
    expect(await comparePassword(PASSWORD_SINTETICA, '')).toBe(false);
    expect(await comparePassword(PASSWORD_SINTETICA, 'not-a-bcrypt-hash')).toBe(
      false,
    );
    expect(
      await comparePassword('', await hashPassword(PASSWORD_SINTETICA)),
    ).toBe(false);
  });

  it('no existe comparación directa password === hash', async () => {
    const hash = await hashPassword(PASSWORD_SINTETICA);
    expect(PASSWORD_SINTETICA === hash).toBe(false);
    expect(await comparePassword(PASSWORD_SINTETICA, hash)).toBe(true);
  });
});
