/** Origen administrativo de una incapacidad (sin datos médicos). */
export enum OrigenIncapacidad {
  CCSS = 'CCSS',
  INS = 'INS',
  OTRO = 'OTRO',
}

export const ORIGENES_INCAPACIDAD: readonly OrigenIncapacidad[] =
  Object.values(OrigenIncapacidad);
