import { BadRequestException } from '@nestjs/common';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import { PrioridadAveria } from '../../common/enums/prioridad-averia.enum';
import { TipoAveria } from '../../common/enums/tipo-averia.enum';
import { ahoraDelSistema } from '../../common/time/reloj-asada';
import type { EvaluacionHorarioLaboral } from '../usuarios/validacion-horario-laboral-fontanero';
import { Averia } from './entities/averia.entity';

export const MENSAJE_INICIO_ATENCION_FUERA_DE_HORARIO =
  'La atención no puede iniciarse en este momento porque se encuentra fuera del horario laboral establecido.';

export const MENSAJE_INICIO_ATENCION_SIN_CALIFICACION =
  'Califique la prioridad (Baja, Media o Alta) y el tipo (Tubo madre o Tubo medidor) antes de iniciar la atención.';

const PRIORIDADES_PARA_ATENDER = new Set<string>([
  PrioridadAveria.BAJA,
  PrioridadAveria.MEDIA,
  PrioridadAveria.ALTA,
]);

const TIPOS_PARA_ATENDER = new Set<string>([
  TipoAveria.TUBO_MADRE,
  TipoAveria.TUBO_MEDIDOR,
]);

export const ESTADOS_QUE_PERMITEN_INICIAR_ATENCION: readonly EstadoAveria[] = [
  EstadoAveria.ASIGNADA,
  EstadoAveria.PENDIENTE,
];

export function averiaCalificadaParaAtencion(
  averia: Pick<Averia, 'prioridad' | 'tipoAveria'>,
): boolean {
  const prioridad = averia.prioridad?.trim().toUpperCase() ?? '';
  const tipo = averia.tipoAveria?.trim().toUpperCase() ?? '';
  return PRIORIDADES_PARA_ATENDER.has(prioridad) && TIPOS_PARA_ATENDER.has(tipo);
}

export function assertCalificacionPermiteIniciarAtencion(
  averia: Pick<Averia, 'prioridad' | 'tipoAveria'>,
): void {
  if (!averiaCalificadaParaAtencion(averia)) {
    throw new BadRequestException(MENSAJE_INICIO_ATENCION_SIN_CALIFICACION);
  }
}

/**
 * Fuera de jornada, sin horario o con horario incompleto no se inicia la reparación.
 * El aviso al reportante sale al quedar la avería pendiente de atención.
 */
export function assertHorarioPermiteIniciarAtencion(
  evaluacion: EvaluacionHorarioLaboral,
): void {
  if (evaluacion.puedeIniciarAtencion) {
    return;
  }
  throw new BadRequestException(MENSAJE_INICIO_ATENCION_FUERA_DE_HORARIO);
}

/** Solo después de una transición exitosa a EN_ATENCION. */
export function registrarInicioAtencionExitoso(averia: Averia, momento = ahoraDelSistema()): void {
  averia.estado = EstadoAveria.EN_ATENCION;
  averia.fechaInicioAtencion = momento;
}
