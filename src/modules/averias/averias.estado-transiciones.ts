import { BadRequestException } from '@nestjs/common';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';

/**
 * Transiciones administrativas de estado (PBI 2.3).
 * El estado inicial persistido es RECIBIDA (no REPORTADA).
 * PBI 2.4 reutiliza EN_REVISION | PENDIENTE → ASIGNADA; no duplicar este grafo.
 */
export const TRANSICIONES_ESTADO_AVERIA: Record<
  EstadoAveria,
  readonly EstadoAveria[]
> = {
  [EstadoAveria.RECIBIDA]: [EstadoAveria.EN_REVISION],
  [EstadoAveria.EN_REVISION]: [
    EstadoAveria.ASIGNADA,
    EstadoAveria.PENDIENTE,
    EstadoAveria.CANCELADA,
  ],
  [EstadoAveria.ASIGNADA]: [
    EstadoAveria.EN_ATENCION,
    EstadoAveria.PENDIENTE,
    EstadoAveria.CANCELADA,
  ],
  [EstadoAveria.EN_ATENCION]: [EstadoAveria.RESUELTA, EstadoAveria.PENDIENTE],
  [EstadoAveria.PENDIENTE]: [
    EstadoAveria.EN_REVISION,
    EstadoAveria.ASIGNADA,
    EstadoAveria.EN_ATENCION,
    EstadoAveria.CANCELADA,
  ],
  [EstadoAveria.RESUELTA]: [],
  [EstadoAveria.CANCELADA]: [],
};

export const ESTADOS_FINALES_AVERIA: readonly EstadoAveria[] = [
  EstadoAveria.RESUELTA,
  EstadoAveria.CANCELADA,
];

export function mensajeTransicionEstadoAveriaInvalida(
  desde: EstadoAveria,
  hacia: EstadoAveria,
): string {
  return `No se puede cambiar una avería de ${desde} a ${hacia}.`;
}

export function esTransicionEstadoAveriaValida(
  desde: EstadoAveria,
  hacia: EstadoAveria,
): boolean {
  if (desde === hacia) {
    return true;
  }
  return (TRANSICIONES_ESTADO_AVERIA[desde] ?? []).includes(hacia);
}

export function assertTransicionEstadoAveria(
  desde: EstadoAveria,
  hacia: EstadoAveria,
): void {
  if (!esTransicionEstadoAveriaValida(desde, hacia)) {
    throw new BadRequestException(
      mensajeTransicionEstadoAveriaInvalida(desde, hacia),
    );
  }
}

/**
 * Invariantes de asignación (PBI 2.4) sobre el grafo 2.3.
 * ASIGNADA y EN_ATENCION exigen fontanero. RESUELTA conserva el que ya exista;
 * no se limpia la FK al cambiar de estado.
 */
export const ESTADOS_AVERIA_QUE_REQUIEREN_FONTANERO: readonly EstadoAveria[] = [
  EstadoAveria.ASIGNADA,
  EstadoAveria.EN_ATENCION,
];

export const AVERIA_ASIGNADA_SIN_FONTANERO =
  'No se puede marcar una avería como ASIGNADA sin un fontanero asignado.';

export const AVERIA_EN_ATENCION_SIN_FONTANERO =
  'No se puede marcar una avería como EN_ATENCION sin un fontanero asignado.';

export function estadoAveriaRequiereFontanero(estado: EstadoAveria): boolean {
  return ESTADOS_AVERIA_QUE_REQUIEREN_FONTANERO.includes(estado);
}

export function assertEstadoAveriaCompatibleConFontanero(
  estado: EstadoAveria,
  idFontaneroAsignado: number | null | undefined,
): void {
  if (!estadoAveriaRequiereFontanero(estado) || idFontaneroAsignado != null) {
    return;
  }

  if (estado === EstadoAveria.ASIGNADA) {
    throw new BadRequestException(AVERIA_ASIGNADA_SIN_FONTANERO);
  }

  throw new BadRequestException(AVERIA_EN_ATENCION_SIN_FONTANERO);
}
