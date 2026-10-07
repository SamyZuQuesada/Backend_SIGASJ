export enum Role {
  ADMINISTRADORA = 'ADMINISTRADORA',
  SECRETARIA = 'SECRETARIA',
  FONTANERO = 'FONTANERO',
  ABONADO = 'ABONADO',
  /** Acompaña al Fontanero en una avería. Solo queda registrado; no atiende. */
  AYUDANTE = 'AYUDANTE',
}

export const ROLES_SISTEMA: readonly Role[] = [
  Role.ADMINISTRADORA,
  Role.SECRETARIA,
  Role.FONTANERO,
  Role.ABONADO,
  Role.AYUDANTE,
];
