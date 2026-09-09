export enum EstadoActividadFontanero {
  REPORTADA = 'REPORTADA',
  EN_REVISION = 'EN_REVISION',
  REQUIERE_CORRECCION = 'REQUIERE_CORRECCION',
  CORREGIDA = 'CORREGIDA',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
}

/** Estados consultables en el historial operativo del Fontanero. */
export const ESTADOS_HISTORIAL_FONTANERO = [
  EstadoActividadFontanero.APROBADA,
  EstadoActividadFontanero.RECHAZADA,
  EstadoActividadFontanero.CORREGIDA,
] as const;

export function isEstadoActividadFontaneroValido(estado: string): boolean {
  return Object.values(EstadoActividadFontanero).includes(
    estado as EstadoActividadFontanero,
  );
}
