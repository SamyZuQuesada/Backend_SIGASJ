/**
 * Estados del proceso de reposición y compra de materiales.
 * Las reglas de transición están en estado-reposicion-material.transitions.ts.
 */
export enum EstadoReposicionMaterial {
  PENDIENTE = 'PENDIENTE',
  EN_GESTION = 'EN_GESTION',
  COMPRA_REGISTRADA = 'COMPRA_REGISTRADA',
  PENDIENTE_RECEPCION = 'PENDIENTE_RECEPCION',
  RECIBIDA = 'RECIBIDA',
  COMPLETADA = 'COMPLETADA',
}

export const ESTADO_REPOSICION_MATERIAL_LABELS: Record<
  EstadoReposicionMaterial,
  string
> = {
  [EstadoReposicionMaterial.PENDIENTE]: 'Pendiente',
  [EstadoReposicionMaterial.EN_GESTION]: 'En gestión',
  [EstadoReposicionMaterial.COMPRA_REGISTRADA]: 'Compra registrada',
  [EstadoReposicionMaterial.PENDIENTE_RECEPCION]: 'Pendiente de recepción',
  [EstadoReposicionMaterial.RECIBIDA]: 'Recibida',
  [EstadoReposicionMaterial.COMPLETADA]: 'Completada',
};

export function isEstadoReposicionMaterialValido(estado: string): boolean {
  return Object.values(EstadoReposicionMaterial).includes(
    estado as EstadoReposicionMaterial,
  );
}
