import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import {
  ResultadoHorarioLaboral,
  type EvaluacionHorarioLaboral,
} from '../usuarios/validacion-horario-laboral-fontanero';

export const EVENTO_SMS_FONTANERO_FUERA_DE_HORARIO =
  'SMS_FONTANERO_FUERA_DE_HORARIO';

export type EventoNotificacionHorarioAsignacion = {
  tipo: typeof EVENTO_SMS_FONTANERO_FUERA_DE_HORARIO;
  destinatario: 'reportante';
  idAveria: number;
  codigoSeguimiento: string;
  telefonoReportante: string;
  idFontanero: number;
  resultadoHorario: ResultadoHorarioLaboral;
  motivo: string;
};

/**
 * Tras asignar (ASIGNADA), el horario decide si se mantiene o pasa a
 * Pendiente de atención. Fuera de horario no es un estado persistido.
 * Sin horario / incompleto no se asume jornada (regla 2.6.2).
 */
export function estadoTrasValidarHorarioAsignacion(
  evaluacion: EvaluacionHorarioLaboral,
): EstadoAveria.ASIGNADA | EstadoAveria.PENDIENTE {
  return evaluacion.puedeIniciarAtencion
    ? EstadoAveria.ASIGNADA
    : EstadoAveria.PENDIENTE;
}

export function prepararEventoNotificacionHorarioAsignacion(input: {
  idAveria: number;
  codigoSeguimiento: string;
  telefonoReportante: string;
  idFontanero: number;
  evaluacion: EvaluacionHorarioLaboral;
}): EventoNotificacionHorarioAsignacion | null {
  if (input.evaluacion.puedeIniciarAtencion) {
    return null;
  }
  return {
    tipo: EVENTO_SMS_FONTANERO_FUERA_DE_HORARIO,
    destinatario: 'reportante',
    idAveria: input.idAveria,
    codigoSeguimiento: input.codigoSeguimiento,
    telefonoReportante: input.telefonoReportante,
    idFontanero: input.idFontanero,
    resultadoHorario: input.evaluacion.resultado,
    motivo: input.evaluacion.motivo,
  };
}
