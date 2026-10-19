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
    throw new Error(
      'No se pudo resolver la fecha laboral en America/Costa_Rica.',
    );
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

/** Costa Rica está en UTC-6 todo el año (no usa horario de verano). */
const DESFASE_ASADA_HORAS = 6;
const UN_DIA_MS = 24 * 60 * 60 * 1000;
const FECHA_CALENDARIO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Día calendario (YYYY-MM-DD) que corre en Costa Rica en ese instante. */
export function fechaCalendarioEnAsada(fecha: Date): string {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: ZONA_HORARIA_SIGASJ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(fecha)
      .map((part) => [part.type, part.value]),
  );
  return `${partes.year}-${partes.month}-${partes.day}`;
}

/** Año calendario en Costa Rica (no el del huso del servidor). */
export function anioEnAsada(fecha: Date): number {
  return Number(fechaCalendarioEnAsada(fecha).slice(0, 4));
}

/**
 * Instante UTC en que empieza el día calendario `YYYY-MM-DD` en Costa Rica
 * (medianoche de allá = 06:00 UTC). Lanza si el texto no es una fecha.
 */
export function inicioDiaEnAsada(fechaIso: string): Date {
  const match = FECHA_CALENDARIO.exec(fechaIso);
  if (!match) {
    throw new Error(`Fecha calendario inválida: ${fechaIso}`);
  }
  const anio = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  const control = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    control.getUTCFullYear() !== anio ||
    control.getUTCMonth() !== mes - 1 ||
    control.getUTCDate() !== dia
  ) {
    // Por ejemplo 2026-02-30: no debe saltar al mes siguiente en silencio.
    throw new Error(`Fecha calendario inválida: ${fechaIso}`);
  }
  return new Date(Date.UTC(anio, mes - 1, dia, DESFASE_ASADA_HORAS));
}

/** Inicio del día siguiente en Costa Rica: límite superior exclusivo de un día. */
export function inicioDiaSiguienteEnAsada(fechaIso: string): Date {
  return new Date(inicioDiaEnAsada(fechaIso).getTime() + UN_DIA_MS);
}

/** Último milisegundo del día calendario en Costa Rica. */
export function finDiaEnAsada(fechaIso: string): Date {
  return new Date(inicioDiaSiguienteEnAsada(fechaIso).getTime() - 1);
}
