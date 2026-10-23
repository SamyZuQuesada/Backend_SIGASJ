import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';

type ValidationBody = { message?: string | string[] };

describe('API POST /solicitudes/afiliacion', () => {
  let app: INestApplication<App>;
  let mockCrear: jest.Mock;

  const payloadValido = {
    fechaSolicitud: '2026-10-23',
    nombre: 'María Elena Rodríguez Vargas',
    identificacion: '01-0234-0567',
    vecinoDe: 'San Juan, 200 m norte de la plaza',
    estadoCivil: 'Casado(a)',
    telefono: '8888-1234',
    correoElectronico: 'maria.rodriguez@ejemplo.com',
    numeroAbonado: '0045892',
    numeroPlano: 'SJ-1234567-2020',
    folioReal: '123456-000',
    firmaSolicitante: 'data:image/png;base64,solicitante',
    recomendacion1Nombre: 'Carlos Alberto Mora Chaves',
    recomendacion1Identificacion: '1-0987-6543',
    recomendacion1NumeroAbonado: '12045',
    recomendacion1Firma: 'data:image/png;base64,rec1',
    recomendacion2Nombre: 'Ana Lucía Vargas Quirós',
    recomendacion2Identificacion: '1-2345-6789',
    recomendacion2NumeroAbonado: '13088',
    recomendacion2Firma: 'data:image/png;base64,rec2',
  };

  beforeAll(async () => {
    mockCrear = jest.fn().mockImplementation((dto: Record<string, unknown>) =>
      Promise.resolve({
        id: 404,
        tipoSolicitudId: 4,
        codigoSeguimiento: 'SOL-2026-00404',
        estado: EstadoSolicitud.PENDIENTE,
        fechaIngreso: new Date(),
        detalleAfiliacion: {
          id: 77,
          solicitudId: 404,
          ...dto,
        },
        tipoSolicitud: {
          id: 4,
          nombre: 'Solicitud de Afiliación',
          slug: TipoSolicitudSlug.AFILIACION,
        },
      }),
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SolicitudesController],
      providers: [
        {
          provide: SolicitudesService,
          useValue: {
            crearSolicitudArregloPago: jest.fn(),
            crearSolicitudCambioTitular: jest.fn(),
            crearSolicitudInfraestructuraLinderos: jest.fn(),
            crearSolicitudAfiliacion: mockCrear,
            findByCodigoSeguimiento: jest.fn(),
            findById: jest.fn(),
            findAll: jest.fn(),
            findAprobadasPendientes: jest.fn(),
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
    mockCrear.mockClear();
  });

  it('1. Registra solicitud válida con ambas recomendaciones (201)', async () => {
    const response = await request(app.getHttpServer())
      .post('/solicitudes/afiliacion')
      .send(payloadValido)
      .expect(201);

    const body = response.body as {
      id: number;
      codigoSeguimiento: string;
      estado: EstadoSolicitud;
      detalleAfiliacion: {
        solicitudId: number;
        nombre: string;
        recomendacion1Nombre: string;
        recomendacion2Nombre: string;
        numeroAbonado: string;
      };
    };
    expect(body.id).toBe(404);
    expect(body.codigoSeguimiento).toBe('SOL-2026-00404');
    expect(body.estado).toBe(EstadoSolicitud.PENDIENTE);
    expect(body.detalleAfiliacion.solicitudId).toBe(404);
    expect(body.detalleAfiliacion.nombre).toBe(payloadValido.nombre);
    expect(body.detalleAfiliacion.recomendacion1Nombre).toBe(
      payloadValido.recomendacion1Nombre,
    );
    expect(body.detalleAfiliacion.recomendacion2Nombre).toBe(
      payloadValido.recomendacion2Nombre,
    );
    expect(body.detalleAfiliacion.numeroAbonado).toBe('0045892');
    expect(mockCrear).toHaveBeenCalled();
  });

  it('2. Rechaza falta de recomendación 1 (400)', async () => {
    const sinRec1 = { ...payloadValido };
    delete (sinRec1 as { recomendacion1Nombre?: string }).recomendacion1Nombre;
    const response = await request(app.getHttpServer())
      .post('/solicitudes/afiliacion')
      .send(sinRec1)
      .expect(400);

    const body = response.body as ValidationBody;
    const messages = Array.isArray(body.message)
      ? body.message
      : [String(body.message ?? '')];
    expect(messages.some((m) => /recomendante 1|recomendacion1/i.test(m))).toBe(
      true,
    );
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('3. Rechaza falta de recomendación 2 (400)', async () => {
    const sinRec2 = { ...payloadValido };
    delete (sinRec2 as { recomendacion2NumeroAbonado?: string })
      .recomendacion2NumeroAbonado;
    const response = await request(app.getHttpServer())
      .post('/solicitudes/afiliacion')
      .send(sinRec2)
      .expect(400);

    const body = response.body as ValidationBody;
    const messages = Array.isArray(body.message)
      ? body.message
      : [String(body.message ?? '')];
    expect(messages.some((m) => /recomendante 2|recomendacion2/i.test(m))).toBe(
      true,
    );
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('4. Rechaza correo inválido (400)', async () => {
    const response = await request(app.getHttpServer())
      .post('/solicitudes/afiliacion')
      .send({ ...payloadValido, correoElectronico: 'correo-malo' })
      .expect(400);

    const body = response.body as ValidationBody;
    const messages = Array.isArray(body.message)
      ? body.message
      : [String(body.message ?? '')];
    expect(messages.some((m) => /correo/i.test(m))).toBe(true);
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('5. Rechaza fecha inválida (400)', async () => {
    await request(app.getHttpServer())
      .post('/solicitudes/afiliacion')
      .send({ ...payloadValido, fechaSolicitud: '23-10-2026' })
      .expect(400);
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('6. Rechaza numeroAbonado vacío (400)', async () => {
    await request(app.getHttpServer())
      .post('/solicitudes/afiliacion')
      .send({ ...payloadValido, numeroAbonado: '' })
      .expect(400);
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('7. Rechaza campos administrativos / Junta Directiva (forbidNonWhitelisted)', async () => {
    const response = await request(app.getHttpServer())
      .post('/solicitudes/afiliacion')
      .send({
        ...payloadValido,
        estado: 'APROBADA',
        solicitudId: 999,
        fechaSesion: '2026-11-01',
        numeroAcuerdo: 'JD-01',
        resultado: 'Aprobada',
        aprobado: true,
        observacionesJunta: 'ok',
        revisadoPor: 'admin',
      })
      .expect(400);

    const body = response.body as ValidationBody;
    const messages = Array.isArray(body.message)
      ? body.message
      : [String(body.message ?? '')];
    expect(messages.some((m) => /should not exist/i.test(m))).toBe(true);
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('8. Acepta sin firmas opcionales (201)', async () => {
    const sinFirmas = { ...payloadValido };
    delete (sinFirmas as { firmaSolicitante?: string }).firmaSolicitante;
    delete (sinFirmas as { recomendacion1Firma?: string }).recomendacion1Firma;
    delete (sinFirmas as { recomendacion2Firma?: string }).recomendacion2Firma;
    delete (sinFirmas as { folioReal?: string }).folioReal;

    await request(app.getHttpServer())
      .post('/solicitudes/afiliacion')
      .send(sinFirmas)
      .expect(201);
    expect(mockCrear).toHaveBeenCalled();
  });
});
