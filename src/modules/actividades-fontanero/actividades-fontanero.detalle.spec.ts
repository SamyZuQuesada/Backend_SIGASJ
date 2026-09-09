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

describe('Consulta de Detalle de Actividad de Fontanero (Administradora)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let actividades: Repository<ActividadFontanero>;
  let tiposActividad: Repository<TipoActividadFontanero>;
  let documentosRepo: Repository<DocumentoActividadFontanero>;
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

  const authGet = (path: string, token?: string) => {
    const req = request(app.getHttpServer()).get(`/api/v1${path}`);
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  };

  const authPatch = (
    path: string,
    body: Record<string, unknown>,
    token: string,
  ) =>
    request(app.getHttpServer())
      .patch(`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

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
    documentosRepo = moduleFixture.get(
      getRepositoryToken(DocumentoActividadFontanero),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await documentosRepo.clear();
    await actividades.clear();
    await tiposActividad.clear();
    const tipos = await seedTiposActividadFontanero(tiposActividad);
    const fugas = tipos.find(
      (tipo) => tipo.codigo === TipoActividadFontaneroCodigo.CONTROL_FUGAS,
    );
    tipoControlFugasId = fugas?.id ?? tipos[0].id;
  });

  it('permite a la Administradora consultar el detalle completo de una actividad', async () => {
    const fontaneroToken = signAs(Role.FONTANERO, 'fontanero-1');
    const adminToken = signAs(Role.ADMINISTRADORA, 'admin-1');

    const created = await authPost(
      '/fontanero/actividades',
      buildValidCreateActividadPayload(tipoControlFugasId, {
        titulo: 'Fuga frente a escuela',
        descripcion: 'Reparación de tubería de 2 pulgadas',
        ubicacion: 'Frente a la plaza',
        observaciones: 'Material utilizado: 1 acople rápido',
        ubicacionFuga: 'Acera principal',
      }),
      fontaneroToken,
    ).expect(201);

    const actividadId = (created.body as { id: number }).id;

    // Asociamos un documento para validar que aparezca en el detalle
    const doc = documentosRepo.create({
      actividad: { id: actividadId } as ActividadFontanero,
      nombreOriginal: 'foto-evidencia.jpg',
      tipoArchivo: 'image/jpeg',
      rutaReferenciaArchivo: 'uploads/actividades/1/foto-evidencia.jpg',
      tamanio: 1024,
    });
    await documentosRepo.save(doc);

    const response = await authGet(
      `/admin/actividades-fontanero/${actividadId}`,
      adminToken,
    ).expect(200);

    expect(response.body).toMatchObject({
      id: actividadId,
      titulo: 'Fuga frente a escuela',
      descripcion: 'Reparación de tubería de 2 pulgadas',
      ubicacion: 'Frente a la plaza',
      observaciones: 'Material utilizado: 1 acople rápido',
      fontaneroId: 'fontanero-1',
      tipoActividadId: tipoControlFugasId,
      tipoActividadNombre: 'Control de Fugas',
      estado: EstadoActividadFontanero.REPORTADA,
      datosEspecificos: {
        ubicacionFuga: 'Acera principal',
      },
    });

    const detail = asDetail(response.body);
    expect(Array.isArray(detail.documentos)).toBe(true);
    expect(detail.documentos!).toHaveLength(1);
    expect(detail.documentos![0]).toMatchObject({
      nombreOriginal: 'foto-evidencia.jpg',
      tipoArchivo: 'image/jpeg',
      tamanio: 1024,
    });

    assertSafeClientBody(response.body);
  });

  it('soporta la ruta alternativa /admin/actividades/:id', async () => {
    const fontaneroToken = signAs(Role.FONTANERO, 'fontanero-2');
    const adminToken = signAs(Role.ADMINISTRADORA, 'admin-2');

    const created = await authPost(
      '/fontanero/actividades',
      buildValidCreateActividadPayload(tipoControlFugasId, {
        titulo: 'Fuga ruta alternativa',
      }),
      fontaneroToken,
    ).expect(201);

    const actividadId = (created.body as { id: number }).id;

    const response = await authGet(
      `/admin/actividades/${actividadId}`,
      adminToken,
    ).expect(200);

    const detail = asDetail(response.body);
    expect(detail.id).toBe(actividadId);
    expect(detail.titulo).toBe('Fuga ruta alternativa');
    expect(detail.documentos).toEqual([]);
  });

  it('muestra la información de revisión cuando la actividad fue revisada', async () => {
    const fontaneroToken = signAs(Role.FONTANERO, 'fontanero-3');
    const adminToken = signAs(Role.ADMINISTRADORA, 'admin-auditor');

    const created = await authPost(
      '/fontanero/actividades',
      buildValidCreateActividadPayload(tipoControlFugasId, {
        titulo: 'Actividad para revisar y ver detalle',
      }),
      fontaneroToken,
    ).expect(201);

    const actividadId = (created.body as { id: number }).id;

    await authPatch(
      `/admin/actividades-fontanero/${actividadId}/revisar`,
      { observacion: 'Revisión aprobatoria' },
      adminToken,
    ).expect(200);

    const response = await authGet(
      `/admin/actividades-fontanero/${actividadId}`,
      adminToken,
    ).expect(200);

    const detail = asDetail(response.body);
    expect(detail.estado).toBe(EstadoActividadFontanero.REVISADA);
    expect(detail.revisadoPorId).toBe('admin-auditor');
    expect(detail.observacionCorreccion).toBe('Revisión aprobatoria');
    expect(detail.fechaRevision).toBeDefined();
    expect(
      new Date(detail.fechaRevision as unknown as string).getTime(),
    ).not.toBeNaN();
  });

  it('devuelve 404 si la actividad no existe', async () => {
    const adminToken = signAs(Role.ADMINISTRADORA, 'admin-1');

    const response = await authGet(
      '/admin/actividades-fontanero/99999',
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
        titulo: 'Actividad privada admin',
      }),
      fontaneroToken,
    ).expect(201);

    const actividadId = (created.body as { id: number }).id;

    const response = await authGet(
      `/admin/actividades-fontanero/${actividadId}`,
      fontaneroToken,
    ).expect(403);

    assertSafeClientBody(response.body);
  });

  it('deniega el acceso sin autenticación (401 Unauthorized)', async () => {
    const response = await authGet('/admin/actividades-fontanero/1').expect(
      401,
    );
    assertSafeClientBody(response.body);
  });

  it('la consulta de detalle no modifica los datos de la actividad (solo lectura)', async () => {
    const fontaneroToken = signAs(Role.FONTANERO, 'fontanero-read');
    const adminToken = signAs(Role.ADMINISTRADORA, 'admin-read');

    const created = await authPost(
      '/fontanero/actividades',
      buildValidCreateActividadPayload(tipoControlFugasId, {
        titulo: 'Actividad solo lectura',
      }),
      fontaneroToken,
    ).expect(201);

    const actividadId = (created.body as { id: number }).id;
    const initialEntity = await actividades.findOneByOrFail({
      id: actividadId,
    });

    await authGet(
      `/admin/actividades-fontanero/${actividadId}`,
      adminToken,
    ).expect(200);

    const postEntity = await actividades.findOneByOrFail({ id: actividadId });

    expect(postEntity.updatedAt.getTime()).toBe(
      initialEntity.updatedAt.getTime(),
    );
    expect(postEntity.estado).toBe(initialEntity.estado);
    expect(postEntity.revisadoPorId).toBe(initialEntity.revisadoPorId);
    expect(postEntity.fechaRevision).toBe(initialEntity.fechaRevision);
  });
});
