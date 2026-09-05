export enum EstadoActividadFontanero {
  REPORTADA = 'REPORTADA',
  EN_REVISION = 'EN_REVISION',
  REQUIERE_CORRECCION = 'REQUIERE_CORRECCION',
  CORREGIDA = 'CORREGIDA',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
}

export function isEstadoActividadFontaneroValido(estado: string): boolean {
  return Object.values(EstadoActividadFontanero).includes(
    estado as EstadoActividadFontanero,
  );
}
