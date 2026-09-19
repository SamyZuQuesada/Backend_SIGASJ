/**
 * Día de la semana laboral (ISO-8601: lunes = 1 … domingo = 7).
 * Usado por los horarios habituales del Fontanero.
 */
export enum DiaSemana {
  LUNES = 1,
  MARTES = 2,
  MIERCOLES = 3,
  JUEVES = 4,
  VIERNES = 5,
  SABADO = 6,
  DOMINGO = 7,
}

export const DIAS_SEMANA: readonly DiaSemana[] = [
  DiaSemana.LUNES,
  DiaSemana.MARTES,
  DiaSemana.MIERCOLES,
  DiaSemana.JUEVES,
  DiaSemana.VIERNES,
  DiaSemana.SABADO,
  DiaSemana.DOMINGO,
];

export const DIA_SEMANA_LABELS: Record<DiaSemana, string> = {
  [DiaSemana.LUNES]: 'Lunes',
  [DiaSemana.MARTES]: 'Martes',
  [DiaSemana.MIERCOLES]: 'Miércoles',
  [DiaSemana.JUEVES]: 'Jueves',
  [DiaSemana.VIERNES]: 'Viernes',
  [DiaSemana.SABADO]: 'Sábado',
  [DiaSemana.DOMINGO]: 'Domingo',
};

export function isDiaSemanaValido(valor: unknown): valor is DiaSemana {
  return (
    typeof valor === 'number' &&
    Number.isInteger(valor) &&
    valor >= DiaSemana.LUNES &&
    valor <= DiaSemana.DOMINGO
  );
}

/** Convierte `Date.getDay()` (0 = domingo) al valor ISO de `DiaSemana`. */
export function diaSemanaDesdeFecha(fecha: Date): DiaSemana {
  const jsDay = fecha.getDay();
  return (jsDay === 0 ? DiaSemana.DOMINGO : jsDay) as DiaSemana;
}
