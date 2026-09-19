const HORA_LABORAL_PATTERN =
  /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

export const MENSAJE_HORA_FORMATO_INVALIDO =
  'La hora debe tener el formato HH:mm o HH:mm:ss (00:00 a 23:59).';

export const MENSAJE_HORA_INICIO_NO_ANTERIOR =
  'La hora de inicio debe ser anterior a la hora de finalización.';

/**
 * Normaliza hora de SQL Server (`time`), Date del driver o string HH:mm[:ss].
 * Devuelve `HH:mm:ss` o `null` si el valor no es una hora válida.
 */
export function normalizarHoraLaboral(valor: unknown): string | null {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return formatearHora(
      valor.getHours(),
      valor.getMinutes(),
      valor.getSeconds(),
    );
  }

  if (typeof valor !== 'string') {
    return null;
  }

  const recorte = valor.trim();
  const match = HORA_LABORAL_PATTERN.exec(recorte);
  if (!match) {
    return null;
  }

  return formatearHora(
    Number(match[1]),
    Number(match[2]),
    match[3] === undefined ? 0 : Number(match[3]),
  );
}

export function horaLaboralASegundos(hora: string): number | null {
  const normalizada = normalizarHoraLaboral(hora);
  if (!normalizada) {
    return null;
  }
  const [horas, minutos, segundos] = normalizada.split(':').map(Number);
  return horas * 3600 + minutos * 60 + segundos;
}

export function esHoraInicioAnteriorAFin(
  horaInicio: unknown,
  horaFin: unknown,
): boolean {
  const inicio = horaLaboralASegundos(
    typeof horaInicio === 'string' ? horaInicio : String(horaInicio ?? ''),
  );
  const fin = horaLaboralASegundos(
    typeof horaFin === 'string' ? horaFin : String(horaFin ?? ''),
  );
  if (inicio === null || fin === null) {
    return false;
  }
  return inicio < fin;
}

export function segundosDesdeMedianoche(fecha: Date): number {
  return (
    fecha.getHours() * 3600 + fecha.getMinutes() * 60 + fecha.getSeconds()
  );
}

function formatearHora(horas: number, minutos: number, segundos: number): string {
  return `${pad(horas)}:${pad(minutos)}:${pad(segundos)}`;
}

function pad(valor: number): string {
  return String(valor).padStart(2, '0');
}
