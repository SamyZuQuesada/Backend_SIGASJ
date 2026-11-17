import {
  compararFechasIso,
  esFechaCalendario,
} from '../recursos-humanos/fecha-permiso';
import { esFeriadoCostaRica } from './feriados-costa-rica';
import { diasInclusiveEntreFechas } from './dias-periodo-ausencia';

/**
 * Día de la semana UTC: 0=domingo … 6=sábado.
 * Jornada habitual asumida Lun→… según diasLaboralesHabituales
 * (5 = Lun–Vie, 6 = Lun–Sáb, 7 = toda la semana).
 */
export const esDiaDeJornadaHabitual = (
  fechaIso: string,
  diasLaboralesHabituales: number,
): boolean => {
  if (!esFechaCalendario(fechaIso)) {
    return false;
  }
  const [y, m, d] = fechaIso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sun
  const dias = Math.min(7, Math.max(1, Math.floor(diasLaboralesHabituales)));
  if (dias >= 7) {
    return true;
  }
  // Lun=1 … Vie=5, Sáb=6
  if (dias === 6) {
    return dow !== 0;
  }
  if (dias === 5) {
    return dow >= 1 && dow <= 5;
  }
  // 1–4: lunes hasta N
  const ordenLunesPrimero = dow === 0 ? 7 : dow; // Lun=1 … Dom=7
  return ordenLunesPrimero >= 1 && ordenLunesPrimero <= dias;
};

const cadaFechaInclusive = (inicio: string, fin: string): string[] => {
  if (compararFechasIso(inicio, fin) > 0) {
    return [];
  }
  const out: string[] = [];
  let cur = inicio;
  while (compararFechasIso(cur, fin) <= 0) {
    out.push(cur);
    const [y, m, d] = cur.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    cur = next.toISOString().slice(0, 10);
  }
  return out;
};

export type ResumenDiasVacacionesPorJornada = {
  diasCalendario: number;
  diasJornada: number;
  feriadosEnJornada: number;
  /** Días que descuentan saldo: días de jornada − feriados que caen en jornada. */
  diasNetos: number;
};

/**
 * Descuento de disfrute según jornada habitual (no equivalencia universal).
 * Si no hay diasLaboralesHabituales, cae a calendario − feriados.
 */
export const resumenDiasVacacionesPorJornada = (
  fechaInicio: string,
  fechaFin: string,
  diasLaboralesHabituales: number | null | undefined,
): ResumenDiasVacacionesPorJornada => {
  const diasCalendario = diasInclusiveEntreFechas(fechaInicio, fechaFin);
  if (diasCalendario < 1) {
    return {
      diasCalendario: 0,
      diasJornada: 0,
      feriadosEnJornada: 0,
      diasNetos: 0,
    };
  }

  if (
    typeof diasLaboralesHabituales !== 'number' ||
    !Number.isInteger(diasLaboralesHabituales) ||
    diasLaboralesHabituales < 1
  ) {
    let feriados = 0;
    for (const f of cadaFechaInclusive(fechaInicio, fechaFin)) {
      if (esFeriadoCostaRica(f)) {
        feriados += 1;
      }
    }
    return {
      diasCalendario,
      diasJornada: diasCalendario,
      feriadosEnJornada: feriados,
      diasNetos: Math.max(0, diasCalendario - feriados),
    };
  }

  let diasJornada = 0;
  let feriadosEnJornada = 0;
  for (const f of cadaFechaInclusive(fechaInicio, fechaFin)) {
    if (!esDiaDeJornadaHabitual(f, diasLaboralesHabituales)) {
      continue;
    }
    diasJornada += 1;
    if (esFeriadoCostaRica(f)) {
      feriadosEnJornada += 1;
    }
  }
  return {
    diasCalendario,
    diasJornada,
    feriadosEnJornada,
    diasNetos: Math.max(0, diasJornada - feriadosEnJornada),
  };
};

export const diasVacacionesNetosPorJornada = (
  fechaInicio: string,
  fechaFin: string,
  diasLaboralesHabituales: number | null | undefined,
): number =>
  resumenDiasVacacionesPorJornada(
    fechaInicio,
    fechaFin,
    diasLaboralesHabituales,
  ).diasNetos;
