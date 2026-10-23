/**
 * Tipos de adjunto ciudadano para solicitudes digitales públicas.
 * Alineados a `documentRequirementsConfig` (Frontend) para
 * Constancia de Infraestructura Frente a Linderos.
 */
export enum TipoDocumentoSolicitud {
  IDENTIFICACION = 'identificacion',
  PLANO_CATASTRADO = 'plano-catastrado',
  PODER = 'poder',
  PLANO_AGRIMENSURA = 'plano-agrimensura',
}

export const TIPOS_DOCUMENTO_SOLICITUD = Object.values(
  TipoDocumentoSolicitud,
) as TipoDocumentoSolicitud[];

export function isTipoDocumentoSolicitud(
  valor: string,
): valor is TipoDocumentoSolicitud {
  return TIPOS_DOCUMENTO_SOLICITUD.includes(valor as TipoDocumentoSolicitud);
}

/** Adjuntos binarios siempre exigidos en infraestructura/linderos. */
export const DOCUMENTOS_INFRA_OBLIGATORIOS: readonly TipoDocumentoSolicitud[] =
  [
    TipoDocumentoSolicitud.IDENTIFICACION,
    TipoDocumentoSolicitud.PLANO_CATASTRADO,
  ];

/** Extra obligatorio cuando el propósito es «Reunión de fincas». */
export const DOCUMENTOS_INFRA_REUNION_FINCAS: readonly TipoDocumentoSolicitud[] =
  [TipoDocumentoSolicitud.PLANO_AGRIMENSURA];

/**
 * Adjuntos siempre exigidos en Disponibilidad de Servicios
 * (documentRequirementsConfig → identificación required).
 */
export const DOCUMENTOS_DISPONIBILIDAD_OBLIGATORIOS: readonly TipoDocumentoSolicitud[] =
  [TipoDocumentoSolicitud.IDENTIFICACION];

/**
 * Extra cuando la calidad es Representante legal
 * (FE: poder/autorización si gestiona persona distinta al propietario).
 */
export const DOCUMENTOS_DISPONIBILIDAD_REPRESENTANTE: readonly TipoDocumentoSolicitud[] =
  [TipoDocumentoSolicitud.PODER];

/**
 * Extra especial estación de combustible (FE: plano catastrado + poder).
 * Tipos binarios disponibles en el enum actual.
 */
export const DOCUMENTOS_DISPONIBILIDAD_ESTACION_COMBUSTIBLE: readonly TipoDocumentoSolicitud[] =
  [TipoDocumentoSolicitud.PLANO_CATASTRADO, TipoDocumentoSolicitud.PODER];
