import { parseFechaActividad } from '../../common/validators/is-fecha-actividad-valida.validator';

export const esFechaCalendario = (valor: unknown): valor is string =>
  typeof valor === 'string' && parseFechaActividad(valor.trim()) !== null;

export const compararFechasIso = (inicio: string, fin: string): number =>
  inicio.localeCompare(fin);

/**
 * Normaliza DATE de SQL Server / sqljs a YYYY-MM-DD sin correr el día
 * por la zona horaria. Medianoche local (driver mssql) usa calendario local;
 * medianoche UTC (sqljs / ISO) usa UTC.
 */
export const aFechaIso = (valor: Date | string): string => {
  if (typeof valor === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(valor);
    return match ? match[1] : valor.slice(0, 10);
  }

  const esMedianocheLocal =
    valor.getHours() === 0 &&
    valor.getMinutes() === 0 &&
    valor.getSeconds() === 0;
  const year = esMedianocheLocal ? valor.getFullYear() : valor.getUTCFullYear();
  const month =
    (esMedianocheLocal ? valor.getMonth() : valor.getUTCMonth()) + 1;
  const day = esMedianocheLocal ? valor.getDate() : valor.getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

/** DATE de calendario local para que SQL Server no reste un día. */
export const aFechaLocal = (valor: Date | string): Date => {
  const iso = aFechaIso(valor);
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};
