/**
 * Propósitos CONFIRMADOS en el repositorio para
 * «Constancia de Infraestructura Frente a Linderos de un Inmueble».
 *
 * Fuente: Frontend `documentRequirementsConfig` → infraestructura-linderos
 * (plano de agrimensura condicional cuando el propósito es «Reunión de fincas»).
 *
 * INFRA-QA-002 / LISTA OFICIAL COMPLETA: BLOCKED — no hay PDF/formulario
 * oficial en el repo. No inventar un segundo propósito. El campo en BD es
 * varchar para admitir el resto del catálogo ASADA cuando se confirme.
 */
export enum PropositoInfraestructuraLinderosConfirmado {
  REUNION_FINCAS = 'Reunión de fincas',
}

export const PROPOSITOS_INFRAESTRUCTURA_LINDEROS_CONFIRMADOS: readonly PropositoInfraestructuraLinderosConfirmado[] =
  Object.values(PropositoInfraestructuraLinderosConfirmado);

export function isPropositoInfraestructuraLinderosConfirmado(
  valor: string,
): boolean {
  if (!valor || typeof valor !== 'string') {
    return false;
  }
  const normalizado = valor.trim().toLowerCase();
  return PROPOSITOS_INFRAESTRUCTURA_LINDEROS_CONFIRMADOS.some(
    (opcion) => opcion.toLowerCase() === normalizado,
  );
}
