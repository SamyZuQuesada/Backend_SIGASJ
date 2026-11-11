/**
 * Fuente única de roles de autorización SIGASJ.
 *
 * Valores = lo persistido en `Rol.nombre` y en `JWT.role` (estables).
 * Labels de dominio (UI) viven en `ROLE_LABELS`, no en el valor del enum.
 *
 * Roles operativos ASADA (backlog centralización):
 * Administradora, Secretaria Ejecutiva, Fontanero.
 *
 * Roles adicionales legítimos del sistema (no eliminar sin confirmación):
 * Abonado, Ayudante.
 */
export enum Role {
  ADMINISTRADORA = 'ADMINISTRADORA',
  /**
   * Secretaria Ejecutiva.
   * Valor histórico en BD/JWT: `SECRETARIA` (no renombrar sin migration).
   */
  SECRETARIA_EJECUTIVA = 'SECRETARIA',
  FONTANERO = 'FONTANERO',
  ABONADO = 'ABONADO',
  /** Acompaña al Fontanero en una avería. Solo queda registrado; no atiende. */
  AYUDANTE = 'AYUDANTE',
}

/**
 * @deprecated Usar `Role.SECRETARIA_EJECUTIVA`. Mismo valor persistido (`SECRETARIA`).
 * Se mantiene como alias tipado para lecturas graduales; no usar en código nuevo.
 */
export const RoleSecretaria = Role.SECRETARIA_EJECUTIVA;

/** Etiquetas de dominio (no usar para autorización). */
export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  [Role.ADMINISTRADORA]: 'Administradora',
  [Role.SECRETARIA_EJECUTIVA]: 'Secretaria Ejecutiva',
  [Role.FONTANERO]: 'Fontanero',
  [Role.ABONADO]: 'Abonado',
  [Role.AYUDANTE]: 'Ayudante',
};

/** Roles staff ASADA del backlog de centralización. */
export const ROLES_OPERATIVOS_ASADA: readonly Role[] = [
  Role.ADMINISTRADORA,
  Role.SECRETARIA_EJECUTIVA,
  Role.FONTANERO,
];

/** Catálogo completo a sembrar en tabla `Rol` (idempotente). */
export const ROLES_SISTEMA: readonly Role[] = [
  Role.ADMINISTRADORA,
  Role.SECRETARIA_EJECUTIVA,
  Role.FONTANERO,
  Role.ABONADO,
  Role.AYUDANTE,
];

const ROLE_VALUES = new Set<string>(Object.values(Role));

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && ROLE_VALUES.has(value);
}

/** Parseo estricto para Auth/JWT. No normaliza ni hace includes parciales. */
export function parseRole(value: unknown): Role | null {
  return isRole(value) ? value : null;
}
