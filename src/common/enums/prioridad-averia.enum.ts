/**
 * Prioridad administrativa de una avería.
 * Nula en el registro público (PBI 2.1). La asigna administración (PBI 2.3).
 */
export enum PrioridadAveria {
  BAJA = 'BAJA',
  MEDIA = 'MEDIA',
  ALTA = 'ALTA',
  URGENTE = 'URGENTE',
}

export function isPrioridadAveriaValida(prioridad: string): boolean {
  return Object.values(PrioridadAveria).includes(prioridad as PrioridadAveria);
}
