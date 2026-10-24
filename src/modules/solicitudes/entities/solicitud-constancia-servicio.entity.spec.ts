import { MotivoConstanciaServicio } from '../../../common/enums/motivo-constancia-servicio.enum';
import { SolicitudConstanciaServicio } from './solicitud-constancia-servicio.entity';
import { Solicitud } from './solicitud.entity';

describe('Entidad SolicitudConstanciaServicio', () => {
  let detalle: SolicitudConstanciaServicio;

  beforeEach(() => {
    detalle = new SolicitudConstanciaServicio();
    detalle.solicitudId = 60;
    detalle.tipoServicio = 'Domiciliar';
    detalle.nis = 'NIS-45892';
    detalle.propietarioInmueble = 'María Elena Rodríguez Vargas';
    detalle.nombreSolicitante = 'Carlos Alberto Mora Jiménez';
    detalle.identificacionSolicitante = '1-1234-0567';
    detalle.correoElectronico = 'carlos.mora@ejemplo.com';
    detalle.telefono = '8888-1234';
    detalle.folioReal = '123456-000';
    detalle.planoCatastrado = 'SJ-1234567-2020';
    detalle.planoAgrimensura = 'AG-998877-2019';
    detalle.naturalezaInmueble = 'Inscrito';
    detalle.calidadTitular = 'Propietario';
    detalle.provincia = 'San José';
    detalle.canton = 'Pérez Zeledón';
    detalle.distrito = 'San Isidro de El General';
    detalle.direccionExacta = '100 m norte de la iglesia, casa blanca esquinera';
    detalle.motivo = MotivoConstanciaServicio.BONO_VIVIENDA;
    detalle.otroMotivo = null;
    detalle.tramitePorRealizar = 'Solicitud de bono de vivienda BANHVI';
    detalle.medioNotificacionPrincipal = 'Correo electrónico';
    detalle.medioNotificacionSecundario = 'Teléfono';
    detalle.firma = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...';
  });

  it('1. Debe instanciarse y relacionarse 1:1 con Solicitud', () => {
    const solicitud = new Solicitud();
    solicitud.id = 60;
    solicitud.codigoSeguimiento = 'SOL-2026-SERV01';

    detalle.solicitud = solicitud;
    solicitud.detalleConstanciaServicio = detalle;

    expect(detalle.solicitud).toBe(solicitud);
    expect(detalle.solicitud.id).toBe(60);
    expect(solicitud.detalleConstanciaServicio).toBe(detalle);
    expect(solicitud.detalleConstanciaServicio?.solicitudId).toBe(60);
    // Compatibilidad con getter/setter detalleServicioExistente
    expect(solicitud.detalleServicioExistente).toBe(detalle);
  });

  it('2. Debe incorporar todos los datos del servicio (tipoServicio y NIS)', () => {
    expect(detalle.tipoServicio).toBe('Domiciliar');
    expect(detalle.nis).toBe('NIS-45892');
  });

  it('3. Debe incorporar datos del solicitante y del propietario del inmueble', () => {
    expect(detalle.propietarioInmueble).toBe('María Elena Rodríguez Vargas');
    expect(detalle.nombreSolicitante).toBe('Carlos Alberto Mora Jiménez');
    expect(detalle.identificacionSolicitante).toBe('1-1234-0567');
    expect(detalle.correoElectronico).toBe('carlos.mora@ejemplo.com');
    expect(detalle.telefono).toBe('8888-1234');
  });

  it('4. Debe incorporar datos del inmueble (folio, planos, naturaleza y calidad)', () => {
    expect(detalle.folioReal).toBe('123456-000');
    expect(detalle.planoCatastrado).toBe('SJ-1234567-2020');
    expect(detalle.planoAgrimensura).toBe('AG-998877-2019');
    expect(detalle.naturalezaInmueble).toBe('Inscrito');
    expect(detalle.calidadTitular).toBe('Propietario');
  });

  it('5. Debe incorporar ubicación geográfica completa', () => {
    expect(detalle.provincia).toBe('San José');
    expect(detalle.canton).toBe('Pérez Zeledón');
    expect(detalle.distrito).toBe('San Isidro de El General');
    expect(detalle.direccionExacta).toBe(
      '100 m norte de la iglesia, casa blanca esquinera',
    );
  });

  it('6. Debe incorporar motivo estándar', () => {
    expect(detalle.motivo).toBe('Bono de vivienda');
    expect(detalle.otroMotivo).toBeNull();
  });

  it('7. La opción Otro permite especificar el motivo en otroMotivo', () => {
    detalle.motivo = MotivoConstanciaServicio.OTRO;
    detalle.otroMotivo = 'Trámite especial ante IMAS para subsidio familiar';

    expect(detalle.motivo).toBe('Otro');
    expect(detalle.otroMotivo).toBe(
      'Trámite especial ante IMAS para subsidio familiar',
    );
  });

  it('8. Permite indicar el trámite por realizar', () => {
    expect(detalle.tramitePorRealizar).toBe(
      'Solicitud de bono de vivienda BANHVI',
    );
  });

  it('9. Debe incorporar notificaciones principales y secundarias', () => {
    expect(detalle.medioNotificacionPrincipal).toBe('Correo electrónico');
    expect(detalle.medioNotificacionSecundario).toBe('Teléfono');
  });

  it('10. Debe preparar y aceptar firma en data-URL, URL o null', () => {
    expect(detalle.firma).toContain('data:image/png;base64');

    detalle.firma = 'https://storage.asadasanjuan.cr/firmas/constancia-60.png';
    expect(detalle.firma).toContain('https://');

    detalle.firma = null;
    expect(detalle.firma).toBeNull();
  });

  it('11. Admite valores nulos en campos opcionales del inmueble y trámite', () => {
    detalle.folioReal = null;
    detalle.planoCatastrado = null;
    detalle.planoAgrimensura = null;
    detalle.otroMotivo = null;
    detalle.tramitePorRealizar = null;
    detalle.medioNotificacionSecundario = null;
    detalle.firma = null;

    expect(detalle.folioReal).toBeNull();
    expect(detalle.planoCatastrado).toBeNull();
    expect(detalle.planoAgrimensura).toBeNull();
    expect(detalle.otroMotivo).toBeNull();
    expect(detalle.tramitePorRealizar).toBeNull();
    expect(detalle.medioNotificacionSecundario).toBeNull();
    expect(detalle.firma).toBeNull();
  });
});
