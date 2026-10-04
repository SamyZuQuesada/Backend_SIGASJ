import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import { ahoraDelSistema } from '../../common/time/reloj-asada';
import type { EvaluacionHorarioLaboral } from '../usuarios/validacion-horario-laboral-fontanero';
import { Averia } from './entities/averia.entity';

export const MENSAJE_INICIO_ATENCION_FUERA_DE_HORARIO =
  'La atención no puede iniciarse en este momento porque se encuentra fuera del horario laboral establecido.';

export const ESTADOS_QUE_PERMITEN_INICIAR_ATENCION: readonly EstadoAveria[] = [
  EstadoAveria.ASIGNADA,
  EstadoAveria.PENDIENTE,
];

/**
 * El Fontanero puede iniciar la atención a cualquier hora.
 * El horario laboral se consulta, pero ya no impide el inicio.
 */
export function assertHorarioPermiteIniciarAtencion(
  _evaluacion: EvaluacionHorarioLaboral,
): void {}

/** Solo después de una transición exitosa a EN_ATENCION. */
export function registrarInicioAtencionExitoso(averia: Averia, momento = ahoraDelSistema()): void {
  averia.estado = EstadoAveria.EN_ATENCION;
  averia.fechaInicioAtencion = momento;
}
