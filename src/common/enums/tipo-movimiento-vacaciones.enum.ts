/**
 * Tipos de movimiento del historial de vacaciones de un colaborador.
 * Cada movimiento suma o resta días; el saldo se deriva del historial y
 * nunca se guarda como un único número editable.
 */
export enum TipoMovimientoVacaciones {
  /** Días adquiridos (periodo laborado, política ASADA, etc.). */
  ACUMULADO = 'ACUMULADO',

  /** Días consumidos al disfrutar vacaciones. */
  DISFRUTADO = 'DISFRUTADO',

  /**
   * Corrección administrativa. cantidadDias es positiva;
   * el signo lo da signoAjuste (+1 / -1). Requiere motivo.
   */
  AJUSTE = 'AJUSTE',
}

export const TIPOS_MOVIMIENTO_VACACIONES: readonly TipoMovimientoVacaciones[] =
  Object.values(TipoMovimientoVacaciones);
