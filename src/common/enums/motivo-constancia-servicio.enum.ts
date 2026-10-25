/**
 * Opciones de motivo para el trámite oficial
 * «Constancia de Servicio Existente» (slug: `servicio-existente`).
 *
 * Incluye los motivos estándar requeridos ante instituciones públicas/bancarias
 * costarricenses (Bono de vivienda, Trámite bancario, Visado municipal, etc.)
 * y la opción "Otro" para especificar una descripción libre en `otroMotivo`.
 */
export enum MotivoConstanciaServicio {
  BONO_VIVIENDA = 'Bono de vivienda',
  TRAMITE_BANCARIO = 'Trámite bancario',
  VISADO_MUNICIPAL = 'Visado municipal',
  CONEXION_ELECTRICA = 'Conexión eléctrica',
  TRAMITE_NOTARIAL = 'Trámite notarial',
  EXONERACION_BIENES_INMUEBLES = 'Exoneración de bienes inmuebles',
  OTRO = 'Otro',
}

export const MOTIVOS_CONSTANCIA_SERVICIO: readonly MotivoConstanciaServicio[] =
  Object.values(MotivoConstanciaServicio);

export function isMotivoConstanciaServicioValido(valor: string): boolean {
  if (!valor || typeof valor !== 'string') {
    return false;
  }
  const normalizado = valor.trim().toLowerCase();
  return MOTIVOS_CONSTANCIA_SERVICIO.some(
    (opcion) => opcion.toLowerCase() === normalizado,
  );
}

export function isMotivoOtro(valor: string): boolean {
  if (!valor || typeof valor !== 'string') {
    return false;
  }
  return (
    valor.trim().toLowerCase() === MotivoConstanciaServicio.OTRO.toLowerCase()
  );
}
