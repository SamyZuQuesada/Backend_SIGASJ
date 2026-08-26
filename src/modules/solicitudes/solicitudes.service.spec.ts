import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SolicitudEstado } from '../../common/enums/solicitud-estado.enum';
import { SolicitudServicio } from './entities/solicitud-servicio.entity';
import { SolicitudesService } from './solicitudes.service';

describe('SolicitudesService — Tarea #338', () => {
  let service: SolicitudesService;
  let find: jest.Mock;

  const pendiente: SolicitudServicio = {
    idSolicitud: 1,
    nombre: 'María',
    apellidos: 'Rodríguez Mora',
    cedula: '1-2345-6789',
    telefono: '8888-1234',
    correo: 'maria.rodriguez@correo.cr',
    direccion: 'San Juan, Desamparados',
    estado: SolicitudEstado.APROBADA,
    utilizada: false,
  };

  beforeEach(async () => {
    find = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudesService,
        {
          provide: getRepositoryToken(SolicitudServicio),
          useValue: {
            find,
            count: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(SolicitudesService);
  });

  it('devuelve solicitudes aprobadas pendientes con datos del solicitante', async () => {
    find.mockResolvedValue([pendiente]);

    const result = await service.findAprobadasPendientes();

    expect(find).toHaveBeenCalledWith({
      where: { estado: SolicitudEstado.APROBADA, utilizada: false },
      order: { idSolicitud: 'ASC' },
    });
    expect(result.solicitudes).toHaveLength(1);
    expect(result.solicitudes[0]).toEqual({
      idSolicitud: 1,
      nombre: 'María',
      apellidos: 'Rodríguez Mora',
      cedula: '1-2345-6789',
      telefono: '8888-1234',
      correo: 'maria.rodriguez@correo.cr',
      direccion: 'San Juan, Desamparados',
      utilizada: false,
    });
    expect(result.mensaje).toBeNull();
  });

  it('no incluye solicitudes utilizadas ni no aprobadas', async () => {
    find.mockResolvedValue([]);

    await service.findAprobadasPendientes();

    expect(find).toHaveBeenCalledWith({
      where: { estado: SolicitudEstado.APROBADA, utilizada: false },
      order: { idSolicitud: 'ASC' },
    });
  });

  it('devuelve mensaje claro cuando no hay solicitudes pendientes', async () => {
    find.mockResolvedValue([]);

    const result = await service.findAprobadasPendientes();

    expect(result.solicitudes).toEqual([]);
    expect(result.mensaje).toBe(
      'No hay solicitudes aprobadas pendientes de registro.',
    );
  });
});
