/** Feriados oficiales de Costa Rica (fecha de calendario, sin traslado). */

const pad = (value: number) => String(value).padStart(2, '0');

const isoUtc = (year: number, month: number, day: number): string =>
  `${year}-${pad(month)}-${pad(day)}`;

/** Domingo de Pascua (algoritmo gregoriano). */
export const domingoPascua = (year: number): string => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoUtc(year, month, day);
};

const addDaysIso = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return isoUtc(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
};

export const feriadosCostaRicaDelAnio = (year: number): string[] => {
  const pascua = domingoPascua(year);
  return [
    isoUtc(year, 1, 1),
    addDaysIso(pascua, -3),
    addDaysIso(pascua, -2),
    isoUtc(year, 4, 11),
    isoUtc(year, 5, 1),
    isoUtc(year, 7, 25),
    isoUtc(year, 8, 2),
    isoUtc(year, 8, 15),
    isoUtc(year, 9, 15),
    isoUtc(year, 12, 1),
    isoUtc(year, 12, 25),
  ];
};

const cache = new Map<number, Set<string>>();

const feriadosDelAnio = (year: number): Set<string> => {
  const cached = cache.get(year);
  if (cached) return cached;
  const set = new Set(feriadosCostaRicaDelAnio(year));
  cache.set(year, set);
  return set;
};

export const esFeriadoCostaRica = (isoDate: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const year = Number(isoDate.slice(0, 4));
  return feriadosDelAnio(year).has(isoDate);
};

export const listarFeriadosEnRango = (
  fechaInicio: string,
  fechaFin: string,
): string[] => {
  if (fechaFin < fechaInicio) return [];
  const [y1, m1, d1] = fechaInicio.split('-').map(Number);
  const [y2, m2, d2] = fechaFin.split('-').map(Number);
  const start = Date.UTC(y1, m1 - 1, d1);
  const end = Date.UTC(y2, m2 - 1, d2);
  const feriados: string[] = [];
  for (let t = start; t <= end; t += 86_400_000) {
    const date = new Date(t);
    const iso = isoUtc(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
    );
    if (esFeriadoCostaRica(iso)) feriados.push(iso);
  }
  return feriados;
};

/** Días calendario inclusivos menos feriados. */
export const diasAusenciaSinFeriados = (
  fechaInicio: string,
  fechaFin: string,
): number => {
  if (fechaFin < fechaInicio) return 0;
  const [y1, m1, d1] = fechaInicio.split('-').map(Number);
  const [y2, m2, d2] = fechaFin.split('-').map(Number);
  const inclusivos =
    Math.floor(
      (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000,
    ) + 1;
  return Math.max(0, inclusivos - listarFeriadosEnRango(fechaInicio, fechaFin).length);
};
