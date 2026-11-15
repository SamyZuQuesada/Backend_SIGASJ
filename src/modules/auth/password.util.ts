import * as bcrypt from 'bcrypt';

/**
 * Cost factor único de SIGASJ. Valor histórico del login y los seeds (10).
 * No se baja en tests: el hasher no tiene un camino “rápido” paralelo.
 */
export const BCRYPT_ROUNDS = 10;

/** Misma longitud mínima que LoginDto; no se inventa una política nueva. */
export const PASSWORD_MIN_LENGTH = 6;

export class PasswordInputError extends Error {
  constructor(message = 'La contraseña no es válida.') {
    super(message);
    this.name = 'PasswordInputError';
  }
}

export class PasswordHashingError extends Error {
  constructor() {
    super('No fue posible procesar las credenciales.');
    this.name = 'PasswordHashingError';
  }
}

function assertPlainPassword(plain: string): void {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new PasswordInputError();
  }
}

export async function hashPassword(plain: string): Promise<string> {
  assertPlainPassword(plain);
  try {
    return await bcrypt.hash(plain, BCRYPT_ROUNDS);
  } catch (error) {
    if (error instanceof PasswordInputError) {
      throw error;
    }
    throw new PasswordHashingError();
  }
}

export async function verifyPassword(
  plain: string,
  passwordHash: string,
): Promise<boolean> {
  if (
    typeof plain !== 'string' ||
    typeof passwordHash !== 'string' ||
    passwordHash.length === 0
  ) {
    return false;
  }
  try {
    return await bcrypt.compare(plain, passwordHash);
  } catch {
    return false;
  }
}

export const comparePassword = verifyPassword;
