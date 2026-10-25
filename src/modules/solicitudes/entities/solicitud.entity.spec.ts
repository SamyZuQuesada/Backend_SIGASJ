import { EstadoSolicitud } from '../../../common/enums/estado-solicitud.enum';
import { PlazoArregloPago } from '../../../common/enums/plazo-arreglo-pago.enum';
import { TipoDocumentoSolicitud } from '../../../common/enums/tipo-documento-solicitud.enum';
import { TipoSolicitudSlug } from '../../../common/enums/tipo-solicitud-slug.enum';
import { DocumentoSolicitud } from './documento-solicitud.entity';
import { HistorialSolicitud } from './historial-solicitud.entity';
import { SolicitudAfiliacion } from './solicitud-afiliacion.entity';
import { SolicitudArregloPago } from './solicitud-arreglo-pago.entity';
import { SolicitudCambioTitular } from './solicitud-cambio-titular.entity';
import { SolicitudDisponibilidadServicios } from './solicitud-disponibilidad-servicios.entity';
import { SolicitudInfraestructuraLinderos } from './solicitud-infraestructura-linderos.entity';
import { SolicitudConstanciaServicio } from './solicitud-constancia-servicio.entity';
import { Solicitud } from './solicitud.entity';
import { TipoSolicitud } from './tipo-solicitud.entity';

describe('Solicitud Entity (Encabezado central)', () => {
  it('debe instanciar correctamente la entidad con todos sus campos principales', () => {
    const solicitud = new Solicitud();
    const ahora = new Date('2026-10-20T10:00:00Z');

    solicitud.id = 1;
    solicitud.tipoSolicitudId = 1;
    solicitud.codigoSeguimiento = 'SOL-2026-ARP001';
    solicitud.estado = EstadoSolicitud.PENDIENTE;
    solicitud.fechaIngreso = ahora;
    solicitud.createdAt = ahora;
    solicitud.updatedAt = ahora;
    solicitud.deletedAt = null;

    expect(solicitud.id).toBe(1);
    expect(solicitud.tipoSolicitudId).toBe(1);
    expect(solicitud.codigoSeguimiento).toBe('SOL-2026-ARP001');
    expect(solicitud.estado).toBe(EstadoSolicitud.PENDIENTE);
    expect(solicitud.fechaIngreso).toEqual(ahora);
    expect(solicitud.deletedAt).toBeNull();
  });

  it('debe relacionarse correctamente con TipoSolicitud', () => {
    const tipo = new TipoSolicitud();
    tipo.id = 1;
    tipo.nombre = 'Solicitud de Arreglo de Pago Domiciliar';
    tipo.slug = TipoSolicitudSlug.ARREGLO_PAGO;
    tipo.activo = true;

    const solicitud = new Solicitud();
    solicitud.id = 10;
    solicitud.tipoSolicitudId = tipo.id;
    solicitud.tipoSolicitud = tipo;
    solicitud.codigoSeguimiento = 'SOL-2026-00010';

    expect(solicitud.tipoSolicitud).toBe(tipo);
    expect(solicitud.tipoSolicitud.nombre).toBe(
      'Solicitud de Arreglo de Pago Domiciliar',
    );

    // Relación inversa
    tipo.solicitudes = [solicitud];
    expect(tipo.solicitudes).toHaveLength(1);
    expect(tipo.solicitudes[0].codigoSeguimiento).toBe('SOL-2026-00010');
  });

  it('debe establecer valores por defecto en BeforeInsert (estado PENDIENTE, fechaIngreso y código normalizado)', () => {
    const solicitud = new Solicitud();
    solicitud.codigoSeguimiento = '  sol-2026-xyz99  ';

    solicitud.establecerValoresPorDefecto();

    expect(solicitud.estado).toBe(EstadoSolicitud.PENDIENTE);
    expect(solicitud.fechaIngreso).toBeInstanceOf(Date);
    expect(solicitud.codigoSeguimiento).toBe('SOL-2026-XYZ99');
  });

  it('debe auto-generar un código alfanumérico seguro en BeforeInsert si la solicitud no lo posee', () => {
    const solicitud = new Solicitud();
    solicitud.establecerValoresPorDefecto();

    expect(solicitud.codigoSeguimiento).toBeDefined();
    expect(solicitud.codigoSeguimiento).toMatch(/^SOL-\d{4}-[A-Z0-9]{6}$/);
  });

  it('debe impedir la modificación de codigoSeguimiento en BeforeUpdate (inmutabilidad y estabilidad)', () => {
    const solicitud = new Solicitud();
    solicitud.codigoSeguimiento = 'SOL-2026-A82K91';
    solicitud.capturarCodigoOriginal();

    // Intentar alterar el código
    solicitud.codigoSeguimiento = 'SOL-2026-HACK99';

    expect(() => solicitud.validarInmutabilidadCodigo()).toThrow(
      'El código de seguimiento de una solicitud es inmutable y no puede ser modificado',
    );
  });

  it('debe permitir la actualización de otros campos en BeforeUpdate si el código permanece estable', () => {
    const solicitud = new Solicitud();
    solicitud.codigoSeguimiento = 'SOL-2026-A82K91';
    solicitud.capturarCodigoOriginal();

    // El estado cambia pero el código se mantiene intacto
    solicitud.estado = EstadoSolicitud.APROBADA;

    expect(() => solicitud.validarInmutabilidadCodigo()).not.toThrow();
  });

  it('debe permitir almacenar y actualizar el estado actual de la solicitud', () => {
    const solicitud = new Solicitud();
    solicitud.estado = EstadoSolicitud.PENDIENTE;
    expect(solicitud.estado).toBe(EstadoSolicitud.PENDIENTE);

    solicitud.estado = EstadoSolicitud.EN_REVISION;
    expect(solicitud.estado).toBe(EstadoSolicitud.EN_REVISION);

    solicitud.estado = EstadoSolicitud.APROBADA;
    expect(solicitud.estado).toBe(EstadoSolicitud.APROBADA);

    solicitud.estado = EstadoSolicitud.FINALIZADA;
    expect(solicitud.estado).toBe(EstadoSolicitud.FINALIZADA);
  });

  it('debe evitar eliminación física de solicitudes procesadas mediante soft delete (deletedAt)', () => {
    const solicitud = new Solicitud();
    solicitud.id = 5;
    solicitud.estado = EstadoSolicitud.APROBADA;
    solicitud.deletedAt = null;

    // Al eliminar lógicamente, se registra fecha de baja sin borrar el registro físico
    solicitud.deletedAt = new Date();
    expect(solicitud.deletedAt).toBeInstanceOf(Date);
    expect(solicitud.estado).toBe(EstadoSolicitud.APROBADA);
  });

  it('debe servir como encabezado común para cualquiera de los seis trámites oficiales', () => {
    const solicitud1 = new Solicitud();
    const detalleArreglo = new SolicitudArregloPago();
    detalleArreglo.plazoSeleccionado = PlazoArregloPago.MESES_12;
    detalleArreglo.montoPrimaInicial = 15000;
    solicitud1.detalleArregloPago = detalleArreglo;

    const solicitud2 = new Solicitud();
    const detalleCambio = new SolicitudCambioTitular();
    detalleCambio.identificacionSolicitante = '1-1234-0567';
    detalleCambio.nis = 'NIS-987654';
    solicitud2.detalleCambioTitular = detalleCambio;

    const solicitud3 = new Solicitud();
    const detalleInfra = new SolicitudInfraestructuraLinderos();
    detalleInfra.nis = 'NIS-77881';
    detalleInfra.proposito = 'Reunión de fincas';
    solicitud3.detalleInfraestructuraLinderos = detalleInfra;

    const solicitud4 = new Solicitud();
    const detalleAfiliacion = new SolicitudAfiliacion();
    detalleAfiliacion.nombre = 'María Elena Rodríguez Vargas';
    detalleAfiliacion.numeroAbonado = '45892';
    solicitud4.detalleAfiliacion = detalleAfiliacion;

    const solicitud5 = new Solicitud();
    const detalleDisponibilidad = new SolicitudDisponibilidadServicios();
    detalleDisponibilidad.proposito = 'Fraccionamiento';
    detalleDisponibilidad.autorizacionInspeccion = true;
    solicitud5.detalleDisponibilidadServicios = detalleDisponibilidad;

    const solicitud6 = new Solicitud();
    const detalleConstancia = new SolicitudConstanciaServicio();
    detalleConstancia.nis = '987654';
    solicitud6.detalleConstanciaServicio = detalleConstancia;

    expect(solicitud1.detalleArregloPago).toBeDefined();
    expect(solicitud2.detalleCambioTitular).toBeDefined();
    expect(solicitud3.detalleInfraestructuraLinderos).toBeDefined();
    expect(solicitud4.detalleAfiliacion).toBeDefined();
    expect(solicitud5.detalleDisponibilidadServicios).toBeDefined();
    expect(solicitud6.detalleConstanciaServicio).toBeDefined();
    expect(solicitud6.detalleServicioExistente).toBeDefined();
  });

  it('debe tener la relación OneToMany con DocumentoSolicitud e HistorialSolicitud', () => {
    const solicitud = new Solicitud();
    const documento = new DocumentoSolicitud();
    documento.id = 1;
    documento.nombreOriginal = 'cedula.pdf';
    documento.tipoDocumento = TipoDocumentoSolicitud.IDENTIFICACION;
    solicitud.documentos = [documento];

    const evento = new HistorialSolicitud();
    evento.id = 1;
    evento.solicitudId = 10;
    evento.estadoAnterior = EstadoSolicitud.PENDIENTE;
    evento.estadoNuevo = EstadoSolicitud.EN_REVISION;
    solicitud.historial = [evento];

    expect(solicitud.documentos).toHaveLength(1);
    expect(solicitud.historial).toHaveLength(1);
    expect(solicitud.historial[0].estadoNuevo).toBe(
      EstadoSolicitud.EN_REVISION,
    );
  });
});
