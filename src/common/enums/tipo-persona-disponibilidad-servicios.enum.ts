/**
 * Discriminante persona física / jurídica para
 * «Constancia de Disponibilidad de Servicios»
 * (slug: `disponibilidad-servicios`).
 *
 * Etiquetas alineadas al lenguaje ASADA ya usado en
 * Infraestructura/Linderos. Ampliar solo con fuente PDF/oficial.
 */
export enum TipoPersonaDisponibilidadServicios {
  FISICA = 'Persona física',
  JURIDICA = 'Persona jurídica',
}

export const TIPOS_PERSONA_DISPONIBILIDAD_SERVICIOS: readonly TipoPersonaDisponibilidadServicios[] =
  Object.values(TipoPersonaDisponibilidadServicios);

export function isTipoPersonaDisponibilidadServiciosValido(
  valor: string,
): boolean {
  if (!valor || typeof valor !== 'string') {
    return false;
  }
  const normalizado = valor.trim().toLowerCase();
  return TIPOS_PERSONA_DISPONIBILIDAD_SERVICIOS.some(
    (opcion) => opcion.toLowerCase() === normalizado,
  );
}
