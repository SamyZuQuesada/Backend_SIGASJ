/**
 * Discriminante persona física / jurídica para
 * «Constancia de Infraestructura Frente a Linderos de un Inmueble».
 *
 * Etiquetas en español alineadas al lenguaje de formularios ASADA.
 * Ampliar solo con fuente PDF/oficial.
 */
export enum TipoPersonaInfraestructuraLinderos {
  FISICA = 'Persona física',
  JURIDICA = 'Persona jurídica',
}

export const TIPOS_PERSONA_INFRAESTRUCTURA_LINDEROS: readonly TipoPersonaInfraestructuraLinderos[] =
  Object.values(TipoPersonaInfraestructuraLinderos);

export function isTipoPersonaInfraestructuraLinderosValido(
  valor: string,
): boolean {
  if (!valor || typeof valor !== 'string') {
    return false;
  }
  const normalizado = valor.trim().toLowerCase();
  return TIPOS_PERSONA_INFRAESTRUCTURA_LINDEROS.some(
    (opcion) => opcion.toLowerCase() === normalizado,
  );
}
