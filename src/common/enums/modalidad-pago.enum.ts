/**
 * Forma de pago habitual del colaborador (expediente laboral).
 * Sirve de base para contabilizar vacaciones según política ASADA (fase 2).
 */
export enum ModalidadPago {
  MENSUAL = 'MENSUAL',
  QUINCENAL = 'QUINCENAL',
  SEMANAL = 'SEMANAL',
  POR_HORA = 'POR_HORA',
}

export const MODALIDADES_PAGO = Object.freeze(Object.values(ModalidadPago));
