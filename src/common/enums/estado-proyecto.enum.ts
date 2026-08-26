export enum EstadoProyecto {
  PENDIENTE = 'PENDIENTE',
  EN_PROCESO = 'EN_PROCESO',
  COMPLETADO = 'COMPLETADO',
}

export const ESTADO_PROYECTO_LABELS: Record<EstadoProyecto, string> = {
  [EstadoProyecto.PENDIENTE]: 'Pendiente',
  [EstadoProyecto.EN_PROCESO]: 'En proceso',
  [EstadoProyecto.COMPLETADO]: 'Completado',
};

export function isEstadoProyectoValido(estado: string): boolean {
  return Object.values(EstadoProyecto).includes(estado as EstadoProyecto);
}

