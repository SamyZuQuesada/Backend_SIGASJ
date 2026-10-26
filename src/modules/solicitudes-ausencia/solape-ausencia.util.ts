export const rangosCalendarioSeSolapan = (
  inicioA: string,
  finA: string,
  inicioB: string,
  finB: string,
): boolean => inicioA <= finB && finA >= inicioB;
