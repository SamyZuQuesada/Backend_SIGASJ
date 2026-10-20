/**
 * Opciones oficiales de plazo permitidas para el trámite de Solicitud de Arreglo de Pago Domiciliar.
 * Representa las alternativas aprobadas por la Junta Directiva y la Administración de la ASADA.
 * En la interfaz de usuario ningún plazo debe aparecer seleccionado por defecto.
 */
export enum PlazoArregloPago {
  MESES_1 = '1 mes',
  MESES_2 = '2 meses',
  MESES_3 = '3 meses',
  MESES_6 = '6 meses',
  MESES_9 = '9 meses',
  MESES_12 = '12 meses',
  MESES_18 = '18 meses',
  MESES_24 = '24 meses',
}

/**
 * Lista inmutable de los plazos oficiales admitidos.
 */
export const PLAZOS_ARREGLO_PAGO_PERMITIDOS: readonly PlazoArregloPago[] = [
  PlazoArregloPago.MESES_1,
  PlazoArregloPago.MESES_2,
  PlazoArregloPago.MESES_3,
  PlazoArregloPago.MESES_6,
  PlazoArregloPago.MESES_9,
  PlazoArregloPago.MESES_12,
  PlazoArregloPago.MESES_18,
  PlazoArregloPago.MESES_24,
];

/**
 * Valida si un valor suministrado corresponde a una opción de plazo oficial permitida.
 */
export function isPlazoArregloPagoValido(plazo: string): boolean {
  if (!plazo || typeof plazo !== 'string') {
    return false;
  }
  const normalizado = plazo.trim().toLowerCase();
  return Object.values(PlazoArregloPago).some(
    (p) => p.toLowerCase() === normalizado,
  );
}
