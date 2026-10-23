/**
 * Medios de notificación admitidos en Cambio de Titular.
 *
 * El modelo 4.5.1 no definió catálogo formal (varchar libre).
 * Estas opciones se alinean con el lenguaje de notificaciones usado
 * en requisitos de otros trámites oficiales SIGASJ (correo, teléfono, dirección).
 * Ampliar solo con fuente ASADA/PDF oficial.
 */
export enum MedioNotificacionCambioTitular {
  CORREO = 'Correo electrónico',
  TELEFONO = 'Teléfono',
  DIRECCION = 'Dirección',
}

export const MEDIOS_NOTIFICACION_CAMBIO_TITULAR: readonly MedioNotificacionCambioTitular[] =
  Object.values(MedioNotificacionCambioTitular);

export function isMedioNotificacionCambioTitularValido(valor: string): boolean {
  if (!valor || typeof valor !== 'string') {
    return false;
  }
  const normalizado = valor.trim().toLowerCase();
  return MEDIOS_NOTIFICACION_CAMBIO_TITULAR.some(
    (opcion) => opcion.toLowerCase() === normalizado,
  );
}
