import { fechaCalendarioEnAsada } from '../../common/time/reloj-asada';
import { parseFechaActividad } from '../../common/validators/is-fecha-actividad-valida.validator';

export type AntiguedadLaboral = {
  anios: number;
  meses: number;
  dias: number;
  totalDias: number;
  totalSemanas: number;
  etiqueta: string;
};

const diasEntreUtc = (
  desde: { year: number; month: number; day: number },
  hasta: { year: number; month: number; day: number },
): number => {
  const a = Date.UTC(desde.year, desde.month - 1, desde.day);
  const b = Date.UTC(hasta.year, hasta.month - 1, hasta.day);
  return Math.floor((b - a) / 86_400_000);
};

/**
 * Antigüedad laboral a partir de la fecha de ingreso real (YYYY-MM-DD).
 * No se persiste: se calcula al leer. Sin fecha o con fecha inválida → null.
 * Si la fecha de ingreso es futura → null (no se inventa antigüedad negativa).
 */
export const calcularAntiguedad = (
  fechaIngreso: string | null | undefined,
  ahora: Date = new Date(),
): AntiguedadLaboral | null => {
  if (typeof fechaIngreso !== 'string' || !fechaIngreso.trim()) {
    return null;
  }

  const ingreso = parseFechaActividad(fechaIngreso.trim());
  if (!ingreso) {
    return null;
  }

  const hoy = parseFechaActividad(fechaCalendarioEnAsada(ahora));
  if (!hoy) {
    return null;
  }

  const totalDias = diasEntreUtc(ingreso, hoy);
  if (totalDias < 0) {
    return null;
  }

  let anios = hoy.year - ingreso.year;
  let meses = hoy.month - ingreso.month;
  let dias = hoy.day - ingreso.day;

  if (dias < 0) {
    meses -= 1;
    const mesAnterior = hoy.month === 1 ? 12 : hoy.month - 1;
    const anioMesAnterior = hoy.month === 1 ? hoy.year - 1 : hoy.year;
    const ultimoDiaMesAnterior = new Date(
      Date.UTC(anioMesAnterior, mesAnterior, 0),
    ).getUTCDate();
    dias += ultimoDiaMesAnterior;
  }

  if (meses < 0) {
    anios -= 1;
    meses += 12;
  }

  const partes: string[] = [];
  if (anios > 0) {
    partes.push(`${anios} ${anios === 1 ? 'año' : 'años'}`);
  }
  if (meses > 0) {
    partes.push(`${meses} ${meses === 1 ? 'mes' : 'meses'}`);
  }
  if (dias > 0 || partes.length === 0) {
    partes.push(`${dias} ${dias === 1 ? 'día' : 'días'}`);
  }

  return {
    anios,
    meses,
    dias,
    totalDias,
    totalSemanas: Math.floor(totalDias / 7),
    etiqueta: partes.join(', '),
  };
};
