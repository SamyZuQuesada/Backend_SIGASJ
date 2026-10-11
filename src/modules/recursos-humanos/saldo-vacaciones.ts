import { TipoMovimientoVacaciones } from '../../common/enums/tipo-movimiento-vacaciones.enum';

export type MovimientoSaldoVacaciones = {
  tipo: TipoMovimientoVacaciones;
  cantidadDias: number;
};

export type SaldoVacaciones = {
  /** Total de días acumulados en el historial. */
  diasAcumulados: number;
  /** Total de días disfrutados en el historial. */
  diasDisfrutados: number;
  /** Días disponibles: acumulados - disfrutados. */
  diasDisponibles: number;
};

/** Signo que aporta cada tipo de movimiento al saldo. */
export const SIGNO_MOVIMIENTO_VACACIONES: Readonly<
  Record<TipoMovimientoVacaciones, 1 | -1>
> = {
  [TipoMovimientoVacaciones.ACUMULADO]: 1,
  [TipoMovimientoVacaciones.DISFRUTADO]: -1,
};

/**
 * Deriva el saldo de vacaciones a partir del historial de movimientos.
 * El saldo nunca se almacena: siempre se recalcula desde los movimientos,
 * de modo que cualquier cambio queda trazado como un movimiento más.
 */
export const calcularSaldoVacaciones = (
  movimientos: readonly MovimientoSaldoVacaciones[],
): SaldoVacaciones => {
  let diasAcumulados = 0;
  let diasDisfrutados = 0;

  for (const movimiento of movimientos) {
    if (movimiento.tipo === TipoMovimientoVacaciones.ACUMULADO) {
      diasAcumulados += movimiento.cantidadDias;
    } else if (movimiento.tipo === TipoMovimientoVacaciones.DISFRUTADO) {
      diasDisfrutados += movimiento.cantidadDias;
    }
  }

  return {
    diasAcumulados,
    diasDisfrutados,
    diasDisponibles: diasAcumulados - diasDisfrutados,
  };
};
