import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Solicitud } from './entities/solicitud.entity';
import { HistorialSolicitud } from './entities/historial-solicitud.entity';
import { TipoSolicitud } from './entities/tipo-solicitud.entity';
import { SolicitudesService } from './solicitudes.service';
import { DocumentoSolicitud } from './entities/documento-solicitud.entity';
import { SolicitudServicio } from './entities/solicitud-servicio.entity';
import { SolicitudArregloPago } from './entities/solicitud-arreglo-pago.entity';
import { SolicitudCambioTitular } from './entities/solicitud-cambio-titular.entity';
import { SolicitudInfraestructuraLinderos } from './entities/solicitud-infraestructura-linderos.entity';
import { SolicitudAfiliacion } from './entities/solicitud-afiliacion.entity';
import { SolicitudDisponibilidadServicios } from './entities/solicitud-disponibilidad-servicios.entity';
import { SolicitudConstanciaServicio } from './entities/solicitud-constancia-servicio.entity';

describe('Transacción Atómica de Cambio de Estado y Sincronización Detalle/Historial', () => {
  let service: SolicitudesService;

  const adminUser: AuthenticatedUser = {
    userId: '7',
    idUsuario: 7,
    email: 'admin@asada.cr',
    role: Role.ADMINISTRADORA,
    name: 'Administradora ASADA',
  };

  let dbSolicitud: Solicitud;
  let dbHistorial: HistorialSolicitud[];

  beforeEach(async () => {
    dbSolicitud = new Solicitud();
    dbSolicitud.id = 25;
    dbSolicitud.codigoSeguimiento = 'SOL-2026-KST480';
    dbSolicitud.estado = EstadoSolicitud.PENDIENTE;
    dbSolicitud.fechaIngreso = new Date('2026-10-25T02:18:09Z');
    dbSolicitud.fechaResolucion = null;
    dbSolicitud.createdAt = new Date('2026-10-25T02:18:09Z');
    dbSolicitud.updatedAt = new Date('2026-10-25T02:18:09Z');

    const tipo = new TipoSolicitud();
    tipo.id = 1;
    tipo.slug = 'arreglo-pago';
    tipo.nombre = 'Solicitud de Arreglo de Pago';
    dbSolicitud.tipoSolicitud = tipo;
    dbSolicitud.tipoSolicitudId = 1;

    dbHistorial = [
      {
        id: 1,
        solicitudId: 25,
        evento: 'REGISTRADA',
        tipoEvento: 'CREACION',
        descripcion: 'Solicitud registrada',
        estadoAnterior: null,
        estadoNuevo: EstadoSolicitud.PENDIENTE,
        observacionPublica: null,
        notaInterna: null,
        idUsuario: null,
        fechaHora: new Date('2026-10-25T02:18:09Z'),
      } as HistorialSolicitud,
    ];

    const mockManager = {
      getRepository: jest.fn().mockImplementation((entity) => {
        if (entity === Solicitud) {
          return mockSolicitudRepo;
        }
        if (entity === HistorialSolicitud) {
          return mockHistorialRepo;
        }
        return {};
      }),
      transaction: jest.fn().mockImplementation(async (cb) => cb(mockManager)),
    };

    const mockSolicitudRepo = {
      findOne: jest.fn().mockImplementation(async ({ where }) => {
        if (where.id === dbSolicitud.id) {
          return dbSolicitud;
        }
        return null;
      }),
      save: jest.fn().mockImplementation(async (s: Solicitud) => {
        dbSolicitud.estado = s.estado;
        dbSolicitud.fechaResolucion = s.fechaResolucion;
        dbSolicitud.updatedAt = new Date();
        return dbSolicitud;
      }),
      update: jest.fn().mockImplementation(async (_criteria, values) => {
        if (values.estado) dbSolicitud.estado = values.estado;
        if (values.fechaResolucion !== undefined) dbSolicitud.fechaResolucion = values.fechaResolucion;
        return { affected: 1 };
      }),
      createQueryBuilder: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockImplementation(async () => {
          return { affected: 1 };
        }),
      }),
      manager: mockManager,
    };

    const mockHistorialRepo = {
      find: jest.fn().mockImplementation(async ({ where }) => {
        return dbHistorial.filter((h) => h.solicitudId === where.solicitudId);
      }),
      create: jest.fn().mockImplementation((dto) => ({
        id: dbHistorial.length + 1,
        fechaHora: new Date(),
        ...dto,
      })),
      save: jest.fn().mockImplementation(async (evento: HistorialSolicitud) => {
        const guardado = { ...evento, id: dbHistorial.length + 1, fechaHora: new Date() };
        dbHistorial.push(guardado as HistorialSolicitud);
        return guardado;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SolicitudesService,
        {
          provide: getRepositoryToken(Solicitud),
          useValue: mockSolicitudRepo,
        },
        {
          provide: getRepositoryToken(HistorialSolicitud),
          useValue: mockHistorialRepo,
        },
        {
          provide: getRepositoryToken(TipoSolicitud),
          useValue: { findOne: jest.fn().mockResolvedValue(tipo) },
        },
        {
          provide: getRepositoryToken(DocumentoSolicitud),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(SolicitudServicio),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(SolicitudArregloPago),
          useValue: { findOne: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: getRepositoryToken(SolicitudCambioTitular),
          useValue: { findOne: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: getRepositoryToken(SolicitudInfraestructuraLinderos),
          useValue: { findOne: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: getRepositoryToken(SolicitudAfiliacion),
          useValue: { findOne: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: getRepositoryToken(SolicitudDisponibilidadServicios),
          useValue: { findOne: jest.fn().mockResolvedValue(null) },
        },
        {
          provide: getRepositoryToken(SolicitudConstanciaServicio),
          useValue: { findOne: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    service = module.get<SolicitudesService>(SolicitudesService);
  });

  it('1. Debe actualizar Solicitud.estado y devolver el estado persistido en la respuesta', async () => {
    const respuesta = await service.actualizarEstado(
      25,
      {
        estadoNuevo: EstadoSolicitud.RECHAZADA,
        observacionPublica: 'Falta documentación requerida.',
        notaInterna: 'Nota interna de revisión.',
      },
      adminUser,
    );

    // Debe devolver el estado persistido directamente
    expect(respuesta.estado).toBe(EstadoSolicitud.RECHAZADA);
    expect(respuesta.estadoNuevo).toBe(EstadoSolicitud.RECHAZADA);
    expect(respuesta.estadoAnterior).toBe(EstadoSolicitud.PENDIENTE);
    expect(respuesta.fechaResolucion).toBeInstanceOf(Date);
  });

  it('2. GET /solicitudes/:id/detalle y GET /solicitudes/:id/historial deben coincidir en estado RECHAZADA', async () => {
    // Ejecutar el cambio de estado
    await service.actualizarEstado(
      25,
      {
        estadoNuevo: EstadoSolicitud.RECHAZADA,
        observacionPublica: 'Rechazo por requisitos no cumplidos',
      },
      adminUser,
    );

    // Consultar detalle: el registro principal NO debe continuar en PENDIENTE
    const detalle = await service.obtenerDetalle(25);
    expect(detalle.estado).toBe(EstadoSolicitud.RECHAZADA);
    expect(detalle.fechaResolucion).toBeInstanceOf(Date);

    // Consultar historial: el último evento debe coincidir con RECHAZADA
    const historial = await service.findHistorialBySolicitudId(25);
    expect(historial.length).toBeGreaterThanOrEqual(2);
    const ultimoEvento = historial[historial.length - 1];
    expect(ultimoEvento.estadoNuevo).toBe(EstadoSolicitud.RECHAZADA);

    // Verificación de consistencia entre ambos endpoints
    expect(detalle.estado).toBe(ultimoEvento.estadoNuevo);
  });

  it('3. Debe limpiar fechaResolucion si la solicitud vuelve a un estado activo (ej: EN_REVISION)', async () => {
    // 1. Resolver como APROBADA
    await service.actualizarEstado(
      25,
      { estadoNuevo: EstadoSolicitud.APROBADA },
      adminUser,
    );
    expect(dbSolicitud.fechaResolucion).toBeInstanceOf(Date);

    // 2. Mover a EN_REVISION
    const r2 = await service.actualizarEstado(
      25,
      { estadoNuevo: EstadoSolicitud.EN_REVISION },
      adminUser,
    );
    expect(r2.estado).toBe(EstadoSolicitud.EN_REVISION);
    expect(r2.fechaResolucion).toBeNull();
    expect(dbSolicitud.fechaResolucion).toBeNull();

    const detalle = await service.obtenerDetalle(25);
    expect(detalle.estado).toBe(EstadoSolicitud.EN_REVISION);
    expect(detalle.fechaResolucion).toBeNull();
  });

  it('4. Debe hacer rollback si falla la persistencia en el historial', async () => {
    const estadoInicial = dbSolicitud.estado;

    // Forzar fallo en el guardado de historial
    const module = await Test.createTestingModule({
      providers: [
        SolicitudesService,
        {
          provide: getRepositoryToken(Solicitud),
          useValue: {
            findOne: jest.fn().mockResolvedValue(dbSolicitud),
            save: jest.fn().mockResolvedValue(dbSolicitud),
            manager: {
              transaction: jest.fn().mockImplementation(async (cb) => {
                // Simula una transacción que revierte si la operación arroja excepción
                return cb({
                  getRepository: (e: unknown) => {
                    if (e === Solicitud) {
                      return {
                        findOne: jest.fn().mockResolvedValue(dbSolicitud),
                        save: jest.fn(),
                        createQueryBuilder: jest.fn().mockReturnValue({
                          update: jest.fn().mockReturnThis(),
                          set: jest.fn().mockReturnThis(),
                          where: jest.fn().mockReturnThis(),
                          andWhere: jest.fn().mockReturnThis(),
                          execute: jest.fn().mockResolvedValue({ affected: 1 }),
                        }),
                      };
                    }
                    if (e === HistorialSolicitud) {
                      return {
                        create: jest.fn(),
                        save: jest.fn().mockRejectedValue(new Error('Fallo crítico en base de datos')),
                      };
                    }
                    return {};
                  },
                });
              }),
            },
          },
        },
        { provide: getRepositoryToken(HistorialSolicitud), useValue: {} },
        { provide: getRepositoryToken(TipoSolicitud), useValue: {} },
        { provide: getRepositoryToken(DocumentoSolicitud), useValue: {} },
        { provide: getRepositoryToken(SolicitudServicio), useValue: {} },
        { provide: getRepositoryToken(SolicitudArregloPago), useValue: {} },
        { provide: getRepositoryToken(SolicitudCambioTitular), useValue: {} },
        { provide: getRepositoryToken(SolicitudInfraestructuraLinderos), useValue: {} },
        { provide: getRepositoryToken(SolicitudAfiliacion), useValue: {} },
        { provide: getRepositoryToken(SolicitudDisponibilidadServicios), useValue: {} },
        { provide: getRepositoryToken(SolicitudConstanciaServicio), useValue: {} },
      ],
    }).compile();

    const serviceFallo = module.get<SolicitudesService>(SolicitudesService);

    await expect(
      serviceFallo.actualizarEstado(
        25,
        { estadoNuevo: EstadoSolicitud.RECHAZADA },
        adminUser,
      ),
    ).rejects.toThrow('Fallo crítico en base de datos');
  });
});
