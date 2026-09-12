/**
 * Estados posibles para una Solicitud de Materiales realizada por un Fontanero
 * dentro del módulo de Inventario de la ASADA.
 */
export enum EstadoSolicitudMaterial {
  /**
   * Estado inicial cuando el fontanero registra el pedido de materiales para su labor.
   */
  PENDIENTE = 'PENDIENTE',

  /**
   * Estado tras revisión administrativa donde se autoriza la entrega o despacho.
   */
  APROBADA = 'APROBADA',

  /**
   * Estado tras revisión administrativa donde no se autoriza la solicitud
   * (p. ej. falta de justificación, stock no disponible, avería no confirmada).
   */
  RECHAZADA = 'RECHAZADA',
}

export const ESTADO_SOLICITUD_MATERIAL_LABELS: Record<
  EstadoSolicitudMaterial,
  string
> = {
  [EstadoSolicitudMaterial.PENDIENTE]: 'Pendiente',
  [EstadoSolicitudMaterial.APROBADA]: 'Aprobada',
  [EstadoSolicitudMaterial.RECHAZADA]: 'Rechazada',
};

export function isEstadoSolicitudMaterialValido(estado: string): boolean {
  return Object.values(EstadoSolicitudMaterial).includes(
    estado as EstadoSolicitudMaterial,
  );
}
