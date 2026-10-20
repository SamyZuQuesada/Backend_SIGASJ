/**
 * Slugs identificadores de los seis trámites y formularios oficiales digitales de la ASADA.
 * Permiten el enrutamiento amigable en el portal público (ej. /solicitudes/arreglo-pago).
 */
export enum TipoSolicitudSlug {
  ARREGLO_PAGO = 'arreglo-pago',
  CAMBIO_TITULAR = 'cambio-titular',
  INFRAESTRUCTURA_LINDEROS = 'infraestructura-linderos',
  AFILIACION = 'afiliacion',
  DISPONIBILIDAD_SERVICIOS = 'disponibilidad-servicios',
  SERVICIO_EXISTENTE = 'servicio-existente',
}

export interface TipoSolicitudSeedItem {
  nombre: string;
  slug: TipoSolicitudSlug;
  descripcion: string;
}

export const TIPOS_SOLICITUD_SEED: TipoSolicitudSeedItem[] = [
  {
    nombre: 'Solicitud de Arreglo de Pago Domiciliar',
    slug: TipoSolicitudSlug.ARREGLO_PAGO,
    descripcion:
      'Formulario oficial para solicitar un convenio o arreglo de pago por saldos pendientes en los servicios de agua potable.',
  },
  {
    nombre: 'Cambio de Nombre del Titular del Servicio',
    slug: TipoSolicitudSlug.CAMBIO_TITULAR,
    descripcion:
      'Formulario oficial para gestionar el traspaso o actualización de la titularidad de un servicio de agua registrado ante la ASADA.',
  },
  {
    nombre: 'Constancia de Infraestructura Frente a Linderos de un Inmueble',
    slug: TipoSolicitudSlug.INFRAESTRUCTURA_LINDEROS,
    descripcion:
      'Formulario oficial para solicitar una constancia que certifique la presencia de red de distribución frente a los linderos de la propiedad.',
  },
  {
    nombre: 'Solicitud de Afiliación',
    slug: TipoSolicitudSlug.AFILIACION,
    descripcion:
      'Formulario oficial para solicitar la incorporación formal en calidad de asociado a la ASADA.',
  },
  {
    nombre: 'Constancia de Disponibilidad de Servicios',
    slug: TipoSolicitudSlug.DISPONIBILIDAD_SERVICIOS,
    descripcion:
      'Formulario oficial para certificar la viabilidad técnica e hídrica de abastecimiento para proyectos de construcción o nuevos desarrollos.',
  },
  {
    nombre: 'Constancia de Servicio Existente',
    slug: TipoSolicitudSlug.SERVICIO_EXISTENTE,
    descripcion:
      'Formulario oficial para solicitar la certificación de que el inmueble dispone de una conexión activa de agua potable en los registros de la ASADA.',
  },
];
