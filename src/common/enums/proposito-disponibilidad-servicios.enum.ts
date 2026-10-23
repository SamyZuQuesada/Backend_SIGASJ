/**
 * Propósitos CONFIRMADOS en el repositorio para
 * «Constancia de Disponibilidad de Servicios».
 *
 * Fuente: Frontend `documentRequirementsConfig` → disponibilidad-servicios
 * (menciones de fraccionamiento, urbanización, propiedades en derechos,
 * estaciones de combustible).
 *
 * LISTA OFICIAL COMPLETA (PDF ASADA): BLOCKED — no inventar valores
 * adicionales. El campo en BD es varchar; este enum acota lo validable
 * hoy en Backend.
 */
export enum PropositoDisponibilidadServiciosConfirmado {
  FRACCIONAMIENTO = 'Fraccionamiento',
  URBANIZACION = 'Urbanización',
  PROPIEDADES_EN_DERECHOS = 'Propiedades en derechos',
  ESTACION_COMBUSTIBLE = 'Estación de combustible',
}

export const PROPOSITOS_DISPONIBILIDAD_SERVICIOS_CONFIRMADOS: readonly PropositoDisponibilidadServiciosConfirmado[] =
  Object.values(PropositoDisponibilidadServiciosConfirmado);

/** Propósitos que, según FE, exigen plano (catastrado o agrimensura). */
export const PROPOSITOS_DISPONIBILIDAD_REQUIEREN_PLANO: readonly PropositoDisponibilidadServiciosConfirmado[] =
  [
    PropositoDisponibilidadServiciosConfirmado.FRACCIONAMIENTO,
    PropositoDisponibilidadServiciosConfirmado.URBANIZACION,
    PropositoDisponibilidadServiciosConfirmado.PROPIEDADES_EN_DERECHOS,
    PropositoDisponibilidadServiciosConfirmado.ESTACION_COMBUSTIBLE,
  ];

export function isPropositoDisponibilidadServiciosConfirmado(
  valor: string,
): boolean {
  if (!valor || typeof valor !== 'string') {
    return false;
  }
  const normalizado = valor.trim().toLowerCase();
  return PROPOSITOS_DISPONIBILIDAD_SERVICIOS_CONFIRMADOS.some(
    (opcion) => opcion.toLowerCase() === normalizado,
  );
}

export function propositoDisponibilidadRequierePlano(valor: string): boolean {
  if (!valor || typeof valor !== 'string') {
    return false;
  }
  const normalizado = valor.trim().toLowerCase();
  return PROPOSITOS_DISPONIBILIDAD_REQUIEREN_PLANO.some(
    (opcion) => opcion.toLowerCase() === normalizado,
  );
}
