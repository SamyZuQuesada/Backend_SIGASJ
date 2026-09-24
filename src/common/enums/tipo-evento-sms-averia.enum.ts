/**
 * Eventos SMS de averías (PBI 2.8.3 / 2.8.6 / 2.8.7).
 * No se mezclan con notificaciones internas.
 */
export enum TipoEventoSmsAveria {
  CONFIRMACION_REGISTRO = 'CONFIRMACION_REGISTRO',
  AVERIA_PENDIENTE = 'AVERIA_PENDIENTE',
  AVERIA_RESUELTA = 'AVERIA_RESUELTA',
}

export function isTipoEventoSmsAveriaValido(
  tipo: string,
): tipo is TipoEventoSmsAveria {
  return Object.values(TipoEventoSmsAveria).includes(
    tipo as TipoEventoSmsAveria,
  );
}
