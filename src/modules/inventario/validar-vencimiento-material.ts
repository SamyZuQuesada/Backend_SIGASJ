import { BadRequestException } from '@nestjs/common';
import { fechaCalendarioEnAsada } from '../../common/time/reloj-asada';

/**
 * Un material que requiere vencimiento (químicos y similares) debe traer
 * una fecha de calendario posterior al día que corre en Costa Rica.
 * Si no lo requiere, la fecha es opcional y puede ser pasada.
 */
export function validarFechaVencimientoMaterial(
  requiereFechaVencimiento: boolean,
  fechaVencimiento: Date | string | null | undefined,
): Date | null {
  if (
    fechaVencimiento === undefined ||
    fechaVencimiento === null ||
    fechaVencimiento === ''
  ) {
    if (requiereFechaVencimiento) {
      throw new BadRequestException(
        'La fecha de vencimiento es obligatoria para este tipo de material',
      );
    }
    return null;
  }

  const fecha = aFecha(fechaVencimiento);
  if (!fecha) {
    throw new BadRequestException(
      'La fecha de vencimiento debe ser una fecha válida',
    );
  }

  if (!requiereFechaVencimiento) {
    return fecha;
  }

  const calendario = fechaCalendarioDeValor(fechaVencimiento, fecha);
  if (calendario <= fechaCalendarioEnAsada(new Date())) {
    throw new BadRequestException(
      'La fecha de vencimiento debe ser una fecha futura',
    );
  }

  return fecha;
}

function aFecha(value: Date | string): Date | null {
  const fecha = value instanceof Date ? value : new Date(value);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function fechaCalendarioDeValor(original: Date | string, fecha: Date): string {
  if (typeof original === 'string') {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(original.trim());
    if (match) return match[1];
  }

  const esMedianocheUtc =
    fecha.getUTCHours() === 0 &&
    fecha.getUTCMinutes() === 0 &&
    fecha.getUTCSeconds() === 0 &&
    fecha.getUTCMilliseconds() === 0;
  if (esMedianocheUtc) {
    const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getUTCDate()).padStart(2, '0');
    return `${fecha.getUTCFullYear()}-${mes}-${dia}`;
  }

  return fechaCalendarioEnAsada(fecha);
}
