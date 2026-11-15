import {
  comparePassword,
  hashPassword,
  PasswordHashingError,
  PasswordInputError,
  verifyPassword,
} from './password.util';

describe('password.util (bcrypt SIGASJ)', () => {
  const plain = 'Password123!';

  it('genera un hash distinto a la contraseña original', async () => {
    const hash = await hashPassword(plain);
    expect(hash).not.toBe(plain);
    expect(hash.startsWith('$2')).toBe(true);
    expect(hash.length).toBeGreaterThan(50);
  });

  it('dos hashes de la misma password no son idénticos (salt)', async () => {
    const a = await hashPassword(plain);
    const b = await hashPassword(plain);
    expect(a).not.toBe(b);
    expect(await verifyPassword(plain, a)).toBe(true);
    expect(await verifyPassword(plain, b)).toBe(true);
  });

  it('verifica la contraseña correcta y rechaza la incorrecta', async () => {
    const hash = await hashPassword(plain);
    expect(await verifyPassword(plain, hash)).toBe(true);
    expect(await comparePassword(plain, hash)).toBe(true);
    expect(await verifyPassword('WrongPass1', hash)).toBe(false);
  });

  it('rechaza password vacía y no llama a persistencia (solo lanza)', async () => {
    await expect(hashPassword('')).rejects.toBeInstanceOf(PasswordInputError);
  });

  it('compare con hash inválido retorna false', async () => {
    expect(await verifyPassword(plain, 'no-es-un-hash')).toBe(false);
    expect(await verifyPassword(plain, '')).toBe(false);
  });

  it('PasswordHashingError no incluye detalle interno de bcrypt', () => {
    const error = new PasswordHashingError();
    expect(error.message).toBe('No fue posible procesar las credenciales.');
    expect(error.message).not.toMatch(/bcrypt|salt|hash/i);
  });
});
