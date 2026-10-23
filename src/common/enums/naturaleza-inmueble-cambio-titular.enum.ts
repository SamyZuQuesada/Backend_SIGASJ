/**
 * Opciones de naturaleza del inmueble para Cambio de Titular.
 * Derivadas del texto de requisitos del trámite en el Frontend SIGASJ
 * (`documentRequirementsConfig` → cambio-titular: inmueble inscrito vs sin inscribir).
 * No inventar valores adicionales sin fuente ASADA/PDF oficial.
 */
export enum NaturalezaInmuebleCambioTitular {
  INSCRITO = 'Inscrito',
  SIN_INSCRIBIR = 'Sin inscribir',
}

export const NATURALEZAS_INMUEBLE_CAMBIO_TITULAR: readonly NaturalezaInmuebleCambioTitular[] =
  Object.values(NaturalezaInmuebleCambioTitular);

export function isNaturalezaInmuebleCambioTitularValida(
  valor: string,
): boolean {
  if (!valor || typeof valor !== 'string') {
    return false;
  }
  const normalizado = valor.trim().toLowerCase();
  return NATURALEZAS_INMUEBLE_CAMBIO_TITULAR.some(
    (opcion) => opcion.toLowerCase() === normalizado,
  );
}
