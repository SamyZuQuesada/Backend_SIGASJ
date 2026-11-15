import * as bcrypt from 'bcrypt';

/** Cost factor por defecto (bcrypt). Suficiente para producción; no bajar en tests. */
export const DEFAULT_BCRYPT_ROUNDS = 10;

const HASH_ERROR = 'Error generating password hash';

/**
 * Resuelve rounds: argumento > BCRYPT_ROUNDS env > default.
 * Rechaza valores inseguros (< 10).
 */
export function resolveBcryptRounds(configured?: number): number {
  if (
    configured != null &&
    Number.isFinite(configured) &&
    configured >= DEFAULT_BCRYPT_ROUNDS
  ) {
    return Math.floor(configured);
  }

  const fromEnv = Number(process.env.BCRYPT_ROUNDS);
  if (Number.isFinite(fromEnv) && fromEnv >= DEFAULT_BCRYPT_ROUNDS) {
    return Math.floor(fromEnv);
  }

  return DEFAULT_BCRYPT_ROUNDS;
}

/**
 * Genera hash bcrypt. Nunca devolver ni loguear `plain`.
 * @throws Error con mensaje genérico si la entrada es inválida o bcrypt falla.
 */
export async function hashPassword(
  plain: string,
  rounds?: number,
): Promise<string> {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new Error(HASH_ERROR);
  }

  try {
    return await bcrypt.hash(plain, resolveBcryptRounds(rounds));
  } catch {
    throw new Error(HASH_ERROR);
  }
}

/**
 * Compara password en texto plano con hash almacenado (bcrypt.compare).
 * No re-hashea para comparar. Hash inválido → false (sin filtrar detalle).
 */
export async function comparePassword(
  plain: string,
  passwordHash: string,
): Promise<boolean> {
  if (
    typeof plain !== 'string' ||
    plain.length === 0 ||
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

/** Alias estable para callers existentes. */
export const verifyPassword = comparePassword;
