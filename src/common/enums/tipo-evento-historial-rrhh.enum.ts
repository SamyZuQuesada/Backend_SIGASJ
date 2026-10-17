/**
 * Origen de un evento en el historial administrativo consolidado
 * de un colaborador (permisos, vacaciones e incapacidades).
 */
export enum TipoEventoHistorialRrhh {
  PERMISO = 'PERMISO',
  VACACION = 'VACACION',
  INCAPACIDAD = 'INCAPACIDAD',
}

export const TIPOS_EVENTO_HISTORIAL_RRHH: readonly TipoEventoHistorialRrhh[] =
  Object.values(TipoEventoHistorialRrhh);
