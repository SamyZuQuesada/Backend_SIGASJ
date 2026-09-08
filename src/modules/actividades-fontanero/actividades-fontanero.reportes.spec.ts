import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { EstadoActividadFontanero } from '../../common/enums/estado-actividad-fontanero.enum';
import { Role } from '../../common/enums/role.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActividadesFontaneroModule } from './actividades-fontanero.module';
import type { ReporteActividadesResponse } from './actividades-fontanero.service';
import { ActividadFontanero } from './entities/actividad-fontanero.entity';
import { DocumentoActividadFontanero } from './entities/documento-actividad-fontanero.entity';
import { TipoActividadFontanero } from './entities/tipo-actividad-fontanero.entity';
import { seedTiposActividadFontanero } from './testing/actividades-fontanero.test-helpers';

type ErrorBody = { statusCode: number; message: string | string[] };

const asReporte = (body: unknown): ReporteActividadesResponse =>
  body as ReporteActividadesResponse;

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

describe('GET /api/v1/admin/actividades/reportes', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let actividades: Repository<ActividadFontanero>;
  let tiposActividad: Repository<TipoActividadFontanero>;
  let tipos: TipoActividadFontanero[];

  const signAs = (
    role: Role | string,
    sub = 'admin-1',
    email = 'admin@asadasanjuan.cr',
  ) => {
    const payload: JwtPayload = {
      sub,
      email,
      role: role as Role,
      name: 'Usuario',
    };
    return jwtService.sign(payload);
  };

  const authGet = (path: string, token?: string | null) => {
    const req = request(app.getHttpServer()).get(`/api/v1${path}`);
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  };

  const adminToken = () => signAs(Role.ADMINISTRADORA, 'admin-1');

  const seedActividad = async (input: {
    titulo: string;
    fontaneroId: string;
    fechaActividad: string;
    tipo: TipoActividadFontanero;
    estado?: EstadoActividadFontanero;
  }) =>
    actividades.save(
      actividades.create({
        titulo: input.titulo,
        descripcion: null,
        ubicacion: null,
        estado: input.estado ?? EstadoActividadFontanero.REPORTADA,
        fontaneroId: input.fontaneroId,
        fechaActividad: input.fechaActividad,
        tipoActividad: input.tipo,
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

  it('sin filtros: total, porTipo, porFontanero y detalle correctos', async () => {
    await seedActividad({
      titulo: 'A1',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-01',
      tipo: tipos[0],
    });
    await seedActividad({
      titulo: 'A2',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-05',
      tipo: tipos[0],
    });
    await seedActividad({
      titulo: 'A3',
      fontaneroId: 'fontanero-2',
      fechaActividad: '2026-09-10',
      tipo: tipos[1],
    });

    const response = await authGet(
      '/admin/actividades/reportes',
      adminToken(),
    ).expect(200);
    const body = asReporte(response.body);

    expect(body.total).toBe(3);
    expect(body.porEstado.REPORTADA).toBe(3);
    expect(body.porTipo).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tipoActividadId: tipos[0].id,
          tipoActividadNombre: tipos[0].nombre,
          cantidad: 2,
        }),
        expect.objectContaining({
          tipoActividadId: tipos[1].id,
          tipoActividadNombre: tipos[1].nombre,
          cantidad: 1,
        }),
      ]),
    );
    expect(body.porFontanero).toEqual(
      expect.arrayContaining([
        { fontaneroId: 'fontanero-1', cantidad: 2 },
        { fontaneroId: 'fontanero-2', cantidad: 1 },
      ]),
    );
    expect(body.actividades).toHaveLength(3);
    expect(body.actividades[0].fechaActividad).toBe('2026-09-10');
    assertSafeClientBody(body);
  });

  it('filtro fechaInicio excluye actividades anteriores', async () => {
    await seedActividad({
      titulo: 'Antes',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-08-31',
      tipo: tipos[0],
    });
    await seedActividad({
      titulo: 'Desde',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-01',
      tipo: tipos[0],
    });

    const response = await authGet(
      '/admin/actividades/reportes?fechaInicio=2026-09-01',
      adminToken(),
    ).expect(200);
    const body = asReporte(response.body);

    expect(body.total).toBe(1);
    expect(body.actividades).toHaveLength(1);
    expect(body.actividades[0].fechaActividad).toBe('2026-09-01');
    assertSafeClientBody(body);
  });

  it('filtro fechaFin excluye actividades posteriores (mismo día inclusive)', async () => {
    await seedActividad({
      titulo: 'Hasta',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-30',
      tipo: tipos[0],
    });
    await seedActividad({
      titulo: 'Después',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-10-01',
      tipo: tipos[0],
    });

    const response = await authGet(
      '/admin/actividades/reportes?fechaFin=2026-09-30',
      adminToken(),
    ).expect(200);
    const body = asReporte(response.body);

    expect(body.total).toBe(1);
    expect(body.actividades[0].fechaActividad).toBe('2026-09-30');
    assertSafeClientBody(body);
  });

  it('rango fechaInicio + fechaFin inclusive', async () => {
    await seedActividad({
      titulo: 'FueraInicio',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-08-31',
      tipo: tipos[0],
    });
    await seedActividad({
      titulo: 'EnRango',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-15',
      tipo: tipos[1],
    });
    await seedActividad({
      titulo: 'FueraFin',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-10-01',
      tipo: tipos[0],
    });

    const response = await authGet(
      '/admin/actividades/reportes?fechaInicio=2026-09-01&fechaFin=2026-09-30',
      adminToken(),
    ).expect(200);
    const body = asReporte(response.body);

    expect(body.total).toBe(1);
    expect(body.porTipo).toEqual([
      expect.objectContaining({
        tipoActividadId: tipos[1].id,
        cantidad: 1,
      }),
    ]);
    assertSafeClientBody(body);
  });

  it('rango de un único día incluye solo ese día', async () => {
    await seedActividad({
      titulo: 'DiaAntes',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-14',
      tipo: tipos[0],
    });
    await seedActividad({
      titulo: 'DiaExacto',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-15',
      tipo: tipos[1],
    });
    await seedActividad({
      titulo: 'DiaDespues',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-16',
      tipo: tipos[0],
    });

    const response = await authGet(
      '/admin/actividades/reportes?fechaInicio=2026-09-15&fechaFin=2026-09-15',
      adminToken(),
    ).expect(200);
    const body = asReporte(response.body);

    expect(body.total).toBe(1);
    expect(body.actividades[0].fechaActividad).toBe('2026-09-15');
    assertSafeClientBody(body);
  });

  it('conteos por los 6 tipos del catálogo coinciden con datos sembrados', async () => {
    expect(tipos.length).toBeGreaterThanOrEqual(6);

    for (let index = 0; index < 6; index += 1) {
      await seedActividad({
        titulo: `Tipo-${tipos[index].codigo}`,
        fontaneroId: index % 2 === 0 ? 'fontanero-1' : 'fontanero-2',
        fechaActividad: `2026-09-${String(index + 1).padStart(2, '0')}`,
        tipo: tipos[index],
      });
    }
    // segunda actividad del primer tipo
    await seedActividad({
      titulo: `Tipo-${tipos[0].codigo}-extra`,
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-20',
      tipo: tipos[0],
    });

    const response = await authGet(
      '/admin/actividades/reportes',
      adminToken(),
    ).expect(200);
    const body = asReporte(response.body);

    expect(body.total).toBe(7);
    expect(body.porTipo).toEqual(
      expect.arrayContaining(
        tipos.slice(0, 6).map((tipo, index) =>
          expect.objectContaining({
            tipoActividadId: tipo.id,
            tipoActividadNombre: tipo.nombre,
            cantidad: index === 0 ? 2 : 1,
          }),
        ),
      ),
    );
    assertSafeClientBody(body);
  });

  it('rango inválido fechaInicio > fechaFin responde 400', async () => {
    const response = await authGet(
      '/admin/actividades/reportes?fechaInicio=2026-09-30&fechaFin=2026-09-01',
      adminToken(),
    ).expect(400);

    expect(asError(response.body)).toMatchObject({
      statusCode: 400,
      message: 'fechaInicio no puede ser posterior a fechaFin',
    });
    assertSafeClientBody(response.body);
  });

  it('fechaInicio inválida responde 400', async () => {
    const response = await authGet(
      '/admin/actividades/reportes?fechaInicio=hola',
      adminToken(),
    ).expect(400);

    expect(asError(response.body).statusCode).toBe(400);
    assertSafeClientBody(response.body);
  });

  it('tipoActividadId no numérico responde 400', async () => {
    const response = await authGet(
      '/admin/actividades/reportes?tipoActividadId=abc',
      adminToken(),
    ).expect(400);

    expect(asError(response.body).statusCode).toBe(400);
    assertSafeClientBody(response.body);
  });

  it('filtro fontaneroId solo incluye sus actividades', async () => {
    await seedActividad({
      titulo: 'F1',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-01',
      tipo: tipos[0],
    });
    await seedActividad({
      titulo: 'F2',
      fontaneroId: 'fontanero-2',
      fechaActividad: '2026-09-02',
      tipo: tipos[1],
    });

    const response = await authGet(
      '/admin/actividades/reportes?fontaneroId=fontanero-1',
      adminToken(),
    ).expect(200);
    const body = asReporte(response.body);

    expect(body.total).toBe(1);
    expect(body.porFontanero).toEqual([
      { fontaneroId: 'fontanero-1', cantidad: 1 },
    ]);
    expect(body.actividades[0].fontaneroId).toBe('fontanero-1');
    assertSafeClientBody(body);
  });

  it('filtro tipoActividadId solo incluye ese tipo', async () => {
    await seedActividad({
      titulo: 'T0',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-01',
      tipo: tipos[0],
    });
    await seedActividad({
      titulo: 'T1a',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-02',
      tipo: tipos[1],
    });
    await seedActividad({
      titulo: 'T1b',
      fontaneroId: 'fontanero-2',
      fechaActividad: '2026-09-03',
      tipo: tipos[1],
    });

    const response = await authGet(
      `/admin/actividades/reportes?tipoActividadId=${tipos[1].id}`,
      adminToken(),
    ).expect(200);
    const body = asReporte(response.body);

    expect(body.total).toBe(2);
    expect(body.porTipo).toEqual([
      expect.objectContaining({
        tipoActividadId: tipos[1].id,
        tipoActividadNombre: tipos[1].nombre,
        cantidad: 2,
      }),
    ]);
    expect(body.porFontanero).toHaveLength(2);
    assertSafeClientBody(body);
  });

  it('filtros combinados aplican AND', async () => {
    await seedActividad({
      titulo: 'Match',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-15',
      tipo: tipos[1],
    });
    await seedActividad({
      titulo: 'OtroFontanero',
      fontaneroId: 'fontanero-2',
      fechaActividad: '2026-09-15',
      tipo: tipos[1],
    });
    await seedActividad({
      titulo: 'OtroTipo',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-15',
      tipo: tipos[0],
    });
    await seedActividad({
      titulo: 'FueraRango',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-08-01',
      tipo: tipos[1],
    });

    const response = await authGet(
      `/admin/actividades/reportes?fechaInicio=2026-09-01&fechaFin=2026-09-30&fontaneroId=fontanero-1&tipoActividadId=${tipos[1].id}`,
      adminToken(),
    ).expect(200);
    const body = asReporte(response.body);

    expect(body.total).toBe(1);
    expect(body.actividades).toEqual([
      expect.objectContaining({
        fontaneroId: 'fontanero-1',
        tipoActividadId: tipos[1].id,
        fechaActividad: '2026-09-15',
      }),
    ]);
    assertSafeClientBody(body);
  });

  it('consulta sin resultados responde 200 con estructura vacía', async () => {
    await seedActividad({
      titulo: 'Existente',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-01',
      tipo: tipos[0],
    });

    const response = await authGet(
      '/admin/actividades/reportes?fechaInicio=2027-01-01&fechaFin=2027-01-31',
      adminToken(),
    ).expect(200);
    const body = asReporte(response.body);

    expect(body).toMatchObject({
      total: 0,
      porTipo: [],
      porFontanero: [],
      actividades: [],
    });
    expect(body.porEstado.REPORTADA).toBe(0);
    assertSafeClientBody(body);
  });

  it('sin token responde 401', async () => {
    const response = await authGet('/admin/actividades/reportes').expect(401);
    expect(asError(response.body)).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    assertSafeClientBody(response.body);
  });

  it('Fontanero responde 403', async () => {
    const response = await authGet(
      '/admin/actividades/reportes',
      signAs(Role.FONTANERO, 'fontanero-1'),
    ).expect(403);
    expect(asError(response.body)).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });
    assertSafeClientBody(response.body);
  });

  it('Secretaria responde 403', async () => {
    const response = await authGet(
      '/admin/actividades/reportes',
      signAs(Role.SECRETARIA, 'sec-1'),
    ).expect(403);
    expect(asError(response.body).statusCode).toBe(403);
    assertSafeClientBody(response.body);
  });

  it('no expone datos sensibles ni entidad Usuario', async () => {
    await seedActividad({
      titulo: 'Segura',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-01',
      tipo: tipos[0],
    });

    const response = await authGet(
      '/admin/actividades/reportes',
      adminToken(),
    ).expect(200);
    const body = asReporte(response.body);

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('idUsuario');
    expect(body.actividades[0]).toEqual({
      id: expect.any(Number) as number,
      fechaActividad: '2026-09-01',
      estado: EstadoActividadFontanero.REPORTADA,
      tipoActividadId: tipos[0].id,
      tipoActividadNombre: tipos[0].nombre,
      fontaneroId: 'fontanero-1',
    });
    assertSafeClientBody(body);
  });

  it('es idempotente (solo lectura): dos GET equivalentes', async () => {
    await seedActividad({
      titulo: 'Idem',
      fontaneroId: 'fontanero-1',
      fechaActividad: '2026-09-01',
      tipo: tipos[0],
    });
    const token = adminToken();
    const a = asReporte(
      (await authGet('/admin/actividades/reportes', token).expect(200)).body,
    );
    const b = asReporte(
      (await authGet('/admin/actividades/reportes', token).expect(200)).body,
    );
    expect(a).toEqual(b);
    expect(await actividades.count()).toBe(1);
  });
});
