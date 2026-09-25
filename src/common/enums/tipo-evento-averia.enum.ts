/**
 * Eventos automáticos del ciclo de vida de una avería.
 * No son editables por el usuario ni sustituyen el estado actual.
 */
export enum TipoEventoAveria {
  REGISTRO = 'REGISTRO',
  CODIGO_SEGUIMIENTO = 'CODIGO_SEGUIMIENTO',
  ASIGNACION_FONTANERO = 'ASIGNACION_FONTANERO',
  CAMBIO_ESTADO = 'CAMBIO_ESTADO',
  INICIO_ATENCION = 'INICIO_ATENCION',
  CAMBIO_PRIORIDAD = 'CAMBIO_PRIORIDAD',
  CLASIFICACION_TIPO = 'CLASIFICACION_TIPO',
  OBSERVACION = 'OBSERVACION',
  SOLICITUD_MATERIAL = 'SOLICITUD_MATERIAL',
  SALIDA_MATERIAL = 'SALIDA_MATERIAL',
  RESOLUCION = 'RESOLUCION',
  NOTIFICACION = 'NOTIFICACION',
}

export function isTipoEventoAveriaValido(
  tipo: string,
): tipo is TipoEventoAveria {
  return Object.values(TipoEventoAveria).includes(tipo as TipoEventoAveria);
}
