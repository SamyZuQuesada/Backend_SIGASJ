/**
 * Tipo de ausencia que el Fontanero puede solicitar vía Jotform.
 * Distinto de incapacidad (registro administrativo aparte).
 */
export enum TipoSolicitudAusencia {
  PERMISO = 'PERMISO',
  VACACIONES = 'VACACIONES',
}

export const TIPOS_SOLICITUD_AUSENCIA: readonly TipoSolicitudAusencia[] =
  Object.values(TipoSolicitudAusencia);
