import {
  compararFechasIso,
  esFechaCalendario,
} from '../recursos-humanos/fecha-permiso';
import {
  feriadosEnPeriodo,
  type FeriadoCostaRica,
} from './feriados-costa-rica';

/** Días calendario inclusivos entre dos fechas YYYY-MM-DD. */
export const diasInclusiveEntreFechas = (
  fechaInicio: string,
  fechaFin: string,
): number => {
  if (!esFechaCalendario(fechaInicio) || !esFechaCalendario(fechaFin)) {
    return 0;
  }
  if (compararFechasIso(fechaInicio, fechaFin) > 0) {
    return 0;
  }
  const [y1, m1, d1] = fechaInicio.split('-').map(Number);
  const [y2, m2, d2] = fechaFin.split('-').map(Number);
  const inicio = Date.UTC(y1, m1 - 1, d1);
  const fin = Date.UTC(y2, m2 - 1, d2);
  return Math.floor((fin - inicio) / 86_400_000) + 1;
};

export type ResumenDiasVacaciones = {
  diasCalendario: number;
  feriados: FeriadoCostaRica[];
  /** Días que se descuentan del saldo (calendario − feriados en el periodo). */
  diasNetos: number;
};

/**
 * Días de vacaciones a descontar del saldo: calendario inclusivo
 * menos feriados nacionales de Costa Rica que caen en el periodo.
 */
export const resumenDiasVacaciones = (
  fechaInicio: string,
  fechaFin: string,
): ResumenDiasVacaciones => {
  const diasCalendario = diasInclusiveEntreFechas(fechaInicio, fechaFin);
  if (diasCalendario < 1) {
    return { diasCalendario: 0, feriados: [], diasNetos: 0 };
  }
  const feriados = feriadosEnPeriodo(fechaInicio, fechaFin);
  return {
    diasCalendario,
    feriados,
    diasNetos: Math.max(0, diasCalendario - feriados.length),
  };
};

/** Atajo: solo la cantidad neta a descontar. */
export const diasVacacionesNetos = (
  fechaInicio: string,
  fechaFin: string,
): number => resumenDiasVacaciones(fechaInicio, fechaFin).diasNetos;
