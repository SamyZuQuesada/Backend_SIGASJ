import { EstadoSolicitud } from '../../../common/enums/estado-solicitud.enum';
import {
  HistorialSolicitud,
  HISTORIAL_SOLICITUD_NO_ELIMINABLE,
  HISTORIAL_SOLICITUD_NO_MODIFICABLE,
} from './historial-solicitud.entity';
import { Solicitud } from './solicitud.entity';

describe('HistorialSolicitud Entity', () => {
  it('debe instanciar correctamente la entidad con todos sus campos', () => {
    const historial = new HistorialSolicitud();
    const ahora = new Date('2026-10-24T12:00:00Z');

    historial.id = 1;
    historial.solicitudId = 10;
    historial.evento = 'REGISTRADA';
    historial.tipoEvento = 'CREACION';
    historial.descripcion = 'Solicitud registrada en el sistema';
    historial.estadoAnterior = null;
    historial.estadoNuevo = EstadoSolicitud.PENDIENTE;
    historial.idUsuario = null;
    historial.fechaHora = ahora;

    expect(historial.id).toBe(1);
    expect(historial.solicitudId).toBe(10);
    expect(historial.evento).toBe('REGISTRADA');
    expect(historial.tipoEvento).toBe('CREACION');
    expect(historial.descripcion).toBe('Solicitud registrada en el sistema');
    expect(historial.comentario).toBe('Solicitud registrada en el sistema');
    expect(historial.estadoAnterior).toBeNull();
    expect(historial.estadoNuevo).toBe(EstadoSolicitud.PENDIENTE);
    expect(historial.idUsuario).toBeNull();
    expect(historial.fechaHora).toEqual(ahora);
  });

  it('debe establecer valores por defecto en fijarFechaHora() si no están definidos', () => {
    const historial = new HistorialSolicitud();
    historial.fijarFechaHora();

    expect(historial.fechaHora).toBeInstanceOf(Date);
    expect(historial.evento).toBe('REGISTRADA');
    expect(historial.estadoNuevo).toBe(EstadoSolicitud.PENDIENTE);
  });

  it('debe impedir modificaciones mediante el hook @BeforeUpdate', () => {
    const historial = new HistorialSolicitud();
    expect(() => historial.impedirModificacion()).toThrow(
      HISTORIAL_SOLICITUD_NO_MODIFICABLE,
    );
  });

  it('debe impedir eliminaciones físicas mediante el hook @BeforeRemove', () => {
    const historial = new HistorialSolicitud();
    expect(() => historial.impedirEliminacion()).toThrow(
      HISTORIAL_SOLICITUD_NO_ELIMINABLE,
    );
  });

  it('debe relacionarse con la entidad Solicitud', () => {
    const solicitud = new Solicitud();
    solicitud.id = 5;
    solicitud.codigoSeguimiento = 'SOL-2026-00005';

    const historial = new HistorialSolicitud();
    historial.solicitudId = solicitud.id;
    historial.solicitud = solicitud;

    expect(historial.solicitud).toBe(solicitud);
    expect(historial.solicitud.codigoSeguimiento).toBe('SOL-2026-00005');
  });

  it('debe permitir asignar y leer comentario como alias de descripcion', () => {
    const historial = new HistorialSolicitud();
    historial.comentario = 'Comentario de prueba';
    expect(historial.descripcion).toBe('Comentario de prueba');
    expect(historial.comentario).toBe('Comentario de prueba');
  });
});
