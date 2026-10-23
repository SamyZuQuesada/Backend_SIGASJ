import { SolicitudCambioTitular } from './solicitud-cambio-titular.entity';
import { Solicitud } from './solicitud.entity';

describe('Entidad SolicitudCambioTitular', () => {
  let detalle: SolicitudCambioTitular;

  beforeEach(() => {
    detalle = new SolicitudCambioTitular();
    detalle.solicitudId = 20;
    detalle.nombreSolicitante = 'Ana Lucía Vargas Quirós';
    detalle.identificacionSolicitante = '1-1234-0567';
    detalle.telefono = '8888-1234';
    detalle.nombrePropietarioRegistral = 'Carlos Alberto Mora Jiménez';
    detalle.identificacionPropietario = '1-0987-6543';
    detalle.folioReal = '123456-000';
    detalle.planoCatastrado = 'SJ-1234567-2020';
    detalle.planoAgrimensura = 'AG-998877-2019';
    detalle.naturalezaInmueble = 'Propiedad inscrita';
    detalle.calidadTitular = 'Propietario';
    detalle.nis = 'NIS-45892';
    detalle.facturaANombreDe = 'Carlos Alberto Mora Jiménez';
    detalle.medioNotificacionPrincipal = 'Correo electrónico';
    detalle.medioNotificacionSecundario = 'Teléfono';
    detalle.firma = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...';
  });

  it('1. Debe instanciarse con los campos del solicitante', () => {
    expect(detalle.nombreSolicitante).toBe('Ana Lucía Vargas Quirós');
    expect(detalle.identificacionSolicitante).toBe('1-1234-0567');
    expect(detalle.telefono).toBe('8888-1234');
  });

  it('2. Debe relacionarse 1:1 con Solicitud', () => {
    const solicitud = new Solicitud();
    solicitud.id = 20;
    solicitud.codigoSeguimiento = 'SOL-2026-CTIT01';

    detalle.solicitud = solicitud;
    solicitud.detalleCambioTitular = detalle;

    expect(detalle.solicitud).toBe(solicitud);
    expect(detalle.solicitud.id).toBe(20);
    expect(solicitud.detalleCambioTitular).toBe(detalle);
    expect(solicitud.detalleCambioTitular?.nis).toBe('NIS-45892');
  });

  it('3. Debe guardar propietario registral distinto del solicitante', () => {
    expect(detalle.nombrePropietarioRegistral).toBe(
      'Carlos Alberto Mora Jiménez',
    );
    expect(detalle.identificacionPropietario).toBe('1-0987-6543');
    expect(detalle.nombrePropietarioRegistral).not.toBe(
      detalle.nombreSolicitante,
    );
  });

  it('4. Debe guardar datos del inmueble (folio y planos como texto)', () => {
    expect(detalle.folioReal).toBe('123456-000');
    expect(detalle.planoCatastrado).toBe('SJ-1234567-2020');
    expect(detalle.planoAgrimensura).toBe('AG-998877-2019');
  });

  it('5. Debe guardar naturalezaInmueble y calidadTitular', () => {
    expect(detalle.naturalezaInmueble).toBe('Propiedad inscrita');
    expect(detalle.calidadTitular).toBe('Propietario');
  });

  it('6. Debe guardar NIS y facturaANombreDe', () => {
    expect(detalle.nis).toBe('NIS-45892');
    expect(detalle.facturaANombreDe).toBe('Carlos Alberto Mora Jiménez');
  });

  it('7. Debe guardar medios de notificación', () => {
    expect(detalle.medioNotificacionPrincipal).toBe('Correo electrónico');
    expect(detalle.medioNotificacionSecundario).toBe('Teléfono');
  });

  it('8. Campos opcionales aceptan null', () => {
    detalle.folioReal = null;
    detalle.planoCatastrado = null;
    detalle.planoAgrimensura = null;
    detalle.medioNotificacionSecundario = null;
    detalle.firma = null;

    expect(detalle.folioReal).toBeNull();
    expect(detalle.planoCatastrado).toBeNull();
    expect(detalle.planoAgrimensura).toBeNull();
    expect(detalle.medioNotificacionSecundario).toBeNull();
    expect(detalle.firma).toBeNull();
  });

  it('9. Firma admite data-URL, URL o null', () => {
    detalle.firma = null;
    expect(detalle.firma).toBeNull();

    detalle.firma =
      'https://storage.asadasanjuan.cr/firmas/sol-20-cambio-titular.png';
    expect(detalle.firma).toContain('https://');

    detalle.firma = 'data:image/png;base64,abc';
    expect(detalle.firma).toContain('data:image/png;base64');
  });

  it('10. Identificaciones y teléfono se representan como texto (guiones / ceros)', () => {
    detalle.identificacionSolicitante = '01-0234-0005';
    detalle.telefono = '0860-7584';
    expect(detalle.identificacionSolicitante).toBe('01-0234-0005');
    expect(detalle.telefono).toBe('0860-7584');
  });
});
