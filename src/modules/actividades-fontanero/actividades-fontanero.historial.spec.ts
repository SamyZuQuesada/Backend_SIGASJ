import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import {
  EstadoActividadFontanero,
  ESTADOS_HISTORIAL_FONTANERO,
} from '../../common/enums/estado-actividad-fontanero.enum';
import { Role } from '../../common/enums/role.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActividadesFontaneroModule } from './actividades-fontanero.module';
import type { ListadoActividadesResponse } from './actividades-fontanero.service';
import { ActividadFontanero } from './entities/actividad-fontanero.entity';
import { DocumentoActividadFontanero } from './entities/documento-actividad-fontanero.entity';
import { TipoActividadFontanero } from './entities/tipo-actividad-fontanero.entity';
import { seedTiposActividadFontanero } from './testing/actividades-fontanero.test-helpers';

type ErrorBody = { statusCode: number; message: string | string[] };

const asListado = (body: unknown): ListadoActividadesResponse =>
  body as ListadoActividadesResponse;

const asError = (body: unknown): ErrorBody => body as ErrorBody;

const assertSafeClientBody = (body: unknown) => {
  const serialized = JSON.stringify(body ?? '');
  expect(serialized).not.toMatch(/at\s+\w+\s+\(/);
  expect(serialized).not.toContain('\\n    at ');
  expect(serialized).not.toContain('stack');
  expect(serialized).not.toContain('QueryFailedError');
  expect(serialized).not.toContain('JWT_SECRET');
  expect(serialized).not.toContain('super_secret_jwt');
  expect(serialized).not.toContain('password');
  expect(serialized).not.toContain('Password123!');
  expect(serialized).not.toContain('passwordHash');
  expect(serialized).not.toContain('refreshToken');
  expect(serialized).not.toMatch(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\./);
  expect(serialized).not.toMatch(
    /\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/i,
  );
};

jest.setTimeout(30000);

describe('GET /api/v1/fontanero/actividades/historial', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let actividades: Repository<ActividadFontanero>;
  let tiposActividad: Repository<TipoActividadFontanero>;
  let tipos: TipoActividadFontanero[];

  const signAs = (
    role: Role | string,
    sub = 'fontanero-1',
    email = 'fontanero@asadasanjuan.cr',
  ) => {
    const payload: JwtPayload = {
      sub,
      email,
      role: role as Role,
      name: 'Usuario',
    };
    return jwtService.sign(payload);
  };

  const expiredToken = (sub = 'fontanero-1') =>
    jwtService.sign(
      {
        sub,
        email: 'fontanero@asadasanjuan.cr',
        role: Role.FONTANERO,
        name: 'Usuario',
      },
      { expiresIn: -1 },
    );

  const authGet = (path: string, token?: string | null) => {
    const req = request(app.getHttpServer()).get(`/api/v1${path}`);
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  };

  const fontaneroToken = () => signAs(Role.FONTANERO, 'fontanero-1');

  const seedActividad = async (input: {
    titulo: string;
    fontaneroId: string;
    fechaActividad: string | null;
    estado: EstadoActividadFontanero;
    tipo?: TipoActividadFontanero;
  }) =>
    actividades.save(
      actividades.create({
        titulo: input.titulo,
        descripcion: null,
        ubicacion: null,
        estado: input.estado,
        fontaneroId: input.fontaneroId,
        fechaActividad: input.fechaActividad,
        tipoActividad: input.tipo ?? tipos[0],
        observacionCorreccion: null,
        revisadoPorId: null,
      }),
    );

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig],
        }),
        TypeOrmModule.forRoot({
          type: 'sqljs',
          autoSave: false,
          dropSchema: true,
          entities: [
            ActividadFontanero,
            TipoActividadFontanero,
            DocumentoActividadFontanero,
            Usuario,
          ],
          synchronize: true,
        }),
        AuthModule,
        ActividadesFontaneroModule,
      ],
      providers: [
        {
          provide: APP_FILTER,
          useClass: HttpExceptionFilter,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    actividades = moduleFixture.get(getRepositoryToken(ActividadFontanero));
    tiposActividad = moduleFixture.get(
      getRepositoryToken(TipoActividadFontanero),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await actividades.clear();
    await tiposActividad.clear();
    tipos = await seedTiposActividadFontanero(tiposActividad);
  });

  it('sin token responde 401', async () => {
    const response = await authGet('/fontanero/actividades/historial').expect(
      401,
    );
    expect(asError(response.body)).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    assertSafeClientBody(response.body);
  });

  it('token inválido responde 401', async () => {
    const response = await authGet(
      '/fontanero/actividades/historial',
      'token-invalido',
    ).expect(401);
    expect(asError(response.body)).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    assertSafeClientBody(response.body);
  });

  it('token vencido responde 401', async () => {
    const response = await authGet(
      '/fontanero/actividades/historial',
      expiredToken(),
    ).expect(401);
    expect(asError(response.body)).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    assertSafeClientBody(response.body);
  });

  it.each([
    { label: 'Administradora', role: Role.ADMINISTRADORA },
    { label: 'Secretaria', role: Role.SECRETARIA },
    { label: 'Abonado', role: 'ABONADO' },
  ])('$label recibe 403', async ({ role }) => {
    const response = await authGet(
      '/fontanero/actividades/historial',
      signAs(role, 'otro-1'),
    ).expect(403);
    expect(asError(response.body)).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });
    assertSafeClientBody(response.body);
  });

  it('rechaza fontaneroId como query param', async () => {
    const response = await authGet(
      '/fontanero/actividades/historial?fontaneroId=fontanero-2',
      fontaneroToken(),
    ).expect(400);
    expect(asError(response.body).statusCode).toBe(400);
    assertSafeClientBody(response.body);
  });

  it('solo incluye APROBADA, RECHAZADA y CORREGIDA del JWT', async () => {
    await seedActividad({
      titulo: 'Aprobada propia',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-01',
      estado: EstadoActividadFontanero.APROBADA,
    });
    await seedActividad({
      titulo: 'Rechazada propia',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-02',
      estado: EstadoActividadFontanero.RECHAZADA,
    });
    await seedActividad({
      titulo: 'Corregida propia',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-03',
      estado: EstadoActividadFontanero.CORREGIDA,
    });
    await seedActividad({
      titulo: 'Reportada propia',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-04',
      estado: EstadoActividadFontanero.REPORTADA,
    });
    await seedActividad({
      titulo: 'En revisión propia',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-05',
      estado: EstadoActividadFontanero.EN_REVISION,
    });
    await seedActividad({
      titulo: 'Requiere corrección propia',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-06',
      estado: EstadoActividadFontanero.REQUIERE_CORRECCION,
    });
    await seedActividad({
      titulo: 'Aprobada ajena',
      fontaneroId: 'fontanero-2',
      fechaActividad: '2026-09-07',
      estado: EstadoActividadFontanero.APROBADA,
    });

    const response = await authGet(
      '/fontanero/actividades/historial',
      fontaneroToken(),
    ).expect(200);
    const body = asListado(response.body);

    expect(body.total).toBe(3);
    expect(body.data).toHaveLength(3);
    expect(body.data.map((item) => item.titulo).sort()).toEqual([
      'Aprobada propia',
      'Corregida propia',
      'Rechazada propia',
    ]);
    expect(
      body.data.every((item) =>
        ESTADOS_HISTORIAL_FONTANERO.includes(
          item.estado as (typeof ESTADOS_HISTORIAL_FONTANERO)[number],
        ),
      ),
    ).toBe(true);
    expect(body.data.every((item) => !('fontaneroId' in item))).toBe(true);
    assertSafeClientBody(body);
  });

  it('filtra periodo inclusivo sobre fechaActividad', async () => {
    await seedActividad({
      titulo: 'Antes',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-08-31',
      estado: EstadoActividadFontanero.APROBADA,
    });
    await seedActividad({
      titulo: 'Inicio',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-01',
      estado: EstadoActividadFontanero.APROBADA,
    });
    await seedActividad({
      titulo: 'Fin',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-30',
      estado: EstadoActividadFontanero.RECHAZADA,
    });
    await seedActividad({
      titulo: 'Después',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-10-01',
      estado: EstadoActividadFontanero.CORREGIDA,
    });

    const response = await authGet(
      '/fontanero/actividades/historial?fechaInicio=2026-09-01&fechaFin=2026-09-30',
      fontaneroToken(),
    ).expect(200);
    const body = asListado(response.body);

    expect(body.total).toBe(2);
    expect(body.data.map((item) => item.titulo).sort()).toEqual([
      'Fin',
      'Inicio',
    ]);
    assertSafeClientBody(body);
  });

  it('rango inválido fechaInicio > fechaFin responde 400', async () => {
    const response = await authGet(
      '/fontanero/actividades/historial?fechaInicio=2026-09-30&fechaFin=2026-09-01',
      fontaneroToken(),
    ).expect(400);
    expect(asError(response.body)).toMatchObject({
      statusCode: 400,
      message: 'fechaInicio no puede ser posterior a fechaFin',
    });
    assertSafeClientBody(response.body);
  });

  it('pagina en servidor: total filtrado y data de la página', async () => {
    for (let index = 1; index <= 12; index += 1) {
      await seedActividad({
        titulo: `Hist-${String(index).padStart(2, '0')}`,
        fontaneroId: 'fontanero-1',
        fechaActividad: `2026-09-${String(index).padStart(2, '0')}`,
        estado: EstadoActividadFontanero.APROBADA,
      });
    }

    const page1 = await authGet(
      '/fontanero/actividades/historial?page=1&limit=10',
      fontaneroToken(),
    ).expect(200);
    const body1 = asListado(page1.body);
    expect(body1.total).toBe(12);
    expect(body1.data).toHaveLength(10);

    const page2 = await authGet(
      '/fontanero/actividades/historial?page=2&limit=10',
      fontaneroToken(),
    ).expect(200);
    const body2 = asListado(page2.body);
    expect(body2.total).toBe(12);
    expect(body2.data).toHaveLength(2);

    const ids = new Set([
      ...body1.data.map((item) => item.id),
      ...body2.data.map((item) => item.id),
    ]);
    expect(ids.size).toBe(12);
    assertSafeClientBody(body1);
    assertSafeClientBody(body2);
  });

  it('limit mayor a 50 responde 400', async () => {
    const response = await authGet(
      '/fontanero/actividades/historial?limit=51',
      fontaneroToken(),
    ).expect(400);
    expect(asError(response.body).statusCode).toBe(400);
    assertSafeClientBody(response.body);
  });

  it('page menor a 1 responde 400', async () => {
    const response = await authGet(
      '/fontanero/actividades/historial?page=0',
      fontaneroToken(),
    ).expect(400);
    expect(asError(response.body).statusCode).toBe(400);
    assertSafeClientBody(response.body);
  });

  it('sin page ni limit usa defaults 1 y 10', async () => {
    for (let index = 1; index <= 12; index += 1) {
      await seedActividad({
        titulo: `Default-${index}`,
        fontaneroId: 'fontanero-1',
        fechaActividad: `2026-09-${String(index).padStart(2, '0')}`,
        estado: EstadoActividadFontanero.APROBADA,
      });
    }

    const response = await authGet(
      '/fontanero/actividades/historial',
      fontaneroToken(),
    ).expect(200);
    const body = asListado(response.body);

    expect(body.total).toBe(12);
    expect(body.data).toHaveLength(10);
    assertSafeClientBody(body);
  });

  it('page fuera de rango devuelve la última página válida (clamp)', async () => {
    for (let index = 1; index <= 5; index += 1) {
      await seedActividad({
        titulo: `Clamp-${index}`,
        fontaneroId: 'fontanero-1',
        fechaActividad: `2026-09-${String(index).padStart(2, '0')}`,
        estado: EstadoActividadFontanero.APROBADA,
      });
    }

    const response = await authGet(
      '/fontanero/actividades/historial?page=2&limit=10',
      fontaneroToken(),
    ).expect(200);
    const body = asListado(response.body);

    expect(body.total).toBe(5);
    expect(body.data).toHaveLength(5);
    expect(body.data.map((item) => item.titulo).sort()).toEqual([
      'Clamp-1',
      'Clamp-2',
      'Clamp-3',
      'Clamp-4',
      'Clamp-5',
    ]);
    assertSafeClientBody(body);
  });

  it('fechaActividad null queda excluida con filtro de periodo', async () => {
    await seedActividad({
      titulo: 'Sin fecha',
      fontaneroId: 'fontanero-1',
      fechaActividad: null,
      estado: EstadoActividadFontanero.APROBADA,
    });
    await seedActividad({
      titulo: 'Con fecha',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-15',
      estado: EstadoActividadFontanero.APROBADA,
    });

    const response = await authGet(
      '/fontanero/actividades/historial?fechaInicio=2026-09-01&fechaFin=2026-09-30',
      fontaneroToken(),
    ).expect(200);
    const body = asListado(response.body);

    expect(body.total).toBe(1);
    expect(body.data[0]?.titulo).toBe('Con fecha');
    assertSafeClientBody(body);
  });

  it('detalle de actividad propia en historial responde 200', async () => {
    const propia = await seedActividad({
      titulo: 'Propia historial',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-01',
      estado: EstadoActividadFontanero.APROBADA,
    });

    const response = await authGet(
      `/fontanero/actividades/${propia.id}`,
      fontaneroToken(),
    ).expect(200);

    expect(response.body).toMatchObject({
      id: propia.id,
      titulo: 'Propia historial',
      estado: EstadoActividadFontanero.APROBADA,
    });
    assertSafeClientBody(response.body);
  });

  it('detalle de actividad ajena responde 403', async () => {
    const ajena = await seedActividad({
      titulo: 'Ajena',
      fontaneroId: 'fontanero-2',
      fechaActividad: '2026-09-01',
      estado: EstadoActividadFontanero.APROBADA,
    });

    const response = await authGet(
      `/fontanero/actividades/${ajena.id}`,
      fontaneroToken(),
    ).expect(403);
    expect(asError(response.body)).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });
    assertSafeClientBody(response.body);
  });
});
