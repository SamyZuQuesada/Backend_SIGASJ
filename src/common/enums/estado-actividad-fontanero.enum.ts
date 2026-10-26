export enum EstadoActividadFontanero {
  BORRADOR = 'BORRADOR',
  REPORTADA = 'REPORTADA',
  EN_REVISION = 'EN_REVISION',
  REQUIERE_CORRECCION = 'REQUIERE_CORRECCION',
  CORREGIDA = 'CORREGIDA',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
  REVISADA = 'REVISADA',
}

/** Estados consultables en el historial (sin borradores). */
export const ESTADOS_HISTORIAL_FONTANERO = [
  EstadoActividadFontanero.REPORTADA,
  EstadoActividadFontanero.EN_REVISION,
  EstadoActividadFontanero.REQUIERE_CORRECCION,
  EstadoActividadFontanero.CORREGIDA,
  EstadoActividadFontanero.REVISADA,
  EstadoActividadFontanero.APROBADA,
  EstadoActividadFontanero.RECHAZADA,
] as const;

export function isEstadoActividadFontaneroValido(estado: string): boolean {
  return Object.values(EstadoActividadFontanero).includes(
    estado as EstadoActividadFontanero,
  );
}
