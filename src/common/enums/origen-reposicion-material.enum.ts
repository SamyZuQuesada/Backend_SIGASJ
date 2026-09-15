/**
 * Origen de una reposición de materiales en el inventario de la ASADA.
 */
export enum OrigenReposicionMaterial {
  ALERTA_STOCK_MINIMO = 'ALERTA_STOCK_MINIMO',
  SOLICITUD_APROBADA = 'SOLICITUD_APROBADA',
  ADMINISTRATIVA = 'ADMINISTRATIVA',
}

export const ORIGEN_REPOSICION_MATERIAL_LABELS: Record<
  OrigenReposicionMaterial,
  string
> = {
  [OrigenReposicionMaterial.ALERTA_STOCK_MINIMO]: 'Alerta de stock mínimo',
  [OrigenReposicionMaterial.SOLICITUD_APROBADA]: 'Solicitud de materiales aprobada',
  [OrigenReposicionMaterial.ADMINISTRATIVA]: 'Necesidad administrativa',
};

export function isOrigenReposicionMaterialValido(origen: string): boolean {
  return Object.values(OrigenReposicionMaterial).includes(
    origen as OrigenReposicionMaterial,
  );
}
