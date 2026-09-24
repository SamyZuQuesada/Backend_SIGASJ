/**
 * Tipos de notificación interna de averías (PBI 2.8).
 * Distintos de los eventos SMS.
 */
export enum TipoNotificacionAveria {
  AVERIA_REGISTRADA_ADMINISTRADORA = 'AVERIA_REGISTRADA_ADMINISTRADORA',
  AVERIA_ASIGNADA_FONTANERO = 'AVERIA_ASIGNADA_FONTANERO',
}

export function isTipoNotificacionAveriaValido(
  tipo: string,
): tipo is TipoNotificacionAveria {
  return Object.values(TipoNotificacionAveria).includes(
    tipo as TipoNotificacionAveria,
  );
}
