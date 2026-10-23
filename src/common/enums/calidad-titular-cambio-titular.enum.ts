/**
 * Calidad con la que se presenta el trámite de Cambio de Titular.
 * Derivadas del texto de requisitos del Frontend SIGASJ
 * (`documentRequirementsConfig` → cambio-titular: propietario, poseedor o representante legal).
 */
export enum CalidadTitularCambioTitular {
  PROPIETARIO = 'Propietario',
  POSEEDOR = 'Poseedor',
  REPRESENTANTE_LEGAL = 'Representante legal',
}

export const CALIDADES_TITULAR_CAMBIO_TITULAR: readonly CalidadTitularCambioTitular[] =
  Object.values(CalidadTitularCambioTitular);

export function isCalidadTitularCambioTitularValida(valor: string): boolean {
  if (!valor || typeof valor !== 'string') {
    return false;
  }
  const normalizado = valor.trim().toLowerCase();
  return CALIDADES_TITULAR_CAMBIO_TITULAR.some(
    (opcion) => opcion.toLowerCase() === normalizado,
  );
}
