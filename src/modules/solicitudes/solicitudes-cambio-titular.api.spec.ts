import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { CalidadTitularCambioTitular } from '../../common/enums/calidad-titular-cambio-titular.enum';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import { MedioNotificacionCambioTitular } from '../../common/enums/medio-notificacion-cambio-titular.enum';
import { NaturalezaInmuebleCambioTitular } from '../../common/enums/naturaleza-inmueble-cambio-titular.enum';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';

type ValidationBody = { message?: string | string[] };

describe('API POST /solicitudes/cambio-titular', () => {
  let app: INestApplication<App>;
  let mockCrear: jest.Mock;

  const payloadValido = {
    nombreSolicitante: 'Ana Lucía Vargas Quirós',
    identificacionSolicitante: '1-1234-0567',
    telefono: '8888-1234',
    nombrePropietarioRegistral: 'Carlos Alberto Mora Jiménez',
    identificacionPropietario: '1-0987-6543',
    folioReal: '123456-000',
    planoCatastrado: 'SJ-1234567-2020',
    naturalezaInmueble: NaturalezaInmuebleCambioTitular.INSCRITO,
    calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
    nis: 'NIS-45892',
    facturaANombreDe: 'Carlos Alberto Mora Jiménez',
    medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
    medioNotificacionSecundario: MedioNotificacionCambioTitular.TELEFONO,
    firma: 'data:image/png;base64,iVBORw0KGgo...',
  };

  beforeAll(async () => {
    mockCrear = jest.fn().mockImplementation((dto: Record<string, unknown>) =>
      Promise.resolve({
        id: 202,
        tipoSolicitudId: 2,
        codigoSeguimiento: 'SOL-2026-00202',
        estado: EstadoSolicitud.PENDIENTE,
        fechaIngreso: new Date(),
        detalleCambioTitular: {
          id: 88,
          solicitudId: 202,
          ...dto,
        },
        tipoSolicitud: {
          id: 2,
          nombre: 'Cambio de Nombre del Titular del Servicio',
          slug: TipoSolicitudSlug.CAMBIO_TITULAR,
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
            crearSolicitudCambioTitular: mockCrear,
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

  it('1. Registra solicitud válida (201)', async () => {
    const response = await request(app.getHttpServer())
      .post('/solicitudes/cambio-titular')
      .send(payloadValido)
      .expect(201);

    const body = response.body as {
      id: number;
      codigoSeguimiento: string;
      estado: EstadoSolicitud;
      detalleCambioTitular: {
        solicitudId: number;
        nombreSolicitante: string;
        nis: string;
        naturalezaInmueble: string;
        calidadTitular: string;
      };
    };
    expect(body.id).toBe(202);
    expect(body.codigoSeguimiento).toBe('SOL-2026-00202');
    expect(body.estado).toBe(EstadoSolicitud.PENDIENTE);
    expect(body.detalleCambioTitular.solicitudId).toBe(202);
    expect(body.detalleCambioTitular.nombreSolicitante).toBe(
      payloadValido.nombreSolicitante,
    );
    expect(body.detalleCambioTitular.nis).toBe(payloadValido.nis);
    expect(body.detalleCambioTitular.naturalezaInmueble).toBe(
      NaturalezaInmuebleCambioTitular.INSCRITO,
    );
    expect(body.detalleCambioTitular.calidadTitular).toBe(
      CalidadTitularCambioTitular.PROPIETARIO,
    );
    expect(mockCrear).toHaveBeenCalled();
  });

  it('2. Rechaza campos requeridos faltantes (400)', async () => {
    const response = await request(app.getHttpServer())
      .post('/solicitudes/cambio-titular')
      .send({})
      .expect(400);

    const body = response.body as ValidationBody;
    const messages = Array.isArray(body.message)
      ? body.message
      : [String(body.message ?? '')];
    expect(messages.some((m) => m.includes('solicitante'))).toBe(true);
  });

  it('3. Rechaza naturalezaInmueble inválida (400)', async () => {
    const response = await request(app.getHttpServer())
      .post('/solicitudes/cambio-titular')
      .send({ ...payloadValido, naturalezaInmueble: 'Finca espacial' })
      .expect(400);

    expect(JSON.stringify((response.body as ValidationBody).message)).toContain(
      'naturaleza del inmueble no es válida',
    );
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('4. Rechaza calidadTitular inválida (400)', async () => {
    const response = await request(app.getHttpServer())
      .post('/solicitudes/cambio-titular')
      .send({ ...payloadValido, calidadTitular: 'Inquilino inventado' })
      .expect(400);

    expect(JSON.stringify((response.body as ValidationBody).message)).toContain(
      'calidad del titular no es válida',
    );
  });

  it('5. Rechaza medio de notificación inválido (400)', async () => {
    const response = await request(app.getHttpServer())
      .post('/solicitudes/cambio-titular')
      .send({
        ...payloadValido,
        medioNotificacionPrincipal: 'WhatsApp',
      })
      .expect(400);

    expect(JSON.stringify((response.body as ValidationBody).message)).toContain(
      'medio de notificación principal no es válido',
    );
  });

  it('6. Acepta omitir planos y medio secundario', async () => {
    const minimo = {
      nombreSolicitante: payloadValido.nombreSolicitante,
      identificacionSolicitante: payloadValido.identificacionSolicitante,
      telefono: payloadValido.telefono,
      nombrePropietarioRegistral: payloadValido.nombrePropietarioRegistral,
      identificacionPropietario: payloadValido.identificacionPropietario,
      naturalezaInmueble: payloadValido.naturalezaInmueble,
      calidadTitular: payloadValido.calidadTitular,
      nis: payloadValido.nis,
      facturaANombreDe: payloadValido.facturaANombreDe,
      medioNotificacionPrincipal: payloadValido.medioNotificacionPrincipal,
    };

    await request(app.getHttpServer())
      .post('/solicitudes/cambio-titular')
      .send(minimo)
      .expect(201);

    expect(mockCrear).toHaveBeenCalled();
  });

  it('7. Rechaza campos administrativos / desconocidos (forbidNonWhitelisted)', async () => {
    await request(app.getHttpServer())
      .post('/solicitudes/cambio-titular')
      .send({
        ...payloadValido,
        estado: EstadoSolicitud.APROBADA,
        aprobadoPor: 1,
        solicitudId: 999,
        createdAt: '2020-01-01',
      })
      .expect(400);

    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('8. Rechaza identificación vacía (400)', async () => {
    await request(app.getHttpServer())
      .post('/solicitudes/cambio-titular')
      .send({ ...payloadValido, identificacionSolicitante: '   ' })
      .expect(400);

    expect(mockCrear).not.toHaveBeenCalled();
  });
});
