import { CalidadTitularCambioTitular } from '../../../common/enums/calidad-titular-cambio-titular.enum';
import { MedioNotificacionCambioTitular } from '../../../common/enums/medio-notificacion-cambio-titular.enum';
import { NaturalezaInmuebleCambioTitular } from '../../../common/enums/naturaleza-inmueble-cambio-titular.enum';
import { TipoPersonaDisponibilidadServicios } from '../../../common/enums/tipo-persona-disponibilidad-servicios.enum';
import { SolicitudDisponibilidadServicios } from './solicitud-disponibilidad-servicios.entity';
import { Solicitud } from './solicitud.entity';

/**
 * Valores de propósito usados solo como fixtures de capacidad de almacenamiento.
 * Lista oficial completa del formulario: BLOCKED (PDF ausente).
 * Las menciones en documentRequirementsConfig (FE) no son etiquetas de UI confirmadas.
 */
const PROPOSITOS_FIXTURE_CAPACIDAD = [
  'Fraccionamiento',
  'Urbanización',
  'Propiedades en derechos',
  'Estación de combustible',
  'Terreno sin inscribir',
  'Territorio indígena',
] as const;

describe('Entidad SolicitudDisponibilidadServicios', () => {
  let detalle: SolicitudDisponibilidadServicios;

  beforeEach(() => {
    detalle = new SolicitudDisponibilidadServicios();
    detalle.solicitudId = 50;
    detalle.tipoPersona = TipoPersonaDisponibilidadServicios.FISICA;
    detalle.nombreFisica = 'María Elena';
    detalle.primerApellidoFisica = 'Rodríguez';
    detalle.segundoApellidoFisica = 'Vargas';
    detalle.identificacionFisica = '1-1234-0567';
    detalle.telefonoFisica = '8888-1234';
    detalle.medioNotificacionPrincipal = MedioNotificacionCambioTitular.CORREO;
    detalle.valorNotificacionPrincipal = 'maria@ejemplo.com';
    detalle.medioNotificacionSecundario =
      MedioNotificacionCambioTitular.TELEFONO;
    detalle.valorNotificacionSecundario = '8888-1234';
    detalle.provincia = 'San José';
    detalle.canton = 'Pérez Zeledón';
    detalle.distrito = 'San Isidro de El General';
    detalle.direccionExacta = '100 m norte de la iglesia, costado oeste';
    detalle.folioReal = '123456-000';
    detalle.planoCatastrado = 'SJ-1234567-2020';
    detalle.planoAgrimensura = 'AG-998877-2019';
    detalle.nis = 'NIS-45892';
    detalle.naturalezaInmueble = NaturalezaInmuebleCambioTitular.INSCRITO;
    detalle.calidadTitular = CalidadTitularCambioTitular.PROPIETARIO;
    detalle.proposito = 'Fraccionamiento';
    detalle.numeroDisponibilidadAnterior = 'DISP-2024-00123';
    detalle.descripcionProyecto =
      'Construcción de 4 unidades habitacionales de dos niveles';
    detalle.cantidadDormitorios = 3;
    detalle.unidadesHabitacionales = 4;
    detalle.areaConstruccion = 185.5;
    detalle.niveles = 2;
    detalle.caudalRequerido = 0.75;
    detalle.autorizacionInspeccion = true;
    detalle.firma = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...';
  });

  it('1. Debe instanciarse con relación Solicitud 1:1', () => {
    const solicitud = new Solicitud();
    solicitud.id = 50;
    solicitud.codigoSeguimiento = 'SOL-2026-DISP01';

    detalle.solicitud = solicitud;
    solicitud.detalleDisponibilidadServicios = detalle;

    expect(detalle.solicitud).toBe(solicitud);
    expect(solicitud.detalleDisponibilidadServicios).toBe(detalle);
    expect(solicitud.detalleDisponibilidadServicios?.solicitudId).toBe(50);
  });

  it('2. Debe representar titular persona física', () => {
    expect(detalle.tipoPersona).toBe(TipoPersonaDisponibilidadServicios.FISICA);
    expect(detalle.nombreFisica).toBe('María Elena');
    expect(detalle.primerApellidoFisica).toBe('Rodríguez');
    expect(detalle.segundoApellidoFisica).toBe('Vargas');
    expect(detalle.identificacionFisica).toBe('1-1234-0567');
    expect(detalle.telefonoFisica).toBe('8888-1234');
  });

  it('3. Debe representar titular persona jurídica', () => {
    detalle.tipoPersona = TipoPersonaDisponibilidadServicios.JURIDICA;
    detalle.nombreFisica = null;
    detalle.primerApellidoFisica = null;
    detalle.segundoApellidoFisica = null;
    detalle.identificacionFisica = null;
    detalle.telefonoFisica = null;
    detalle.razonSocial = 'Inversiones del Valle S.A.';
    detalle.identificacionJuridica = '3-101-123456';
    detalle.nombreRepresentante = 'Luis Alberto Mora Chaves';
    detalle.identificacionRepresentante = '1-0987-6543';
    detalle.telefonoRepresentante = '8777-4321';

    expect(detalle.tipoPersona).toBe(
      TipoPersonaDisponibilidadServicios.JURIDICA,
    );
    expect(detalle.razonSocial).toBe('Inversiones del Valle S.A.');
    expect(detalle.identificacionJuridica).toBe('3-101-123456');
    expect(detalle.nombreRepresentante).toBe('Luis Alberto Mora Chaves');
    expect(detalle.identificacionRepresentante).toBe('1-0987-6543');
    expect(detalle.telefonoRepresentante).toBe('8777-4321');
    expect(detalle.nombreFisica).toBeNull();
    expect(detalle.primerApellidoFisica).toBeNull();
  });

  it('4. Identificaciones y teléfonos se representan como texto', () => {
    detalle.identificacionFisica = '01-0234-0005';
    detalle.telefonoFisica = '0860-7584';
    detalle.identificacionJuridica = '3-101-000089';
    expect(detalle.identificacionFisica).toBe('01-0234-0005');
    expect(detalle.telefonoFisica).toBe('0860-7584');
    expect(detalle.identificacionJuridica).toBe('3-101-000089');
  });

  it('5. Debe guardar medios y destinos de notificación', () => {
    expect(detalle.medioNotificacionPrincipal).toBe('Correo electrónico');
    expect(detalle.valorNotificacionPrincipal).toBe('maria@ejemplo.com');
    expect(detalle.medioNotificacionSecundario).toBe('Teléfono');
    expect(detalle.valorNotificacionSecundario).toBe('8888-1234');
  });

  it('6. Debe guardar ubicación (provincia, cantón, distrito, dirección)', () => {
    expect(detalle.provincia).toBe('San José');
    expect(detalle.canton).toBe('Pérez Zeledón');
    expect(detalle.distrito).toBe('San Isidro de El General');
    expect(detalle.direccionExacta).toContain('iglesia');
  });

  it('7. Debe guardar folio, planos y NIS como texto nullable', () => {
    expect(detalle.folioReal).toBe('123456-000');
    expect(detalle.planoCatastrado).toBe('SJ-1234567-2020');
    expect(detalle.planoAgrimensura).toBe('AG-998877-2019');
    expect(detalle.nis).toBe('NIS-45892');

    detalle.folioReal = null;
    detalle.planoCatastrado = null;
    detalle.planoAgrimensura = null;
    detalle.nis = null;
    expect(detalle.folioReal).toBeNull();
    expect(detalle.planoCatastrado).toBeNull();
    expect(detalle.planoAgrimensura).toBeNull();
    expect(detalle.nis).toBeNull();
  });

  it('8. Debe guardar naturaleza del inmueble y calidad del titular', () => {
    expect(detalle.naturalezaInmueble).toBe('Inscrito');
    expect(detalle.calidadTitular).toBe('Propietario');
    detalle.naturalezaInmueble = NaturalezaInmuebleCambioTitular.SIN_INSCRIBIR;
    detalle.calidadTitular = CalidadTitularCambioTitular.REPRESENTANTE_LEGAL;
    expect(detalle.naturalezaInmueble).toBe('Sin inscribir');
    expect(detalle.calidadTitular).toBe('Representante legal');
  });

  it.each(PROPOSITOS_FIXTURE_CAPACIDAD)(
    '9. Debe poder representar propósito fixture "%s" (lista oficial BLOCKED)',
    (proposito) => {
      detalle.proposito = proposito;
      expect(detalle.proposito).toBe(proposito);
    },
  );

  it('10. numeroDisponibilidadAnterior admite valor o NULL', () => {
    expect(detalle.numeroDisponibilidadAnterior).toBe('DISP-2024-00123');
    detalle.numeroDisponibilidadAnterior = null;
    expect(detalle.numeroDisponibilidadAnterior).toBeNull();
  });

  it('11. Debe representar datos de proyecto y decimales', () => {
    expect(detalle.descripcionProyecto).toContain('unidades habitacionales');
    expect(detalle.cantidadDormitorios).toBe(3);
    expect(detalle.unidadesHabitacionales).toBe(4);
    expect(detalle.areaConstruccion).toBe(185.5);
    expect(detalle.niveles).toBe(2);
    expect(detalle.caudalRequerido).toBe(0.75);
  });

  it('12. Campos condicionales de proyecto aceptan NULL (no 0/"N/A")', () => {
    detalle.numeroDisponibilidadAnterior = null;
    detalle.descripcionProyecto = null;
    detalle.cantidadDormitorios = null;
    detalle.unidadesHabitacionales = null;
    detalle.areaConstruccion = null;
    detalle.niveles = null;
    detalle.caudalRequerido = null;
    detalle.nis = null;
    detalle.folioReal = null;
    detalle.planoCatastrado = null;
    detalle.planoAgrimensura = null;

    expect(detalle.numeroDisponibilidadAnterior).toBeNull();
    expect(detalle.descripcionProyecto).toBeNull();
    expect(detalle.cantidadDormitorios).toBeNull();
    expect(detalle.unidadesHabitacionales).toBeNull();
    expect(detalle.areaConstruccion).toBeNull();
    expect(detalle.niveles).toBeNull();
    expect(detalle.caudalRequerido).toBeNull();
    expect(detalle.nis).toBeNull();
  });

  it('13. Debe representar autorización de inspección (boolean)', () => {
    expect(detalle.autorizacionInspeccion).toBe(true);
    detalle.autorizacionInspeccion = false;
    expect(detalle.autorizacionInspeccion).toBe(false);
  });

  it('14. Firma admite data-URL, URL o null', () => {
    detalle.firma = null;
    expect(detalle.firma).toBeNull();

    detalle.firma = 'https://storage.asadasanjuan.cr/firmas/sol-50-disp.png';
    expect(detalle.firma).toContain('https://');

    detalle.firma = 'data:image/png;base64,abc';
    expect(detalle.firma).toContain('data:image/png');
  });

  it('15. Campos exclusivos de jurídica quedan NULL en persona física', () => {
    expect(detalle.razonSocial).toBeUndefined();
    detalle.razonSocial = null;
    detalle.identificacionJuridica = null;
    detalle.nombreRepresentante = null;
    detalle.identificacionRepresentante = null;
    detalle.telefonoRepresentante = null;
    expect(detalle.razonSocial).toBeNull();
    expect(detalle.identificacionJuridica).toBeNull();
  });
});
