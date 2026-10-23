import { CalidadTitularCambioTitular } from '../../../common/enums/calidad-titular-cambio-titular.enum';
import { MedioNotificacionCambioTitular } from '../../../common/enums/medio-notificacion-cambio-titular.enum';
import { PropositoInfraestructuraLinderosConfirmado } from '../../../common/enums/proposito-infraestructura-linderos.enum';
import { TipoPersonaInfraestructuraLinderos } from '../../../common/enums/tipo-persona-infraestructura-linderos.enum';
import { SolicitudInfraestructuraLinderos } from './solicitud-infraestructura-linderos.entity';
import { Solicitud } from './solicitud.entity';

describe('Entidad SolicitudInfraestructuraLinderos', () => {
  let detalle: SolicitudInfraestructuraLinderos;

  beforeEach(() => {
    detalle = new SolicitudInfraestructuraLinderos();
    detalle.solicitudId = 30;
    detalle.nis = 'NIS-77881';
    detalle.tipoPersona = TipoPersonaInfraestructuraLinderos.FISICA;
    detalle.nombreFisica = 'María Elena';
    detalle.apellidosFisica = 'Rodríguez Vargas';
    detalle.identificacionFisica = '1-1234-0567';
    detalle.telefonoFisica = '8888-1234';
    detalle.calidadTitular = CalidadTitularCambioTitular.PROPIETARIO;
    detalle.provincia = 'San José';
    detalle.canton = 'Pérez Zeledón';
    detalle.distrito = 'San Isidro de El General';
    detalle.direccionExacta = '100 m norte de la iglesia, costado oeste';
    detalle.folioReal = '123456-000';
    detalle.planoCatastrado = 'SJ-1234567-2020';
    detalle.planoAgrimensura = 'AG-998877-2019';
    detalle.proposito =
      PropositoInfraestructuraLinderosConfirmado.REUNION_FINCAS;
    detalle.medioNotificacionPrincipal = MedioNotificacionCambioTitular.CORREO;
    detalle.valorNotificacionPrincipal = 'maria@ejemplo.com';
    detalle.medioNotificacionSecundario =
      MedioNotificacionCambioTitular.TELEFONO;
    detalle.valorNotificacionSecundario = '8888-1234';
    detalle.firma = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...';
  });

  it('1. Debe instanciarse con NIS textual y relación Solicitud 1:1', () => {
    const solicitud = new Solicitud();
    solicitud.id = 30;
    solicitud.codigoSeguimiento = 'SOL-2026-INFR01';

    detalle.solicitud = solicitud;
    solicitud.detalleInfraestructuraLinderos = detalle;

    expect(detalle.nis).toBe('NIS-77881');
    expect(detalle.solicitud).toBe(solicitud);
    expect(solicitud.detalleInfraestructuraLinderos).toBe(detalle);
    expect(solicitud.detalleInfraestructuraLinderos?.solicitudId).toBe(30);
  });

  it('2. Debe representar propietario persona física', () => {
    expect(detalle.tipoPersona).toBe(TipoPersonaInfraestructuraLinderos.FISICA);
    expect(detalle.nombreFisica).toBe('María Elena');
    expect(detalle.apellidosFisica).toBe('Rodríguez Vargas');
    expect(detalle.identificacionFisica).toBe('1-1234-0567');
    expect(detalle.telefonoFisica).toBe('8888-1234');
  });

  it('3. Debe representar propietario persona jurídica', () => {
    detalle.tipoPersona = TipoPersonaInfraestructuraLinderos.JURIDICA;
    detalle.nombreFisica = null;
    detalle.apellidosFisica = null;
    detalle.identificacionFisica = null;
    detalle.telefonoFisica = null;
    detalle.razonSocial = 'Inversiones del Valle S.A.';
    detalle.cedulaJuridica = '3-101-123456';
    detalle.nombreRepresentante = 'Luis Alberto Mora Chaves';
    detalle.identificacionRepresentante = '1-0987-6543';
    detalle.telefonoRepresentante = '8777-4321';

    expect(detalle.tipoPersona).toBe(
      TipoPersonaInfraestructuraLinderos.JURIDICA,
    );
    expect(detalle.razonSocial).toBe('Inversiones del Valle S.A.');
    expect(detalle.cedulaJuridica).toBe('3-101-123456');
    expect(detalle.nombreRepresentante).toBe('Luis Alberto Mora Chaves');
    expect(detalle.identificacionRepresentante).toBe('1-0987-6543');
    expect(detalle.telefonoRepresentante).toBe('8777-4321');
    expect(detalle.nombreFisica).toBeNull();
  });

  it('4. Identificaciones y teléfonos se representan como texto', () => {
    detalle.identificacionFisica = '01-0234-0005';
    detalle.telefonoFisica = '0860-7584';
    detalle.cedulaJuridica = '3-101-000089';
    expect(detalle.identificacionFisica).toBe('01-0234-0005');
    expect(detalle.telefonoFisica).toBe('0860-7584');
    expect(detalle.cedulaJuridica).toBe('3-101-000089');
  });

  it('5. Debe guardar calidad del titular', () => {
    expect(detalle.calidadTitular).toBe('Propietario');
    detalle.calidadTitular = CalidadTitularCambioTitular.REPRESENTANTE_LEGAL;
    expect(detalle.calidadTitular).toBe('Representante legal');
  });

  it('6. Debe guardar ubicación (provincia, cantón, distrito, dirección)', () => {
    expect(detalle.provincia).toBe('San José');
    expect(detalle.canton).toBe('Pérez Zeledón');
    expect(detalle.distrito).toBe('San Isidro de El General');
    expect(detalle.direccionExacta).toContain('iglesia');
  });

  it('7. Debe guardar folio y planos como texto nullable', () => {
    expect(detalle.folioReal).toBe('123456-000');
    expect(detalle.planoCatastrado).toBe('SJ-1234567-2020');
    expect(detalle.planoAgrimensura).toBe('AG-998877-2019');

    detalle.folioReal = null;
    detalle.planoCatastrado = null;
    detalle.planoAgrimensura = null;
    expect(detalle.folioReal).toBeNull();
    expect(detalle.planoCatastrado).toBeNull();
    expect(detalle.planoAgrimensura).toBeNull();
  });

  it('8. Debe persistir propósito oficial confirmado (un solo valor)', () => {
    expect(detalle.proposito).toBe('Reunión de fincas');
  });

  it('9. Debe guardar medios y destinos de notificación', () => {
    expect(detalle.medioNotificacionPrincipal).toBe('Correo electrónico');
    expect(detalle.valorNotificacionPrincipal).toBe('maria@ejemplo.com');
    expect(detalle.medioNotificacionSecundario).toBe('Teléfono');
    expect(detalle.valorNotificacionSecundario).toBe('8888-1234');
  });

  it('10. Campos opcionales aceptan null (secundario, firma, planos)', () => {
    detalle.medioNotificacionSecundario = null;
    detalle.valorNotificacionSecundario = null;
    detalle.valorNotificacionPrincipal = null;
    detalle.firma = null;
    detalle.planoAgrimensura = null;

    expect(detalle.medioNotificacionSecundario).toBeNull();
    expect(detalle.valorNotificacionSecundario).toBeNull();
    expect(detalle.valorNotificacionPrincipal).toBeNull();
    expect(detalle.firma).toBeNull();
    expect(detalle.planoAgrimensura).toBeNull();
  });

  it('11. Firma admite data-URL, URL o null', () => {
    detalle.firma = null;
    expect(detalle.firma).toBeNull();

    detalle.firma = 'https://storage.asadasanjuan.cr/firmas/sol-30-infra.png';
    expect(detalle.firma).toContain('https://');

    detalle.firma = 'data:image/png;base64,abc';
    expect(detalle.firma).toContain('data:image/png;base64');
  });

  it('12. Persona física puede omitir campos de jurídica', () => {
    expect(detalle.tipoPersona).toBe(TipoPersonaInfraestructuraLinderos.FISICA);
    detalle.razonSocial = null;
    detalle.cedulaJuridica = null;
    detalle.nombreRepresentante = null;
    detalle.identificacionRepresentante = null;
    detalle.telefonoRepresentante = null;

    expect(detalle.razonSocial).toBeNull();
    expect(detalle.cedulaJuridica).toBeNull();
    expect(detalle.nombreFisica).toBeDefined();
  });
});
