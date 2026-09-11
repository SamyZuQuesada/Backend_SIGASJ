/**
 * Estado persistido de una avería.
 * Valor inicial al registrar: RECIBIDA.
 * Transiciones (asignación, atención, resolución) se definirán en tareas posteriores.
 */
export enum EstadoAveria {
  RECIBIDA = 'RECIBIDA',
}

export const ESTADO_AVERIA_LABELS: Record<EstadoAveria, string> = {
  [EstadoAveria.RECIBIDA]: 'Recibida',
};

export function isEstadoAveriaValido(estado: string): boolean {
  return Object.values(EstadoAveria).includes(estado as EstadoAveria);
}
