import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { CalidadTitularCambioTitular } from '../../common/enums/calidad-titular-cambio-titular.enum';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import { MedioNotificacionCambioTitular } from '../../common/enums/medio-notificacion-cambio-titular.enum';
import { MotivoConstanciaServicio } from '../../common/enums/motivo-constancia-servicio.enum';
import { NaturalezaInmuebleCambioTitular } from '../../common/enums/naturaleza-inmueble-cambio-titular.enum';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';

type ValidationBody = { message?: string | string[] };

describe('API POST /solicitudes/servicio-existente (Constancia de Servicio Existente)', () => {
  let app: INestApplication<App>;
  let mockCrear: jest.Mock;

  const payloadValido = {
    tipoServicio: 'Domiciliar',
    nis: 'NIS-45892',
    propietarioInmueble: 'María Elena Rodríguez Vargas',
    nombreSolicitante: 'Carlos Alberto Mora Jiménez',
    identificacionSolicitante: '1-1234-0567',
    correoElectronico: 'carlos.mora@ejemplo.com',
    telefono: '8888-1234',
    folioReal: '123456-000',
    planoCatastrado: 'SJ-1234567-2020',
    planoAgrimensura: 'AG-998877-2019',
    naturalezaInmueble: NaturalezaInmuebleCambioTitular.INSCRITO,
    calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
    provincia: 'San José',
    canton: 'Pérez Zeledón',
    distrito: 'San Isidro de El General',
    direccionExacta: '100 m norte de la iglesia, casa blanca esquinera',
    motivo: MotivoConstanciaServicio.BONO_VIVIENDA,
    tramitePorRealizar: 'Solicitud de bono de vivienda BANHVI',
    medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
    medioNotificacionSecundario: MedioNotificacionCambioTitular.TELEFONO,
    firma: 'data:image/png;base64,iVBORw0KGgo...',
  };

  beforeAll(async () => {
    mockCrear = jest.fn().mockImplementation((dto: Record<string, unknown>) =>
      Promise.resolve({
        id: 601,
        tipoSolicitudId: 6,
        codigoSeguimiento: 'SOL-2026-SERV01',
        estado: EstadoSolicitud.PENDIENTE,
        fechaIngreso: new Date(),
        detalleConstanciaServicio: {
          id: 99,
          solicitudId: 601,
          ...dto,
        },
        tipoSolicitud: {
          id: 6,
          nombre: 'Constancia de Servicio Existente',
          slug: TipoSolicitudSlug.SERVICIO_EXISTENTE,
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
            crearSolicitudDisponibilidadServicios: jest.fn(),
            crearSolicitudConstanciaServicio: mockCrear,
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

  it('1. Registra solicitud válida con motivo estándar en /solicitudes/servicio-existente (201)', async () => {
    const response = await request(app.getHttpServer())
      .post('/solicitudes/servicio-existente')
      .send(payloadValido)
      .expect(201);

    expect(mockCrear).toHaveBeenCalledTimes(1);
    expect(response.body).toMatchObject({
      id: 601,
      codigoSeguimiento: 'SOL-2026-SERV01',
      estado: EstadoSolicitud.PENDIENTE,
      detalleConstanciaServicio: expect.objectContaining({
        tipoServicio: 'Domiciliar',
        nis: 'NIS-45892',
        propietarioInmueble: 'María Elena Rodríguez Vargas',
        motivo: MotivoConstanciaServicio.BONO_VIVIENDA,
      }),
    });
  });

  it('2. Registra solicitud válida en alias /solicitudes/constancia-servicio (201)', async () => {
    const response = await request(app.getHttpServer())
      .post('/solicitudes/constancia-servicio')
      .send(payloadValido)
      .expect(201);

    expect(mockCrear).toHaveBeenCalledTimes(1);
    expect(response.body.codigoSeguimiento).toBe('SOL-2026-SERV01');
  });

  it('3. Acepta motivo "Otro" cuando se incluye descripción en otroMotivo (201)', async () => {
    const payloadOtro = {
      ...payloadValido,
      motivo: MotivoConstanciaServicio.OTRO,
      otroMotivo: 'Trámite especial ante IMAS para subsidio familiar',
    };

    const response = await request(app.getHttpServer())
      .post('/solicitudes/servicio-existente')
      .send(payloadOtro)
      .expect(201);

    expect(mockCrear).toHaveBeenCalledWith(
      expect.objectContaining({
        motivo: MotivoConstanciaServicio.OTRO,
        otroMotivo: 'Trámite especial ante IMAS para subsidio familiar',
      }),
    );
    expect(response.body.detalleConstanciaServicio.otroMotivo).toBe(
      'Trámite especial ante IMAS para subsidio familiar',
    );
  });

  it('4. Exige descripción (400) cuando el motivo es "Otro" y falta otroMotivo', async () => {
    const payloadSinOtroMotivo = {
      ...payloadValido,
      motivo: MotivoConstanciaServicio.OTRO,
    };

    const response = await request(app.getHttpServer())
      .post('/solicitudes/servicio-existente')
      .send(payloadSinOtroMotivo)
      .expect(400);

    const body = response.body as ValidationBody;
    const errors = Array.isArray(body.message) ? body.message : [body.message];
    expect(
      errors.some((m) =>
        m?.includes(
          'Debe especificar el motivo cuando selecciona la opción Otro',
        ),
      ),
    ).toBe(true);
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('5. Exige descripción (400) cuando otroMotivo viene con espacios en blanco', async () => {
    const payloadEspacios = {
      ...payloadValido,
      motivo: MotivoConstanciaServicio.OTRO,
      otroMotivo: '    ',
    };

    const response = await request(app.getHttpServer())
      .post('/solicitudes/servicio-existente')
      .send(payloadEspacios)
      .expect(400);

    const body = response.body as ValidationBody;
    const errors = Array.isArray(body.message) ? body.message : [body.message];
    expect(
      errors.some((m) =>
        m?.includes(
          'Debe especificar el motivo cuando selecciona la opción Otro',
        ),
      ),
    ).toBe(true);
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('6. Rechaza motivo inexistente o inválido (400)', async () => {
    const payloadInvalido = {
      ...payloadValido,
      motivo: 'Motivo No Catalogado',
    };

    const response = await request(app.getHttpServer())
      .post('/solicitudes/servicio-existente')
      .send(payloadInvalido)
      .expect(400);

    const body = response.body as ValidationBody;
    const errors = Array.isArray(body.message) ? body.message : [body.message];
    expect(errors.some((m) => m?.includes('El motivo no es válido'))).toBe(
      true,
    );
  });

  it('7. Acepta omitir campos opcionales del inmueble y trámite (201)', async () => {
    const payloadMinimo = {
      tipoServicio: 'Domiciliar',
      nis: 'NIS-45892',
      propietarioInmueble: 'María Elena Rodríguez Vargas',
      nombreSolicitante: 'Carlos Alberto Mora Jiménez',
      identificacionSolicitante: '1-1234-0567',
      correoElectronico: 'carlos.mora@ejemplo.com',
      telefono: '8888-1234',
      naturalezaInmueble: NaturalezaInmuebleCambioTitular.INSCRITO,
      calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
      provincia: 'San José',
      canton: 'Pérez Zeledón',
      distrito: 'San Isidro de El General',
      direccionExacta: '100 m norte de la iglesia',
      motivo: MotivoConstanciaServicio.TRAMITE_BANCARIO,
      medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
    };

    await request(app.getHttpServer())
      .post('/solicitudes/servicio-existente')
      .send(payloadMinimo)
      .expect(201);

    expect(mockCrear).toHaveBeenCalledTimes(1);
  });

  it('8. Rechaza campos obligatorios ausentes (400)', async () => {
    const response = await request(app.getHttpServer())
      .post('/solicitudes/servicio-existente')
      .send({})
      .expect(400);

    const body = response.body as ValidationBody;
    const errors = Array.isArray(body.message) ? body.message : [body.message];

    expect(
      errors.some((m) => m?.includes('El tipo de servicio es obligatorio')),
    ).toBe(true);
    expect(errors.some((m) => m?.includes('El NIS es obligatorio'))).toBe(true);
    expect(
      errors.some((m) =>
        m?.includes('El nombre del propietario del inmueble es obligatorio'),
      ),
    ).toBe(true);
    expect(
      errors.some((m) =>
        m?.includes('El nombre del solicitante es obligatorio'),
      ),
    ).toBe(true);
    expect(
      errors.some((m) =>
        m?.includes('La identificación del solicitante es obligatoria'),
      ),
    ).toBe(true);
    expect(
      errors.some((m) => m?.includes('El correo electrónico es obligatorio')),
    ).toBe(true);
    expect(errors.some((m) => m?.includes('El teléfono es obligatorio'))).toBe(
      true,
    );
    expect(
      errors.some((m) =>
        m?.includes('La naturaleza del inmueble es obligatoria'),
      ),
    ).toBe(true);
    expect(
      errors.some((m) => m?.includes('La calidad del titular es obligatoria')),
    ).toBe(true);
    expect(errors.some((m) => m?.includes('La provincia es obligatoria'))).toBe(
      true,
    );
    expect(errors.some((m) => m?.includes('El cantón es obligatorio'))).toBe(
      true,
    );
    expect(errors.some((m) => m?.includes('El distrito es obligatorio'))).toBe(
      true,
    );
    expect(
      errors.some((m) => m?.includes('La dirección exacta es obligatoria')),
    ).toBe(true);
    expect(errors.some((m) => m?.includes('El motivo es obligatorio'))).toBe(
      true,
    );
    expect(
      errors.some((m) =>
        m?.includes('El medio de notificación principal es obligatorio'),
      ),
    ).toBe(true);
  });

  it('9. Rechaza campos administrativos inyectados en el body (400 por whitelist)', async () => {
    const payloadInyeccion = {
      ...payloadValido,
      estado: EstadoSolicitud.APROBADA,
      codigoSeguimiento: 'SOL-HACKED-999',
    };

    const response = await request(app.getHttpServer())
      .post('/solicitudes/servicio-existente')
      .send(payloadInyeccion)
      .expect(400);

    const body = response.body as ValidationBody;
    const errors = Array.isArray(body.message) ? body.message : [body.message];
    expect(
      errors.some(
        (m) => m?.includes('should not exist') || m?.includes('estado'),
      ),
    ).toBe(true);
  });
});
