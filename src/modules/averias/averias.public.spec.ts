import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { QueryFailedError, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AveriasModule } from './averias.module';
import { AveriasService } from './averias.service';
import { Averia } from './entities/averia.entity';

const payloadMinimo = {
  nombreReportante: 'María Rodríguez',
  telefonoReportante: '8888-8888',
  ubicacion: 'Frente a la escuela, 50 m sur, casa verde',
  sectorComunidad: 'San Juan',
  descripcion: 'Se observa una fuga visible en la tubería de distribución',
};

type PublicResponse = {
  statusCode?: number;
  message?: string | string[];
  data?: {
    codigoSeguimiento?: string;
    fechaReporte?: string;
    estado?: string;
  };
};

describe('POST /api/v1/public/averias — registro público', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let averias: Repository<Averia>;
  let service: AveriasService;

  const postAveria = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/api/v1/public/averias').send(body);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs',
          autoSave: false,
          dropSchema: true,
          entities: [Averia, Usuario],
          synchronize: true,
        }),
        AveriasModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    averias = moduleFixture.get(getRepositoryToken(Averia));
    service = moduleFixture.get(AveriasService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await averias.clear();
  });

  it('registra un reporte mínimo, genera código/fecha y deja estado Recibida', async () => {
    const before = new Date();
    const response = await postAveria(payloadMinimo);
    const body = response.body as PublicResponse;

    expect(response.status).toBe(201);
    expect(body.message).toBe('Avería registrada correctamente.');
    expect(body.data?.codigoSeguimiento).toMatch(/^AV-\d{4}-\d{4}$/);
    expect(body.data?.estado).toBe('Recibida');
    expect(body.data?.fechaReporte).toBeDefined();

    const persistida = await averias.findOneBy({
      codigoSeguimiento: body.data?.codigoSeguimiento,
    });
    expect(persistida).toBeDefined();
    expect(persistida?.estado).toBe(EstadoAveria.RECIBIDA);
    expect(persistida?.fechaReporte.getTime()).toBeGreaterThanOrEqual(
      before.getTime() - 1000,
    );
    expect(persistida?.idAbonado).toBeNull();
    expect(persistida?.idFontaneroAsignado).toBeNull();
    expect(persistida?.tipoAveria).toBeNull();
    expect(persistida?.prioridad).toBeNull();
    expect(persistida?.fechaAsignacion).toBeNull();
    expect(persistida?.fechaInicioAtencion).toBeNull();
    expect(persistida?.fechaResolucion).toBeNull();
    expect(persistida?.observacionesAtencion).toBeNull();
  });

  it('es público: crea la avería sin JWT y con Abonado nulo', async () => {
    const response = await postAveria(payloadMinimo).expect(201);
    const body = response.body as PublicResponse;
    const persistida = await averias.findOneBy({
      codigoSeguimiento: body.data?.codigoSeguimiento,
    });
    expect(persistida?.idAbonado).toBeNull();
    expect(persistida?.nombreReportante).toBe('María Rodríguez');
  });

  it('acepta identificación y correo omitidos, y correo válido', async () => {
    const sinOpcionales = await postAveria(payloadMinimo).expect(201);
    expect(sinOpcionales.body).toMatchObject({
      data: { estado: 'Recibida' },
    });

    const conCorreo = await postAveria({
      ...payloadMinimo,
      identificacionReportante: '1-2345-6789',
      correoReportante: 'maria@example.com',
    }).expect(201);
    const body = conCorreo.body as PublicResponse;
    const persistida = await averias.findOneBy({
      codigoSeguimiento: body.data?.codigoSeguimiento,
    });
    expect(persistida?.identificacionReportante).toBe('1-2345-6789');
    expect(persistida?.correoReportante).toBe('maria@example.com');
  });

  it('rechaza correo inválido y no persiste', async () => {
    const response = await postAveria({
      ...payloadMinimo,
      correoReportante: 'correo-invalido',
    });
    expect(response.status).toBe(400);
    expect(await averias.count()).toBe(0);
  });

  it.each([
    ['nombreReportante', ''],
    ['telefonoReportante', '   '],
    ['ubicacion', ''],
    ['sectorComunidad', ''],
    ['descripcion', '   '],
  ] as const)('rechaza %s vacío y no persiste', async (campo, valor) => {
    const response = await postAveria({ ...payloadMinimo, [campo]: valor });
    expect(response.status).toBe(400);
    expect(await averias.count()).toBe(0);
  });

  it('rechaza campos administrativos y no deja que controlen la entidad', async () => {
    const response = await postAveria({
      ...payloadMinimo,
      estado: 'Resuelta',
      prioridad: 'Alta',
      fontaneroId: 1,
      idFontaneroAsignado: 99,
      codigoSeguimiento: 'AV-HACK-0001',
      fechaReporte: '2000-01-01T00:00:00.000Z',
      tipoAveria: 'Fuga',
      fechaAsignacion: '2000-01-01',
      fechaResolucion: '2000-01-02',
      observacionesAtencion: 'interno',
    });

    expect(response.status).toBe(400);
    expect(await averias.count()).toBe(0);
  });

  it('genera códigos distintos para varios reportes', async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      const response = await postAveria(payloadMinimo).expect(201);
      const body = response.body as PublicResponse;
      codes.add(body.data?.codigoSeguimiento ?? '');
    }
    expect(codes.size).toBe(5);
  });

  it('soporta altas concurrentes sin códigos duplicados', async () => {
    const responses = await Promise.all(
      Array.from({ length: 12 }, () => postAveria(payloadMinimo)),
    );

    const created = responses.filter((item) => item.status === 201);
    expect(created).toHaveLength(12);

    const codes = created.map(
      (item) => (item.body as PublicResponse).data?.codigoSeguimiento,
    );
    expect(new Set(codes).size).toBe(12);
    expect(await averias.count()).toBe(12);
  });

  it('incluye el año del reloj en el código de seguimiento', async () => {
    const result = await service.createPublicReport(
      payloadMinimo,
      new Date('2025-03-15T10:00:00.000Z'),
    );
    expect(result.data.codigoSeguimiento).toBe('AV-2025-0001');
  });

  it('devuelve solo la confirmación mínima', async () => {
    const response = await postAveria(payloadMinimo).expect(201);
    const body = response.body as PublicResponse;
    const serialized = JSON.stringify(body);
    const data = body.data;

    expect(body.message).toBe('Avería registrada correctamente.');
    expect(data?.codigoSeguimiento).toMatch(/^AV-\d{4}-\d{4}$/);
    expect(typeof data?.fechaReporte).toBe('string');
    expect(data?.estado).toBe('Recibida');
    expect(Object.keys(body)).toEqual(['message', 'data']);
    expect(Object.keys(data ?? {})).toEqual([
      'codigoSeguimiento',
      'fechaReporte',
      'estado',
    ]);
    expect(serialized).not.toMatch(
      /password|fontanero|prioridad|observacionesAtencion|idFontanero|idAbonado|"id":/i,
    );
  });

  it('ante un fallo de persistencia responde 500 sin filtrar SQL ni TypeORM', async () => {
    const saveSpy = jest.spyOn(averias, 'save').mockRejectedValueOnce(
      new QueryFailedError('INSERT INTO Averia SELECT * FROM Averia', [], {
        name: 'QueryFailedError',
        message: 'driverError stack SELECT * FROM Averia constraint',
      }),
    );

    const response = await postAveria(payloadMinimo);
    saveSpy.mockRestore();

    expect(response.status).toBe(500);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toMatch(
      /QueryFailedError|TypeORM|INSERT|SELECT|stack|driverError|Averia/i,
    );
    expect(response.body).toMatchObject({
      statusCode: 500,
      message: 'Error interno del servidor',
    });
    expect(await averias.count()).toBe(0);
  });
});
