import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { CalidadTitularCambioTitular } from '../../common/enums/calidad-titular-cambio-titular.enum';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import { MedioNotificacionCambioTitular } from '../../common/enums/medio-notificacion-cambio-titular.enum';
import { PropositoInfraestructuraLinderosConfirmado } from '../../common/enums/proposito-infraestructura-linderos.enum';
import { TipoPersonaInfraestructuraLinderos } from '../../common/enums/tipo-persona-infraestructura-linderos.enum';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';

type ValidationBody = { message?: string | string[] };

describe('API POST /solicitudes/infraestructura-linderos', () => {
  let app: INestApplication<App>;
  let mockCrear: jest.Mock;

  const documentosReunion = [
    { id: 1, tokenReclamo: 'token-identificacion-001' },
    { id: 2, tokenReclamo: 'token-plano-catastrado-002' },
    { id: 3, tokenReclamo: 'token-plano-agrimensura-003' },
  ];

  const payloadFisica = {
    nis: 'NIS-77881',
    tipoPersona: TipoPersonaInfraestructuraLinderos.FISICA,
    nombreFisica: 'María Elena',
    apellidosFisica: 'Rodríguez Vargas',
    identificacionFisica: '1-1234-0567',
    telefonoFisica: '8888-1234',
    calidadTitular: CalidadTitularCambioTitular.PROPIETARIO,
    provincia: 'San José',
    canton: 'Pérez Zeledón',
    distrito: 'San Isidro de El General',
    direccionExacta: '100 m norte de la iglesia',
    folioReal: '123456-000',
    planoCatastrado: 'SJ-1234567-2020',
    planoAgrimensura: 'AG-998877-2019',
    proposito: PropositoInfraestructuraLinderosConfirmado.REUNION_FINCAS,
    medioNotificacionPrincipal: MedioNotificacionCambioTitular.CORREO,
    valorNotificacionPrincipal: 'maria@ejemplo.com',
    medioNotificacionSecundario: MedioNotificacionCambioTitular.TELEFONO,
    valorNotificacionSecundario: '8888-1234',
    firma: 'data:image/png;base64,iVBORw0KGgo...',
    documentos: documentosReunion,
  };

  const payloadJuridica = {
    nis: 'NIS-99001',
    tipoPersona: TipoPersonaInfraestructuraLinderos.JURIDICA,
    razonSocial: 'Inversiones del Valle S.A.',
    cedulaJuridica: '3-101-123456',
    nombreRepresentante: 'Luis Alberto Mora Chaves',
    identificacionRepresentante: '1-0987-6543',
    telefonoRepresentante: '8777-4321',
    calidadTitular: CalidadTitularCambioTitular.REPRESENTANTE_LEGAL,
    provincia: 'San José',
    canton: 'Pérez Zeledón',
    distrito: 'Daniel Flores',
    direccionExacta: 'Frente a la escuela',
    planoCatastrado: 'SJ-999',
    planoAgrimensura: 'AG-111',
    proposito: PropositoInfraestructuraLinderosConfirmado.REUNION_FINCAS,
    medioNotificacionPrincipal: MedioNotificacionCambioTitular.TELEFONO,
    documentos: documentosReunion,
  };

  beforeAll(async () => {
    mockCrear = jest.fn().mockImplementation((dto: Record<string, unknown>) =>
      Promise.resolve({
        id: 303,
        tipoSolicitudId: 3,
        codigoSeguimiento: 'SOL-2026-00303',
        estado: EstadoSolicitud.PENDIENTE,
        fechaIngreso: new Date(),
        detalleInfraestructuraLinderos: {
          id: 55,
          solicitudId: 303,
          ...dto,
        },
        tipoSolicitud: {
          id: 3,
          nombre:
            'Constancia de Infraestructura Frente a Linderos de un Inmueble',
          slug: TipoSolicitudSlug.INFRAESTRUCTURA_LINDEROS,
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
            crearSolicitudInfraestructuraLinderos: mockCrear,
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
      .post('/solicitudes/infraestructura-linderos')
      .send(payloadFisica)
      .expect(201);

    const body = response.body as {
      id: number;
      codigoSeguimiento: string;
      estado: EstadoSolicitud;
      detalleInfraestructuraLinderos: {
        solicitudId: number;
        nis: string;
        tipoPersona: string;
        proposito: string;
      };
    };
    expect(body.id).toBe(303);
    expect(body.codigoSeguimiento).toBe('SOL-2026-00303');
    expect(body.estado).toBe(EstadoSolicitud.PENDIENTE);
    expect(body.detalleInfraestructuraLinderos.solicitudId).toBe(303);
    expect(body.detalleInfraestructuraLinderos.nis).toBe(payloadFisica.nis);
    expect(body.detalleInfraestructuraLinderos.tipoPersona).toBe(
      TipoPersonaInfraestructuraLinderos.FISICA,
    );
    expect(body.detalleInfraestructuraLinderos.proposito).toBe(
      PropositoInfraestructuraLinderosConfirmado.REUNION_FINCAS,
    );
    expect(mockCrear).toHaveBeenCalled();
  });

  it('2. Registra persona jurídica válida (201)', async () => {
    await request(app.getHttpServer())
      .post('/solicitudes/infraestructura-linderos')
      .send(payloadJuridica)
      .expect(201);

    expect(mockCrear).toHaveBeenCalledWith(
      expect.objectContaining({
        tipoPersona: TipoPersonaInfraestructuraLinderos.JURIDICA,
        razonSocial: payloadJuridica.razonSocial,
      }),
    );
  });

  it('3. Rechaza campos requeridos faltantes (400)', async () => {
    const response = await request(app.getHttpServer())
      .post('/solicitudes/infraestructura-linderos')
      .send({})
      .expect(400);

    const body = response.body as ValidationBody;
    const messages = Array.isArray(body.message)
      ? body.message
      : [String(body.message ?? '')];
    expect(messages.some((m) => /NIS|nis|obligatorio/i.test(m))).toBe(true);
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('3b. INFRA-QA-001 — rechaza sin referencias de documentos (400)', async () => {
    await request(app.getHttpServer())
      .post('/solicitudes/infraestructura-linderos')
      .send({ ...payloadFisica, documentos: [] })
      .expect(400);

    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('4. Rechaza NIS vacío (400)', async () => {
    await request(app.getHttpServer())
      .post('/solicitudes/infraestructura-linderos')
      .send({ ...payloadFisica, nis: '   ' })
      .expect(400);

    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('5. Rechaza persona física sin identificación (400)', async () => {
    const sinId = { ...payloadFisica };
    delete (sinId as { identificacionFisica?: string }).identificacionFisica;
    await request(app.getHttpServer())
      .post('/solicitudes/infraestructura-linderos')
      .send(sinId)
      .expect(400);

    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('6. Rechaza persona jurídica sin cédula jurídica (400)', async () => {
    const sinCedula = { ...payloadJuridica };
    delete (sinCedula as { cedulaJuridica?: string }).cedulaJuridica;
    await request(app.getHttpServer())
      .post('/solicitudes/infraestructura-linderos')
      .send(sinCedula)
      .expect(400);

    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('7. Rechaza propósito inválido (400)', async () => {
    const response = await request(app.getHttpServer())
      .post('/solicitudes/infraestructura-linderos')
      .send({ ...payloadFisica, proposito: 'Ampliación inventada' })
      .expect(400);

    expect(JSON.stringify((response.body as ValidationBody).message)).toContain(
      'propósito no es válido',
    );
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('8. Rechaza Reunión de fincas sin planoAgrimensura (400)', async () => {
    const sinPlano = { ...payloadFisica };
    delete (sinPlano as { planoAgrimensura?: string }).planoAgrimensura;
    const response = await request(app.getHttpServer())
      .post('/solicitudes/infraestructura-linderos')
      .send(sinPlano)
      .expect(400);

    expect(JSON.stringify((response.body as ValidationBody).message)).toMatch(
      /agrimensura/i,
    );
    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('9. Acepta omitir folio y medio secundario (opcionales)', async () => {
    const minimo = {
      nis: payloadFisica.nis,
      tipoPersona: payloadFisica.tipoPersona,
      nombreFisica: payloadFisica.nombreFisica,
      apellidosFisica: payloadFisica.apellidosFisica,
      identificacionFisica: payloadFisica.identificacionFisica,
      telefonoFisica: payloadFisica.telefonoFisica,
      calidadTitular: payloadFisica.calidadTitular,
      provincia: payloadFisica.provincia,
      canton: payloadFisica.canton,
      distrito: payloadFisica.distrito,
      direccionExacta: payloadFisica.direccionExacta,
      planoCatastrado: payloadFisica.planoCatastrado,
      planoAgrimensura: payloadFisica.planoAgrimensura,
      proposito: payloadFisica.proposito,
      medioNotificacionPrincipal: payloadFisica.medioNotificacionPrincipal,
      documentos: payloadFisica.documentos,
    };

    await request(app.getHttpServer())
      .post('/solicitudes/infraestructura-linderos')
      .send(minimo)
      .expect(201);

    expect(mockCrear).toHaveBeenCalled();
  });

  it('10. Rechaza medio de notificación inválido (400)', async () => {
    await request(app.getHttpServer())
      .post('/solicitudes/infraestructura-linderos')
      .send({
        ...payloadFisica,
        medioNotificacionPrincipal: 'WhatsApp',
      })
      .expect(400);

    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('11. Rechaza calidadTitular inválida (400)', async () => {
    await request(app.getHttpServer())
      .post('/solicitudes/infraestructura-linderos')
      .send({ ...payloadFisica, calidadTitular: 'Dueño inventado' })
      .expect(400);

    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('12. Rechaza campos administrativos (forbidNonWhitelisted)', async () => {
    await request(app.getHttpServer())
      .post('/solicitudes/infraestructura-linderos')
      .send({
        ...payloadFisica,
        estado: EstadoSolicitud.APROBADA,
        aprobadoPor: 1,
        solicitudId: 999,
        createdAt: '2020-01-01',
      })
      .expect(400);

    expect(mockCrear).not.toHaveBeenCalled();
  });

  it('13. Rechaza ubicación vacía (400)', async () => {
    await request(app.getHttpServer())
      .post('/solicitudes/infraestructura-linderos')
      .send({ ...payloadFisica, distrito: '   ' })
      .expect(400);

    expect(mockCrear).not.toHaveBeenCalled();
  });
});
