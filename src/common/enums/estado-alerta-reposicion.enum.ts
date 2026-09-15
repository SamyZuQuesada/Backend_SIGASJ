/**
 * Estados de una alerta de reposición generada cuando un material
 * alcanza o queda por debajo de su stock mínimo.
 */
export enum EstadoAlertaReposicion {
  PENDIENTE = 'PENDIENTE',
  EN_GESTION = 'EN_GESTION',
  RESUELTA = 'RESUELTA',
}

export const ESTADO_ALERTA_REPOSICION_LABELS: Record<
  EstadoAlertaReposicion,
  string
> = {
  [EstadoAlertaReposicion.PENDIENTE]: 'Pendiente',
  [EstadoAlertaReposicion.EN_GESTION]: 'En gestión',
  [EstadoAlertaReposicion.RESUELTA]: 'Resuelta',
};

export function isEstadoAlertaReposicionValido(estado: string): boolean {
  return Object.values(EstadoAlertaReposicion).includes(
    estado as EstadoAlertaReposicion,
  );
}
