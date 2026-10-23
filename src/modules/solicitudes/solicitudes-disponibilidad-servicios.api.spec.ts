import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { CalidadTitularCambioTitular } from '../../common/enums/calidad-titular-cambio-titular.enum';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import { MedioNotificacionCambioTitular } from '../../common/enums/medio-notificacion-cambio-titular.enum';
import { NaturalezaInmuebleCambioTitular } from '../../common/enums/naturaleza-inmueble-cambio-titular.enum';
import { PropositoDisponibilidadServiciosConfirmado } from '../../common/enums/proposito-disponibilidad-servicios.enum';
import { TipoPersonaDisponibilidadServicios } from '../../common/enums/tipo-persona-disponibilidad-servicios.enum';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';

type ValidationBody = { message?: string | string[] };

describe('API POST /solicitudes/disponibilidad-servicios', () => {
  let app: INestApplication<App>;
  let mockCrear: jest.Mock;

  const documentosBase = [
    { id: 1, tokenReclamo: 'token-identificacion-001' },
    { id: 2, tokenReclamo: 'token-plano-catastrado-002' },
  ];

  const payloadFisica = {
    tipoPersona: TipoPersonaDisponibilidadServicios.FISICA,
    nombreFisica: 'María Elena',
    primerApellidoFisica: 'Rodríguez',
    segundoApellidoFisica: 'Vargas',
    identificacionFisica: '1-1234-0567',
    telefonoFisica: '8888-1234',
    medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
    valorNotificacionPrincipal: 'maria@ejemplo.com',
    provincia: 'San José',
    canton: 'Pérez Zeledón',
    distrito: 'San Isidro de El General',
    direccionExacta: '100 m norte de la iglesia',
    planoCatastrado: 'SJ-1234567-2020',
    naturalezaInmueble: NaturalezaInmuebleCambioTitular.INSCRITO,
    calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
    proposito: PropositoDisponibilidadServiciosConfirmado.FRACCIONAMIENTO,
    descripcionProyecto: 'Construcción de 4 unidades habitacionales',
    cantidadDormitorios: 3,
    unidadesHabitacionales: 4,
    areaConstruccion: 185.5,
    niveles: 2,
    caudalRequerido: 0.75,
    autorizacionInspeccion: true,
    firma: 'data:image/png;base64,iVBORw0KGgo...',
    documentos: documentosBase,
  };

  beforeAll(async () => {
    mockCrear = jest.fn().mockImplementation((dto: Record<string, unknown>) =>
      Promise.resolve({
        id: 505,
        tipoSolicitudId: 5,
        codigoSeguimiento: 'SOL-2026-00505',
        estado: EstadoSolicitud.PENDIENTE,
        fechaIngreso: new Date(),
        detalleDisponibilidadServicios: {
          id: 77,
          solicitudId: 505,
          ...dto,
        },
        tipoSolicitud: {
          id: 5,
          nombre: 'Constancia de Disponibilidad de Servicios',
          slug: TipoSolicitudSlug.DISPONIBILIDAD_SERVICIOS,
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
            crearSolicitudAfiliacion: jest.fn(),
            crearSolicitudDisponibilidadServicios: mockCrear,
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

  it('1. Registra persona física válida (201)', async () => {
    const response = await request(app.getHttpServer())
      .post('/solicitudes/disponibilidad-servicios')
      .send(payloadFisica)
      .expect(201);

    const body = response.body as {
      id: number;
      codigoSeguimiento: string;
      estado: EstadoSolicitud;
      detalleDisponibilidadServicios: {
        solicitudId: number;
        proposito: string;
        descripcionProyecto: string;
      };
    };
    expect(body.id).toBe(505);
    expect(body.codigoSeguimiento).toBe('SOL-2026-00505');
    expect(body.estado).toBe(EstadoSolicitud.PENDIENTE);
    expect(body.detalleDisponibilidadServicios.proposito).toBe(
      PropositoDisponibilidadServiciosConfirmado.FRACCIONAMIENTO,
    );
    expect(mockCrear).toHaveBeenCalled();
  });

  it.each(Object.values(PropositoDisponibilidadServiciosConfirmado))(
    '2. Happy path por propósito "%s" (201)',
    async (proposito) => {
      const docs =
        proposito ===
        PropositoDisponibilidadServiciosConfirmado.ESTACION_COMBUSTIBLE
          ? [...documentosBase, { id: 3, tokenReclamo: 'token-poder-003' }]
          : documentosBase;

      await request(app.getHttpServer())
        .post('/solicitudes/disponibilidad-servicios')
        .send({ ...payloadFisica, proposito, documentos: docs })
        .expect(201);

      expect(mockCrear).toHaveBeenCalled();
    },
  );

  it('3. Rechaza descripción de proyecto ausente (400)', async () => {
    const sinDesc = { ...payloadFisica };
    delete (sinDesc as { descripcionProyecto?: string }).descripcionProyecto;

    const response = await request(app.getHttpServer())
      .post('/solicitudes/disponibilidad-servicios')
      .send(sinDesc)
      .expect(400);

    expect(JSON.stringify((response.body as ValidationBody).message)).toMatch(
      /descripción del proyecto/i,
    );
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('4. Rechaza propósito inválido (400)', async () => {
    const response = await request(app.getHttpServer())
      .post('/solicitudes/disponibilidad-servicios')
      .send({ ...payloadFisica, proposito: 'Ampliación inventada' })
      .expect(400);

    expect(JSON.stringify((response.body as ValidationBody).message)).toContain(
      'propósito no es válido',
    );
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('5. Rechaza naturaleza inválida (400)', async () => {
    await request(app.getHttpServer())
      .post('/solicitudes/disponibilidad-servicios')
      .send({ ...payloadFisica, naturalezaInmueble: 'Espacial' })
      .expect(400);
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('6. Rechaza campos administrativos (forbidNonWhitelisted) (400)', async () => {
    await request(app.getHttpServer())
      .post('/solicitudes/disponibilidad-servicios')
      .send({
        ...payloadFisica,
        estado: EstadoSolicitud.APROBADA,
        solicitudId: 999,
        revisadoPor: 'admin',
      })
      .expect(400);
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('7. Rechaza sin documentos (400)', async () => {
    await request(app.getHttpServer())
      .post('/solicitudes/disponibilidad-servicios')
      .send({ ...payloadFisica, documentos: [] })
      .expect(400);
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('8. Rechaza persona física sin identificación (400)', async () => {
    const sinId = { ...payloadFisica };
    delete (sinId as { identificacionFisica?: string }).identificacionFisica;
    await request(app.getHttpServer())
      .post('/solicitudes/disponibilidad-servicios')
      .send(sinId)
      .expect(400);
    expect(mockCrear).not.toHaveBeenCalled();
  });
});
