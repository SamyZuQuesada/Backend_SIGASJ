/**
 * Única fuente de los roles de SIGASJ.
 *
 * El valor del enum es el código persistido en `Rol.nombre` y el `role` del JWT.
 * No se autoriza con etiquetas visibles ni con variantes en minúsculas.
 *
 * Secretaria Ejecutiva se persiste como `SECRETARIA`. Cambiar ese texto
 * rompería usuarios y tokens ya guardados.
 *
 * ABONADO y AYUDANTE ya existían en código y en la migración de roles.
 * No forman parte del trío funcional de esta tarea; se conservan.
 */
export enum Role {
  ADMINISTRADORA = 'ADMINISTRADORA',
  SECRETARIA = 'SECRETARIA',
  FONTANERO = 'FONTANERO',
  ABONADO = 'ABONADO',
  /** Acompaña al Fontanero en una avería. Solo queda registrado; no atiende. */
  AYUDANTE = 'AYUDANTE',
}

/** Catálogo que siembran la tabla Rol. Derivado del enum; no es otra definición. */
export const ROLES_SISTEMA: readonly Role[] = [
  Role.ADMINISTRADORA,
  Role.SECRETARIA,
  Role.FONTANERO,
  Role.ABONADO,
  Role.AYUDANTE,
];

/**
 * Texto visible. No se guarda en `Rol.nombre` y RolesGuard no lo compara.
 */
export const ROLE_ETIQUETA: Record<Role, string> = {
  [Role.ADMINISTRADORA]: 'Administradora',
  [Role.SECRETARIA]: 'Secretaria Ejecutiva',
  [Role.FONTANERO]: 'Fontanero',
  [Role.ABONADO]: 'Abonado',
  [Role.AYUDANTE]: 'Ayudante',
};

const ROLES_CONOCIDOS = new Set<string>(ROLES_SISTEMA);

/** Comparación exacta contra el código persistido. Rechaza etiquetas y alias. */
export function esRol(valor: string | null | undefined): valor is Role {
  return typeof valor === 'string' && ROLES_CONOCIDOS.has(valor);
}
