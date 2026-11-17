/**
 * Modalidad de jornada del colaborador (expediente laboral).
 * Con diasLaboralesHabituales alimenta la adquisición (2 semanas / 50 semanas).
 */
export enum JornadaLaboral {
  COMPLETA = 'COMPLETA',
  MEDIA = 'MEDIA',
  POR_HORAS = 'POR_HORAS',
}

export const JORNADAS_LABORALES = Object.freeze(
  Object.values(JornadaLaboral),
);
