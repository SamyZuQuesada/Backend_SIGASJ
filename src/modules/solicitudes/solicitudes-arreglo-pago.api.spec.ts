import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { EstadoSolicitud } from '../../common/enums/estado-solicitud.enum';
import { PlazoArregloPago } from '../../common/enums/plazo-arreglo-pago.enum';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';

describe('API POST /solicitudes/arreglo-pago', () => {
  let app: INestApplication<App>;
  let mockCrearSolicitudArregloPago: jest.Mock;

  const payloadValido = {
    nombre: 'Ana María Alvarado Campos',
    cedula: '1-0852-0963',
    vecinoDe: 'San Juan de Desamparados, costado sur del Ebais',
    telefono: '8333-2211',
    numeroCuentaServicio: 'CTA-55441',
    montoPrimaInicial: 25000,
    plazoSeleccionado: PlazoArregloPago.MESES_12,
    firma: 'data:image/png;base64,iVBORw0KGgo...',
  };

  beforeAll(async () => {
    mockCrearSolicitudArregloPago = jest.fn().mockImplementation((dto) => {
      return Promise.resolve({
        id: 101,
        tipoSolicitudId: 1,
        codigoSeguimiento: 'SOL-2026-00101',
        estado: EstadoSolicitud.PENDIENTE,
        fechaIngreso: new Date(),
        detalleArregloPago: {
          id: 55,
          solicitudId: 101,
          ...dto,
        },
        tipoSolicitud: {
          id: 1,
          nombre: 'Solicitud de Arreglo de Pago Domiciliar',
          slug: TipoSolicitudSlug.ARREGLO_PAGO,
        },
      });
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [SolicitudesController],
      providers: [
        {
          provide: SolicitudesService,
          useValue: {
            crearSolicitudArregloPago: mockCrearSolicitudArregloPago,
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
    mockCrearSolicitudArregloPago.mockClear();
  });

  it('1. Debe registrar exitosamente una solicitud con todos los campos oficiales (201 Created)', async () => {
    const response = await request(app.getHttpServer())
      .post('/solicitudes/arreglo-pago')
      .send(payloadValido)
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        id: 101,
        codigoSeguimiento: 'SOL-2026-00101',
        estado: EstadoSolicitud.PENDIENTE,
        detalleArregloPago: expect.objectContaining({
          solicitudId: 101,
          nombre: payloadValido.nombre,
          cedula: payloadValido.cedula,
          vecinoDe: payloadValido.vecinoDe,
          numeroCuentaServicio: payloadValido.numeroCuentaServicio,
          montoPrimaInicial: 25000,
          plazoSeleccionado: PlazoArregloPago.MESES_12,
        }),
      }),
    );
    expect(mockCrearSolicitudArregloPago).toHaveBeenCalled();
  });

  it('2. Debe rechazar con 400 Bad Request cuando faltan campos requeridos (nombre, cedula, telefono, etc.)', async () => {
    const response = await request(app.getHttpServer())
      .post('/solicitudes/arreglo-pago')
      .send({})
      .expect(400);

    const messages = response.body.message;
    expect(Array.isArray(messages)).toBe(true);
    expect(messages.some((m: string) => m.includes('nombre'))).toBe(true);
    expect(messages.some((m: string) => m.includes('cédula'))).toBe(true);
    expect(messages.some((m: string) => m.includes('vecinoDe'))).toBe(true);
    expect(messages.some((m: string) => m.includes('teléfono'))).toBe(true);
    expect(messages.some((m: string) => m.includes('cuenta'))).toBe(true);
    expect(messages.some((m: string) => m.includes('prima inicial'))).toBe(true);
    expect(messages.some((m: string) => m.includes('plazo seleccionado'))).toBe(
      true,
    );
  });

  it('3. Debe rechazar con 400 Bad Request si el plazo seleccionado no es una opción oficial permitida', async () => {
    const response = await request(app.getHttpServer())
      .post('/solicitudes/arreglo-pago')
      .send({
        ...payloadValido,
        plazoSeleccionado: '36 meses',
      })
      .expect(400);

    const messageStr = JSON.stringify(response.body.message);
    expect(messageStr).toContain('El plazo seleccionado no es válido');
    expect(messageStr).toContain('Opciones permitidas');
  });

  it('4. Debe rechazar con 400 Bad Request si la prima inicial es negativa', async () => {
    const response = await request(app.getHttpServer())
      .post('/solicitudes/arreglo-pago')
      .send({
        ...payloadValido,
        montoPrimaInicial: -100,
      })
      .expect(400);

    const messageStr = JSON.stringify(response.body.message);
    expect(messageStr).toContain('no puede ser negativo');
  });

  it('5. Debe rechazar campos no reconocidos en el cuerpo de la petición (forbidNonWhitelisted)', async () => {
    await request(app.getHttpServer())
      .post('/solicitudes/arreglo-pago')
      .send({
        ...payloadValido,
        campoInexistente: 'hack',
      })
      .expect(400);
  });
});
