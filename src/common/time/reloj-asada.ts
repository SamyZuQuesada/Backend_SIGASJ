/**
 * Reloj de la ASADA. La validación de horario no usa la hora del navegador.
 */
export const ZONA_HORARIA_SIGASJ = 'America/Costa_Rica';

const WEEKDAY_ISO: Record<string, 1 | 2 | 3 | 4 | 5 | 6 | 7> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export type PartesLaboralesAsada = {
  diaSemana: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  segundosDesdeMedianoche: number;
};

export function ahoraDelSistema(): Date {
  return new Date();
}

export function partesLaboralesEnAsada(fecha: Date): PartesLaboralesAsada {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONA_HORARIA_SIGASJ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(fecha).map((part) => [part.type, part.value]),
  );
  const diaSemana = WEEKDAY_ISO[parts.weekday ?? ''];
  const horas = Number(parts.hour);
  const minutos = Number(parts.minute);
  const segundos = Number(parts.second);
  if (
    diaSemana === undefined ||
    !Number.isFinite(horas) ||
    !Number.isFinite(minutos) ||
    !Number.isFinite(segundos)
  ) {
    throw new Error('No se pudo resolver la fecha laboral en America/Costa_Rica.');
  }
  return {
    diaSemana,
    segundosDesdeMedianoche: horas * 3600 + minutos * 60 + segundos,
  };
}

/** Construye un instante UTC que corresponde a esa hora civil en Costa Rica. */
export function fechaEnAsada(
  anio: number,
  mes: number,
  dia: number,
  horas: number,
  minutos = 0,
  segundos = 0,
): Date {
  const stamp = Date.UTC(anio, mes, dia, horas + 6, minutos, segundos);
  return new Date(stamp);
}
