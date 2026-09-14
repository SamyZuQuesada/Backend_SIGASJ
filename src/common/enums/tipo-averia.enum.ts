/**
 * Clasificación administrativa. Se persiste en `tipoAveria` (PBI 2.1).
 */
export enum TipoAveria {
  FUGA = 'FUGA',
  TUBERIA_DANADA = 'TUBERIA_DANADA',
  MEDIDOR = 'MEDIDOR',
  FALTA_DE_AGUA = 'FALTA_DE_AGUA',
  CONEXION = 'CONEXION',
  INFRAESTRUCTURA = 'INFRAESTRUCTURA',
  OTRO = 'OTRO',
}

export function isTipoAveriaValido(tipo: string): boolean {
  return Object.values(TipoAveria).includes(tipo as TipoAveria);
}
