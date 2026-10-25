import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import { SeguimientoSolicitudPublicoDto } from './dto/seguimiento-solicitud-publico.response';
import {
  MENSAJE_SEGUIMIENTO_NO_ENCONTRADO,
  SolicitudSeguimientoNoEncontradaException,
} from './errors/solicitud.errors';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';

type ErrorBody = { message?: string | string[]; statusCode?: number };

describe('API POST /solicitudes/seguimiento (público seguro)', () => {
  let app: INestApplication<App>;
  let mockConsultar: jest.Mock;

  const respuestaPublica: SeguimientoSolicitudPublicoDto = {
    codigoSeguimiento: 'SOL-2026-00001',
    estado: EstadoSolicitud.EN_REVISION,
    fechaIngreso: new Date('2026-10-20T10:00:00Z'),
    tipoSolicitud: {
      nombre: 'Solicitud de Arreglo de Pago Domiciliar',
      slug: 'arreglo-pago',
    },
    historial: [
      {
        fecha: new Date('2026-10-19T10:00:00Z'),
        estadoAnterior: null,
        estadoNuevo: EstadoSolicitud.PENDIENTE,
        observacionPublica: null,
      },
      {
        fecha: new Date('2026-10-21T12:00:00Z'),
        estadoAnterior: EstadoSolicitud.PENDIENTE,
        estadoNuevo: EstadoSolicitud.EN_REVISION,
        observacionPublica: 'Su solicitud está en revisión.',
      },
    ],
  };

  beforeAll(async () => {
    mockConsultar = jest.fn().mockResolvedValue(respuestaPublica);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SolicitudesController],
      providers: [
        {
          provide: SolicitudesService,
          useValue: {
            consultarSeguimientoPublico: mockConsultar,
            findAprobadasPendientes: jest.fn(),
            findByCodigoSeguimiento: jest.fn(),
            findById: jest.fn(),
            findAll: jest.fn(),
            crearSolicitudArregloPago: jest.fn(),
            crearSolicitudCambioTitular: jest.fn(),
            crearSolicitudInfraestructuraLinderos: jest.fn(),
            crearSolicitudAfiliacion: jest.fn(),
            crearSolicitudDisponibilidadServicios: jest.fn(),
            crearSolicitudConstanciaServicio: jest.fn(),
            subirDocumentoSolicitud: jest.fn(),
            actualizarEstado: jest.fn(),
            findHistorialBySolicitudId: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    mockConsultar.mockClear();
    mockConsultar.mockResolvedValue(respuestaPublica);
  });

  it('CASO 1 — combinación válida → datos públicos', async () => {
    const res = await request(app.getHttpServer())
      .post('/solicitudes/seguimiento')
      .send({
        codigo: 'sol-2026-00001',
        identificacion: '1-1234-0567',
      })
      .expect(200);

    expect(mockConsultar).toHaveBeenCalledWith(
      expect.objectContaining({
        codigo: 'SOL-2026-00001',
        identificacion: '1-1234-0567',
      }),
    );
    const body = res.body as SeguimientoSolicitudPublicoDto;
    expect(body.codigoSeguimiento).toBe('SOL-2026-00001');
    expect(body.estado).toBe(EstadoSolicitud.EN_REVISION);
    expect(body.historial).toHaveLength(2);
    expect(JSON.stringify(body)).not.toContain('notaInterna');
    expect(JSON.stringify(body)).not.toContain('idUsuario');
  });

  it('CASO 2 — código real + identificación incorrecta → 404 genérico', async () => {
    mockConsultar.mockRejectedValueOnce(
      new SolicitudSeguimientoNoEncontradaException(),
    );

    const res = await request(app.getHttpServer())
      .post('/solicitudes/seguimiento')
      .send({
        codigo: 'SOL-2026-00001',
        identificacion: '9-9999-9999',
      })
      .expect(404);

    const body = res.body as ErrorBody;
    expect(body.message).toBe(MENSAJE_SEGUIMIENTO_NO_ENCONTRADO);
  });

  it('CASO 3 — código inexistente → mismo 404 genérico', async () => {
    mockConsultar.mockRejectedValueOnce(
      new SolicitudSeguimientoNoEncontradaException(),
    );

    const res = await request(app.getHttpServer())
      .post('/solicitudes/seguimiento')
      .send({
        codigo: 'SOL-2099-99999',
        identificacion: '1-1234-0567',
      })
      .expect(404);

    const body = res.body as ErrorBody;
    expect(body.message).toBe(MENSAJE_SEGUIMIENTO_NO_ENCONTRADO);
  });

  it('código sin identificación → 400 y no llama service', async () => {
    await request(app.getHttpServer())
      .post('/solicitudes/seguimiento')
      .send({ codigo: 'SOL-2026-00001' })
      .expect(400);

    expect(mockConsultar).not.toHaveBeenCalled();
  });

  it('identificación sin código → 400 y no llama service', async () => {
    await request(app.getHttpServer())
      .post('/solicitudes/seguimiento')
      .send({ identificacion: '1-1234-0567' })
      .expect(400);

    expect(mockConsultar).not.toHaveBeenCalled();
  });

  it('campos extras → 400 (forbidNonWhitelisted)', async () => {
    await request(app.getHttpServer())
      .post('/solicitudes/seguimiento')
      .send({
        codigo: 'SOL-2026-00001',
        identificacion: '1-1234-0567',
        usuarioId: 7,
        solicitudId: 1,
        includeInternal: true,
      })
      .expect(400);

    expect(mockConsultar).not.toHaveBeenCalled();
  });

  it('GET por código solo → 404 genérico (sin datos)', async () => {
    const res = await request(app.getHttpServer())
      .get('/solicitudes/seguimiento/SOL-2026-00001')
      .expect(404);

    const body = res.body as ErrorBody;
    expect(body.message).toBe(MENSAJE_SEGUIMIENTO_NO_ENCONTRADO);
    expect(mockConsultar).not.toHaveBeenCalled();
  });

  it('CASO 2 y CASO 3 tienen misma estructura informativa', async () => {
    mockConsultar.mockRejectedValue(
      new SolicitudSeguimientoNoEncontradaException(),
    );

    const a = await request(app.getHttpServer())
      .post('/solicitudes/seguimiento')
      .send({ codigo: 'SOL-2099-99999', identificacion: '1-1111-1111' })
      .expect(404);

    const b = await request(app.getHttpServer())
      .post('/solicitudes/seguimiento')
      .send({ codigo: 'SOL-2026-00001', identificacion: '9-9999-9999' })
      .expect(404);

    const bodyA = a.body as ErrorBody;
    const bodyB = b.body as ErrorBody;
    expect(a.status).toBe(b.status);
    expect(bodyA.message).toBe(bodyB.message);
    expect(Object.keys(bodyA).sort()).toEqual(Object.keys(bodyB).sort());
  });
});
