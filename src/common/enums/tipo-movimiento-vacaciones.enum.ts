/**
 * Tipos de movimiento del historial de vacaciones de un colaborador.
 * Cada movimiento suma o resta días; el saldo se deriva del historial y
 * nunca se guarda como un único número editable.
 */
export enum TipoMovimientoVacaciones {
  /** Días que el colaborador gana (por antigüedad, periodo laborado, ajuste a favor). */
  ACUMULADO = 'ACUMULADO',

  /** Días que el colaborador consume al tomar vacaciones. */
  DISFRUTADO = 'DISFRUTADO',
}

export const TIPOS_MOVIMIENTO_VACACIONES: readonly TipoMovimientoVacaciones[] =
  Object.values(TipoMovimientoVacaciones);
