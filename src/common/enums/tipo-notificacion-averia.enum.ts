/**
 * Tipos de notificación interna (campana).
 * Incluye averías (PBI 2.8) y solicitudes de ausencia RRHH.
 * Distintos de los eventos SMS.
 */
export enum TipoNotificacionAveria {
  AVERIA_REGISTRADA_ADMINISTRADORA = 'AVERIA_REGISTRADA_ADMINISTRADORA',
  AVERIA_ASIGNADA_FONTANERO = 'AVERIA_ASIGNADA_FONTANERO',
  AVERIA_CLASIFICADA_ADMINISTRADORA = 'AVERIA_CLASIFICADA_ADMINISTRADORA',
  SOLICITUD_AUSENCIA_PENDIENTE_ADMINISTRADORA = 'SOLICITUD_AUSENCIA_PENDIENTE_ADMINISTRADORA',
}

export function isTipoNotificacionAveriaValido(
  tipo: string,
): tipo is TipoNotificacionAveria {
  return Object.values(TipoNotificacionAveria).includes(
    tipo as TipoNotificacionAveria,
  );
}
