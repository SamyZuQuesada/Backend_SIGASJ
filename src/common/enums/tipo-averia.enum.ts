/**
 * Clasificación administrativa. Se persiste en `tipoAveria` (PBI 2.1).
 */
export enum TipoAveria {
  TUBO_MADRE = 'TUBO_MADRE',
  TUBO_MEDIDOR = 'TUBO_MEDIDOR',
  FUGA = 'FUGA',
  TUBERIA_DANADA = 'TUBERIA_DANADA',
  MEDIDOR = 'MEDIDOR',
  FALTA_DE_AGUA = 'FALTA_DE_AGUA',
  CONEXION = 'CONEXION',
  INFRAESTRUCTURA = 'INFRAESTRUCTURA',
  OTRO = 'OTRO',
}

/** Valores que califica el Fontanero según el diagrama (Tubo madre / Tubo medidor). */
export const TIPOS_AVERIA_FONTANERO = [
  TipoAveria.TUBO_MADRE,
  TipoAveria.TUBO_MEDIDOR,
] as const;

export function isTipoAveriaValido(tipo: string): boolean {
  return Object.values(TipoAveria).includes(tipo as TipoAveria);
}
