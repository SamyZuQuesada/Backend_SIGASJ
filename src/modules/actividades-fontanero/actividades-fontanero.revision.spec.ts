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
import { TipoActividadFontaneroCodigo } from '../../common/enums/tipo-actividad-fontanero-codigo.enum';
import { Role } from '../../common/enums/role.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActividadesFontaneroModule } from './actividades-fontanero.module';
import type { ActividadFontaneroAdminResponse } from './actividades-fontanero.service';
import { ActividadFontanero } from './entities/actividad-fontanero.entity';
import { TipoActividadFontanero } from './entities/tipo-actividad-fontanero.entity';
import { DocumentoActividadFontanero } from './entities/documento-actividad-fontanero.entity';
import {
  buildValidCreateActividadPayload,
  seedTiposActividadFontanero,
} from './testing/actividades-fontanero.test-helpers';

type ErrorResponseBody = { statusCode: number; message: string | string[] };

const asDetail = (body: unknown): ActividadFontaneroAdminResponse =>
  body as ActividadFontaneroAdminResponse;

const asError = (body: unknown): ErrorResponseBody => body as ErrorResponseBody;

const assertSafeClientBody = (body: unknown) => {
  const serialized = JSON.stringify(body ?? '');
  expect(serialized).not.toMatch(/at\s+\w+\s+\(/);
  expect(serialized).not.toContain('\\n    at ');
  expect(serialized).not.toContain('stack');
  expect(serialized).not.toContain('QueryFailedError');
  expect(serialized).not.toContain('password');
  expect(serialized).not.toMatch(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\./);
  expect(serialized).not.toMatch(
    /\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/i,
  );
};

describe('Revisión Administrativa de Actividades de Fontanero', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let actividades: Repository<ActividadFontanero>;
  let tiposActividad: Repository<TipoActividadFontanero>;
  let tipoControlFugasId: number;

  const signAs = (role: Role, sub: string) => {
    const payload: JwtPayload = {
      sub,
      email: `${sub}@asadasanjuan.cr`,
      role,
      name: 'Usuario Test',
    };
    return jwtService.sign(payload);
  };

  const authPost = (
    path: string,
    body: Record<string, unknown>,
    token: string,
  ) =>
    request(app.getHttpServer())
      .post(`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const authPatch = (
    path: string,
    body: Record<string, unknown>,
    token?: string,
  ) => {
    const req = request(app.getHttpServer()).patch(`/api/v1${path}`);
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.send(body);
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
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
    const tipos = await seedTiposActividadFontanero(tiposActividad);
    const fugas = tipos.find(
      (tipo) => tipo.codigo === TipoActividadFontaneroCodigo.CONTROL_FUGAS,
    );
    tipoControlFugasId = fugas?.id ?? tipos[0].id;
  });

  it('permite a la Administradora marcar una actividad como REVISADA con fecha y usuario', async () => {
    const fontaneroToken = signAs(Role.FONTANERO, 'fontanero-1');
    const adminToken = signAs(Role.ADMINISTRADORA, 'admin-1');

    const created = await authPost(
      '/fontanero/actividades',
      buildValidCreateActividadPayload(tipoControlFugasId, {
        titulo: 'Control de Fugas Barrio San Juan',
        descripcion: 'Inspección de tubería principal',
        ubicacion: 'Calle Principal 100m Norte',
        ubicacionFuga: 'Acera este',
      }),
      fontaneroToken,
    ).expect(201);

    const actividadId = (created.body as { id: number }).id;
    const beforeReview = new Date();

    const response = await authPatch(
      `/admin/actividades-fontanero/${actividadId}/revisar`,
      {},
      adminToken,
    ).expect(200);

    const afterReview = new Date();

    const body = asDetail(response.body);
    expect(body).toMatchObject({
      id: actividadId,
      estado: EstadoActividadFontanero.REVISADA,
      revisadoPorId: 'admin-1',
      titulo: 'Control de Fugas Barrio San Juan',
      descripcion: 'Inspección de tubería principal',
      ubicacion: 'Calle Principal 100m Norte',
      fontaneroId: 'fontanero-1',
      tipoActividadId: tipoControlFugasId,
    });

    expect(body.fechaRevision).toBeDefined();
    const reviewDate = new Date(body.fechaRevision as unknown as string);
    expect(reviewDate.getTime()).toBeGreaterThanOrEqual(
      beforeReview.getTime() - 1000,
    );
    expect(reviewDate.getTime()).toBeLessThanOrEqual(
      afterReview.getTime() + 1000,
    );

    assertSafeClientBody(response.body);
  });

  it('funciona a través de ambas rutas (/admin/actividades/:id/revisar y /admin/actividades-fontanero/:id/revisar)', async () => {
    const fontaneroToken = signAs(Role.FONTANERO, 'fontanero-2');
    const adminToken = signAs(Role.ADMINISTRADORA, 'admin-2');

    const created = await authPost(
      '/fontanero/actividades',
      buildValidCreateActividadPayload(tipoControlFugasId, {
        titulo: 'Actividad para ruta alternativa',
      }),
      fontaneroToken,
    ).expect(201);

    const actividadId = (created.body as { id: number }).id;

    const response = await authPatch(
      `/admin/actividades/${actividadId}/revisar`,
      {},
      adminToken,
    ).expect(200);

    const body = asDetail(response.body);
    expect(body.estado).toBe(EstadoActividadFontanero.REVISADA);
    expect(body.revisadoPorId).toBe('admin-2');
    expect(body.fechaRevision).toBeDefined();
  });

  it('permite registrar una observación opcional durante la revisión', async () => {
    const fontaneroToken = signAs(Role.FONTANERO, 'fontanero-3');
    const adminToken = signAs(Role.ADMINISTRADORA, 'admin-3');

    const created = await authPost(
      '/fontanero/actividades',
      buildValidCreateActividadPayload(tipoControlFugasId, {
        titulo: 'Actividad con observación',
      }),
      fontaneroToken,
    ).expect(201);

    const actividadId = (created.body as { id: number }).id;

    const response = await authPatch(
      `/admin/actividades-fontanero/${actividadId}/revisar`,
      { observacion: 'Revisión técnica satisfactoria en campo' },
      adminToken,
    ).expect(200);

    const body = asDetail(response.body);
    expect(body.estado).toBe(EstadoActividadFontanero.REVISADA);
    expect(body.observacionCorreccion).toBe(
      'Revisión técnica satisfactoria en campo',
    );
  });

  it('evita registrar múltiples revisiones duplicadas devolviendo 400', async () => {
    const fontaneroToken = signAs(Role.FONTANERO, 'fontanero-4');
    const adminToken = signAs(Role.ADMINISTRADORA, 'admin-4');

    const created = await authPost(
      '/fontanero/actividades',
      buildValidCreateActividadPayload(tipoControlFugasId, {
        titulo: 'Actividad a revisar duplicada',
      }),
      fontaneroToken,
    ).expect(201);

    const actividadId = (created.body as { id: number }).id;

    // Primera revisión exitosa
    await authPatch(
      `/admin/actividades-fontanero/${actividadId}/revisar`,
      {},
      adminToken,
    ).expect(200);

    // Intento de segunda revisión innecesaria
    const duplicateResponse = await authPatch(
      `/admin/actividades-fontanero/${actividadId}/revisar`,
      {},
      adminToken,
    ).expect(400);

    expect(asError(duplicateResponse.body).message).toMatch(
      /ya (ha sido|fue) revisada/i,
    );
    assertSafeClientBody(duplicateResponse.body);
  });

  it('devuelve 404 si la actividad no existe', async () => {
    const adminToken = signAs(Role.ADMINISTRADORA, 'admin-1');

    const response = await authPatch(
      '/admin/actividades-fontanero/99999/revisar',
      {},
      adminToken,
    ).expect(404);

    expect(asError(response.body).message).toContain('Actividad no encontrada');
    assertSafeClientBody(response.body);
  });

  it('deniega el acceso a fontaneros (403 Forbidden)', async () => {
    const fontaneroToken = signAs(Role.FONTANERO, 'fontanero-1');

    const created = await authPost(
      '/fontanero/actividades',
      buildValidCreateActividadPayload(tipoControlFugasId, {
        titulo: 'Actividad para prueba 403',
      }),
      fontaneroToken,
    ).expect(201);

    const actividadId = (created.body as { id: number }).id;

    const response = await authPatch(
      `/admin/actividades-fontanero/${actividadId}/revisar`,
      {},
      fontaneroToken,
    ).expect(403);

    assertSafeClientBody(response.body);
  });

  it('deniega el acceso a peticiones no autenticadas (401 Unauthorized)', async () => {
    const response = await authPatch(
      '/admin/actividades-fontanero/1/revisar',
      {},
    ).expect(401);

    assertSafeClientBody(response.body);
  });

  it('los datos técnicos registrados por el fontanero permanecen intactos tras la revisión', async () => {
    const fontaneroToken = signAs(Role.FONTANERO, 'fontanero-guard');
    const adminToken = signAs(Role.ADMINISTRADORA, 'admin-guard');

    const originalPayload = buildValidCreateActividadPayload(
      tipoControlFugasId,
      {
        titulo: 'Control fuga sector norte',
        descripcion: 'Descripción técnica del fontanero',
        ubicacion: 'Calle 5 ave 2',
        observaciones: 'Observaciones iniciales del fontanero',
        ubicacionFuga: 'Esquina suroeste',
      },
    );

    const created = await authPost(
      '/fontanero/actividades',
      originalPayload,
      fontaneroToken,
    ).expect(201);

    const actividadId = (created.body as { id: number }).id;

    const reviewed = await authPatch(
      `/admin/actividades-fontanero/${actividadId}/revisar`,
      {},
      adminToken,
    ).expect(200);

    const reviewedBody = asDetail(reviewed.body);
    expect(reviewedBody.titulo).toBe(originalPayload.titulo);
    expect(reviewedBody.descripcion).toBe(originalPayload.descripcion);
    expect(reviewedBody.ubicacion).toBe(originalPayload.ubicacion);
    expect(reviewedBody.observaciones).toBe(originalPayload.observaciones);
    expect(reviewedBody.tipoActividadId).toBe(tipoControlFugasId);
    expect(reviewedBody.fontaneroId).toBe('fontanero-guard');
    expect(reviewedBody.datosEspecificos).toMatchObject({
      ubicacionFuga: 'Esquina suroeste',
    });
    expect(reviewedBody.estado).toBe(EstadoActividadFontanero.REVISADA);
    expect(reviewedBody.estado).not.toBe(EstadoActividadFontanero.APROBADA);
    expect(reviewedBody.estado).not.toBe(EstadoActividadFontanero.RECHAZADA);
  });
});
