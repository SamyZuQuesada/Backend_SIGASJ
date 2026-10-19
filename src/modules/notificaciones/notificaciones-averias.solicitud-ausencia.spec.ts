import { TipoNotificacionAveria } from '../../common/enums/tipo-notificacion-averia.enum';
import { TipoSolicitudAusencia } from '../../common/enums/tipo-solicitud-ausencia.enum';
import { Averia } from '../averias/entities/averia.entity';
import { SolicitudAusencia } from '../solicitudes-ausencia/entities/solicitud-ausencia.entity';
import { NotificacionesAveriasService } from './notificaciones-averias.service';

describe('NotificacionesAveriasService — campana Administradora', () => {
  const buildService = (registrar: jest.Mock) => {
    const service = Object.create(
      NotificacionesAveriasService.prototype,
    ) as NotificacionesAveriasService;
    Object.assign(service, {
      usuarioRepository: {
        find: jest.fn().mockResolvedValue([
          { idUsuario: 10, activo: true },
          { idUsuario: 11, activo: true },
        ]),
      },
      registrarSiNoExiste: registrar,
      logger: { warn: jest.fn() },
    });
    return service;
  };

  it('registra SOLICITUD_AUSENCIA_PENDIENTE_ADMINISTRADORA por admin activa', async () => {
    const registrar = jest.fn().mockResolvedValue({ id: 1 });
    const service = buildService(registrar);

    const solicitud = {
      id: 44,
      tipo: TipoSolicitudAusencia.PERMISO,
      fechaInicio: '2026-11-01',
      fechaFin: '2026-11-02',
      colaborador: { nombre: 'Juan', apellidos: 'Fontanero' },
    } as SolicitudAusencia;

    await service.notificarAdministradorasSolicitudAusenciaPendiente(solicitud);

    expect(registrar).toHaveBeenCalledTimes(2);
    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        idUsuarioDestinatario: 10,
        idSolicitudAusencia: 44,
        tipo: TipoNotificacionAveria.SOLICITUD_AUSENCIA_PENDIENTE_ADMINISTRADORA,
        titulo: 'Solicitud de permiso pendiente',
        mensaje: expect.stringContaining('Juan Fontanero'),
      }),
    );
  });

  it('registra AVERIA_CLASIFICADA_ADMINISTRADORA con prioridad y tipo', async () => {
    const registrar = jest.fn().mockResolvedValue({ id: 2 });
    const service = buildService(registrar);

    await service.notificarAdministradorasAveriaClasificada({
      id: 7,
      codigoSeguimiento: 'AV-2026-0007',
      prioridad: 'ALTA',
      tipoAveria: 'TUBO_MADRE',
    } as Averia);

    expect(registrar).toHaveBeenCalledTimes(2);
    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        idUsuarioDestinatario: 10,
        idAveria: 7,
        tipo: TipoNotificacionAveria.AVERIA_CLASIFICADA_ADMINISTRADORA,
        titulo: 'Avería clasificada AV-2026-0007',
        mensaje: expect.stringContaining('prioridad Alta'),
      }),
    );
  });

  it('no notifica clasificación incompleta', async () => {
    const registrar = jest.fn();
    const service = buildService(registrar);

    await service.notificarAdministradorasAveriaClasificada({
      id: 7,
      codigoSeguimiento: 'AV-2026-0007',
      prioridad: 'ALTA',
      tipoAveria: null,
    } as Averia);

    expect(registrar).not.toHaveBeenCalled();
  });
});
