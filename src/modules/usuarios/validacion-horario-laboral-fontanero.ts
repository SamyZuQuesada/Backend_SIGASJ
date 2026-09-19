import { BadRequestException } from '@nestjs/common';
import { DiaSemana } from '../../common/enums/dia-semana.enum';
import {
  esHoraInicioAnteriorAFin,
  horaLaboralASegundos,
} from './horario-laboral-fontanero.validation';

export enum ResultadoHorarioLaboral {
  DENTRO_DE_HORARIO = 'DENTRO_DE_HORARIO',
  FUERA_DE_HORARIO = 'FUERA_DE_HORARIO',
  SIN_HORARIO_CONFIGURADO = 'SIN_HORARIO_CONFIGURADO',
  HORARIO_INCOMPLETO = 'HORARIO_INCOMPLETO',
  FONTANERO_INEXISTENTE = 'FONTANERO_INEXISTENTE',
  NO_ES_FONTANERO = 'NO_ES_FONTANERO',
}

export type HorarioLaboralConsultado = {
  id: number;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFin: string;
  activo: boolean;
};

export type EvaluacionHorarioLaboral = {
  resultado: ResultadoHorarioLaboral;
  /** Solo es true cuando el Fontanero está dentro de un horario activo y completo. */
  puedeIniciarAtencion: boolean;
  idFontanero: number | null;
  momento: string;
  diaSemana: DiaSemana | null;
  horario: HorarioLaboralConsultado | null;
  motivo: string;
};

export const MOTIVO_DENTRO_DE_HORARIO =
  'El Fontanero se encuentra dentro de su horario laboral.';

export const MOTIVO_FUERA_DE_HORARIO =
  'El Fontanero se encuentra fuera de su horario laboral.';

export const MOTIVO_SIN_HORARIO =
  'El Fontanero no tiene un horario laboral activo para este día.';

export const MOTIVO_HORARIO_INCOMPLETO =
  'El horario laboral del Fontanero está incompleto o es inválido.';

export const MOTIVO_FONTANERO_INEXISTENTE =
  'No se encontró el Fontanero indicado.';

export const MOTIVO_NO_ES_FONTANERO =
  'El usuario indicado no tiene rol Fontanero.';

export const MENSAJE_NO_PUEDE_INICIAR_ATENCION =
  'No se puede iniciar la atención: el Fontanero no está dentro de horario laboral.';

export function compararInstanteConHorario(
  horaInicio: unknown,
  horaFin: unknown,
  instanteSegundos: number,
): 'dentro' | 'fuera' | 'incompleto' {
  const inicio = horaLaboralASegundos(
    typeof horaInicio === 'string' ? horaInicio : String(horaInicio ?? ''),
  );
  const fin = horaLaboralASegundos(
    typeof horaFin === 'string' ? horaFin : String(horaFin ?? ''),
  );
  if (
    inicio === null ||
    fin === null ||
    !esHoraInicioAnteriorAFin(horaInicio, horaFin)
  ) {
    return 'incompleto';
  }
  return instanteSegundos >= inicio && instanteSegundos < fin
    ? 'dentro'
    : 'fuera';
}

export function puedeIniciarAtencion(
  evaluacion: EvaluacionHorarioLaboral,
): boolean {
  return evaluacion.puedeIniciarAtencion;
}

/** Para asignación o inicio de atención. No asume horario si falta. */
export function assertPuedeIniciarAtencionPorHorario(
  evaluacion: EvaluacionHorarioLaboral,
): void {
  if (evaluacion.puedeIniciarAtencion) {
    return;
  }
  throw new BadRequestException(
    evaluacion.motivo || MENSAJE_NO_PUEDE_INICIAR_ATENCION,
  );
}
