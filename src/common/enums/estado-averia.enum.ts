/**
 * Estado persistido de una avería.
 * Valor inicial al registrar (PBI 2.1): RECIBIDA.
 * Equivale a “REPORTADA” del flujo funcional; no se renombra para no romper 2.1/2.2.
 * Transiciones administrativas: PBI 2.3 (`averias.estado-transiciones.ts`).
 * ASIGNADA se usa al asignar Fontanero (PBI 2.4).
 */
export enum EstadoAveria {
  RECIBIDA = 'RECIBIDA',
  EN_REVISION = 'EN_REVISION',
  ASIGNADA = 'ASIGNADA',
  EN_ATENCION = 'EN_ATENCION',
  PENDIENTE = 'PENDIENTE',
  RESUELTA = 'RESUELTA',
  CANCELADA = 'CANCELADA',
}

export const ESTADO_AVERIA_LABELS: Record<EstadoAveria, string> = {
  [EstadoAveria.RECIBIDA]: 'Recibida',
  [EstadoAveria.EN_REVISION]: 'En revisión',
  [EstadoAveria.ASIGNADA]: 'Asignada',
  [EstadoAveria.EN_ATENCION]: 'En atención',
  [EstadoAveria.PENDIENTE]: 'Pendiente',
  [EstadoAveria.RESUELTA]: 'Resuelta',
  [EstadoAveria.CANCELADA]: 'Cancelada',
};

export function isEstadoAveriaValido(estado: string): boolean {
  return Object.values(EstadoAveria).includes(estado as EstadoAveria);
}
