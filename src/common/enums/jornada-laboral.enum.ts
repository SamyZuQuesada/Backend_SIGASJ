/**
 * Modalidad de jornada del colaborador (expediente laboral).
 * Configurable por colaborador; no implica aún el cálculo de 50 semanas.
 */
export enum JornadaLaboral {
  COMPLETA = 'COMPLETA',
  MEDIA = 'MEDIA',
  POR_HORAS = 'POR_HORAS',
}

export const JORNADAS_LABORALES = Object.freeze(
  Object.values(JornadaLaboral),
);
