import { TipoMovimientoVacaciones } from '../../common/enums/tipo-movimiento-vacaciones.enum';

export type MovimientoSaldoVacaciones = {
  tipo: TipoMovimientoVacaciones;
  cantidadDias: number;
  /** Solo para AJUSTE: +1 suma, -1 resta. */
  signoAjuste?: 1 | -1 | null;
};

export type SaldoVacaciones = {
  diasAcumulados: number;
  diasDisfrutados: number;
  /** Suma neta de ajustes (puede ser negativa). */
  diasAjusteNeto: number;
  /** disponibles = acumulados - disfrutados + ajusteNeto */
  diasDisponibles: number;
};

export const calcularSaldoVacaciones = (
  movimientos: readonly MovimientoSaldoVacaciones[],
): SaldoVacaciones => {
  let diasAcumulados = 0;
  let diasDisfrutados = 0;
  let diasAjusteNeto = 0;

  for (const movimiento of movimientos) {
    if (movimiento.tipo === TipoMovimientoVacaciones.ACUMULADO) {
      diasAcumulados += movimiento.cantidadDias;
    } else if (movimiento.tipo === TipoMovimientoVacaciones.DISFRUTADO) {
      diasDisfrutados += movimiento.cantidadDias;
    } else if (movimiento.tipo === TipoMovimientoVacaciones.AJUSTE) {
      const signo = movimiento.signoAjuste === -1 ? -1 : 1;
      diasAjusteNeto += signo * movimiento.cantidadDias;
    }
  }

  return {
    diasAcumulados,
    diasDisfrutados,
    diasAjusteNeto,
    diasDisponibles: diasAcumulados - diasDisfrutados + diasAjusteNeto,
  };
};
