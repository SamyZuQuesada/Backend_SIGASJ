import { EstadoSolicitud } from '../../../common/enums/estado-solicitud.enum';
import { PlazoArregloPago } from '../../../common/enums/plazo-arreglo-pago.enum';
import { TipoSolicitudSlug } from '../../../common/enums/tipo-solicitud-slug.enum';
import { SolicitudArregloPago } from './solicitud-arreglo-pago.entity';
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
    solicitud2.detalleCambioTitular = { nuevoTitularCedula: '112340567' };

    const solicitud3 = new Solicitud();
    solicitud3.detalleInfraestructuraLinderos = { frenteMetros: 15 };

    const solicitud4 = new Solicitud();
    solicitud4.detalleAfiliacion = { tipoAbonado: 'DOMICILIAR' };

    const solicitud5 = new Solicitud();
    solicitud5.detalleDisponibilidadServicios = {
      usoPropiedad: 'HABITACIONAL',
    };

    const solicitud6 = new Solicitud();
    solicitud6.detalleServicioExistente = { numeroNIS: '987654' };

    expect(solicitud1.detalleArregloPago).toBeDefined();
    expect(solicitud2.detalleCambioTitular).toBeDefined();
    expect(solicitud3.detalleInfraestructuraLinderos).toBeDefined();
    expect(solicitud4.detalleAfiliacion).toBeDefined();
    expect(solicitud5.detalleDisponibilidadServicios).toBeDefined();
    expect(solicitud6.detalleServicioExistente).toBeDefined();
  });

  it('debe tener preparadas las relaciones con documentos e historial', () => {
    const solicitud = new Solicitud();
    solicitud.documentos = [
      { id: 1, nombreArchivo: 'cedula.pdf', tipoDocumento: 'CEDULA' },
    ];
    solicitud.historial = [
      {
        id: 1,
        estadoAnterior: EstadoSolicitud.PENDIENTE,
        estadoNuevo: EstadoSolicitud.EN_REVISION,
      },
    ];

    expect(solicitud.documentos).toHaveLength(1);
    expect(solicitud.historial).toHaveLength(1);
  });
});
