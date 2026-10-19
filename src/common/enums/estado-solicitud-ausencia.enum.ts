/**
 * Estados de una solicitud de permiso/vacaciones del Fontanero (épica 6.5).
 * Distinto de SolicitudEstado (servicios) y EstadoSolicitudMaterial (inventario).
 */
export enum EstadoSolicitudAusencia {
  PENDIENTE = 'PENDIENTE',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
}

export const ESTADOS_SOLICITUD_AUSENCIA: readonly EstadoSolicitudAusencia[] =
  Object.values(EstadoSolicitudAusencia);

export const ESTADO_SOLICITUD_AUSENCIA_LABELS: Record<
  EstadoSolicitudAusencia,
  string
> = {
  [EstadoSolicitudAusencia.PENDIENTE]: 'Pendiente',
  [EstadoSolicitudAusencia.APROBADA]: 'Aprobada',
  [EstadoSolicitudAusencia.RECHAZADA]: 'Rechazada',
};

export function isEstadoSolicitudAusenciaValido(estado: string): boolean {
  return Object.values(EstadoSolicitudAusencia).includes(
    estado as EstadoSolicitudAusencia,
  );
}
