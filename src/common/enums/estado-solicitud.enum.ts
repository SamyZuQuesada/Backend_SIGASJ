/**
 * Estados para el seguimiento y ciclo de vida de cualquier solicitud digital oficial en SIGASJ.
 * Permite tanto la gestión administrativa interna como la consulta de avance por parte del ciudadano (Card 8).
 */
export enum EstadoSolicitud {
  PENDIENTE = 'PENDIENTE',
  EN_REVISION = 'EN_REVISION',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
  FINALIZADA = 'FINALIZADA',
  CANCELADA = 'CANCELADA',
}

export const ESTADO_SOLICITUD_LABELS: Record<EstadoSolicitud, string> = {
  [EstadoSolicitud.PENDIENTE]: 'Pendiente',
  [EstadoSolicitud.EN_REVISION]: 'En revisión',
  [EstadoSolicitud.APROBADA]: 'Aprobada',
  [EstadoSolicitud.RECHAZADA]: 'Rechazada',
  [EstadoSolicitud.FINALIZADA]: 'Finalizada',
  [EstadoSolicitud.CANCELADA]: 'Cancelada',
};

export function isEstadoSolicitudValido(estado: string): boolean {
  return Object.values(EstadoSolicitud).includes(estado as EstadoSolicitud);
}
