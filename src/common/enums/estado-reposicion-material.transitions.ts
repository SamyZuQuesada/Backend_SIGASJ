import { EstadoReposicionMaterial } from './estado-reposicion-material.enum';

/**
 * Transiciones administrativas vía PATCH.
 * Registrar compra (POST) avanza EN_GESTION|PENDIENTE → PENDIENTE_RECEPCION.
 */
export const TRANSICIONES_ESTADO_REPOSICION: Record<
  EstadoReposicionMaterial,
  EstadoReposicionMaterial[]
> = {
  [EstadoReposicionMaterial.PENDIENTE]: [EstadoReposicionMaterial.EN_GESTION],
  [EstadoReposicionMaterial.EN_GESTION]: [],
  [EstadoReposicionMaterial.COMPRA_REGISTRADA]: [
    EstadoReposicionMaterial.PENDIENTE_RECEPCION,
  ],
  [EstadoReposicionMaterial.PENDIENTE_RECEPCION]: [
    EstadoReposicionMaterial.RECIBIDA,
  ],
  [EstadoReposicionMaterial.RECIBIDA]: [EstadoReposicionMaterial.COMPLETADA],
  [EstadoReposicionMaterial.COMPLETADA]: [],
};

export const MENSAJE_TRANSICIONES_ESTADO_REPOSICION =
  'Las transiciones permitidas son PENDIENTE → EN_GESTION; COMPRA_REGISTRADA → PENDIENTE_RECEPCION; ' +
  'PENDIENTE_RECEPCION → RECIBIDA; RECIBIDA → COMPLETADA. Registrar compra actualiza a PENDIENTE_RECEPCION.';

export function esTransicionEstadoReposicionValida(
  actual: EstadoReposicionMaterial,
  nuevo: EstadoReposicionMaterial,
): boolean {
  return TRANSICIONES_ESTADO_REPOSICION[actual]?.includes(nuevo) ?? false;
}

export function normalizarEstadoReposicionMaterial(
  value: unknown,
): EstadoReposicionMaterial | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_DE_/g, '_') as EstadoReposicionMaterial;

  return Object.values(EstadoReposicionMaterial).includes(normalized)
    ? normalized
    : undefined;
}
