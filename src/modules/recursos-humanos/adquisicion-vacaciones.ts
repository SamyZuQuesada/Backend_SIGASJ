import { fechaCalendarioEnAsada } from '../../common/time/reloj-asada';
import { calcularAntiguedad } from './antiguedad-laboral';
import { aFechaIso, esFechaCalendario } from './fecha-permiso';

/** Semanas de labores continuas computables por periodo (CT CR art. 153). */
export const SEMANAS_POR_PERIODO_VACACIONES = 50;

/** Plazo de otorgamiento tras adquirir el periodo (CT CR art. 156 ≈ 15 semanas). */
export const SEMANAS_PLAZO_OTORGAMIENTO = 15;

/** Fallback de días por periodo si no hay días laborales habituales (2 semanas × 6). */
export const DIAS_POR_PERIODO_FALLBACK = 12;

export type PeriodoAdquisicionVacaciones = {
  /** Identificador estable del periodo dentro del colaborador, p. ej. P1. */
  periodoId: string;
  indice: number;
  fechaInicioPeriodo: string;
  fechaAdquisicion: string;
  cantidadDias: number;
};

export type AlertaVacaciones = {
  tipo: 'PERIODO_PENDIENTE_DISFRUTE' | 'PLAZO_LEGAL_OTORGAMIENTO';
  mensaje: string;
  periodoId: string;
  fechaAdquisicion: string;
  venceEl: string;
};

const addDaysIso = (fechaIso: string, days: number): string => {
  const [y, m, d] = fechaIso.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return aFechaIso(utc.toISOString().slice(0, 10));
};

/**
 * Días de derecho por periodo: 2 semanas de la jornada habitual.
 * Sin dato → 12 (2 × 6). No usa equivalencia universal fija distinta de la jornada.
 */
export const diasPorPeriodoVacaciones = (
  diasLaboralesHabituales: number | null | undefined,
): number => {
  if (
    typeof diasLaboralesHabituales === 'number' &&
    Number.isInteger(diasLaboralesHabituales) &&
    diasLaboralesHabituales >= 1 &&
    diasLaboralesHabituales <= 7
  ) {
    return 2 * diasLaboralesHabituales;
  }
  return DIAS_POR_PERIODO_FALLBACK;
};

export const periodoIdDesdeIndice = (indice: number): string => `P${indice}`;

/**
 * Periodos cumplidos desde fechaIngreso (bloques de 50 semanas).
 * No resta incapacidades automáticamente (criterio ASADA: sin descuento auto).
 */
export const calcularPeriodosAdquiridos = (
  fechaIngreso: string | null | undefined,
  diasLaboralesHabituales: number | null | undefined,
  ahora: Date = new Date(),
): PeriodoAdquisicionVacaciones[] => {
  if (typeof fechaIngreso !== 'string' || !fechaIngreso.trim()) {
    return [];
  }
  const ingreso = aFechaIso(fechaIngreso.trim());
  if (!esFechaCalendario(ingreso)) {
    return [];
  }

  const antiguedad = calcularAntiguedad(ingreso, ahora);
  if (!antiguedad || antiguedad.totalSemanas < SEMANAS_POR_PERIODO_VACACIONES) {
    return [];
  }

  const periodosCompletos = Math.floor(
    antiguedad.totalSemanas / SEMANAS_POR_PERIODO_VACACIONES,
  );
  const cantidadDias = diasPorPeriodoVacaciones(diasLaboralesHabituales);
  const periodos: PeriodoAdquisicionVacaciones[] = [];

  for (let indice = 1; indice <= periodosCompletos; indice += 1) {
    const offsetInicio = (indice - 1) * SEMANAS_POR_PERIODO_VACACIONES * 7;
    const offsetFin = indice * SEMANAS_POR_PERIODO_VACACIONES * 7;
    periodos.push({
      periodoId: periodoIdDesdeIndice(indice),
      indice,
      fechaInicioPeriodo: addDaysIso(ingreso, offsetInicio),
      fechaAdquisicion: addDaysIso(ingreso, offsetFin),
      cantidadDias,
    });
  }

  return periodos;
};

/**
 * Cuántos periodos se consideran ya cubiertos por ACUMULADO legacy sin periodoId,
 * para no duplicar saldo histórico (regla 15).
 */
export const periodosCubiertosPorLegacy = (
  diasAcumuladosLegacy: number,
  diasPorPeriodo: number,
): number => {
  if (diasPorPeriodo <= 0 || diasAcumuladosLegacy <= 0) {
    return 0;
  }
  return Math.floor(diasAcumuladosLegacy / diasPorPeriodo);
};

export const buildAlertasPeriodos = (
  periodosConAdquisicion: Array<{
    periodoId: string;
    fechaAdquisicion: string;
  }>,
  diasDisponibles: number,
  ahora: Date = new Date(),
): AlertaVacaciones[] => {
  if (diasDisponibles <= 0 || periodosConAdquisicion.length === 0) {
    return [];
  }

  const hoy = fechaCalendarioEnAsada(ahora);
  const alertas: AlertaVacaciones[] = [];
  for (const periodo of periodosConAdquisicion) {
    const venceEl = addDaysIso(
      periodo.fechaAdquisicion,
      SEMANAS_PLAZO_OTORGAMIENTO * 7,
    );
    alertas.push({
      tipo: 'PERIODO_PENDIENTE_DISFRUTE',
      periodoId: periodo.periodoId,
      fechaAdquisicion: periodo.fechaAdquisicion,
      venceEl,
      mensaje: `Periodo ${periodo.periodoId} adquirido el ${periodo.fechaAdquisicion}: hay saldo pendiente de disfrute.`,
    });
    if (hoy > venceEl) {
      alertas.push({
        tipo: 'PLAZO_LEGAL_OTORGAMIENTO',
        periodoId: periodo.periodoId,
        fechaAdquisicion: periodo.fechaAdquisicion,
        venceEl,
        mensaje: `Periodo ${periodo.periodoId}: se superó el plazo legal de otorgamiento (15 semanas desde ${periodo.fechaAdquisicion}, vence ${venceEl}).`,
      });
    }
  }
  return alertas;
};
