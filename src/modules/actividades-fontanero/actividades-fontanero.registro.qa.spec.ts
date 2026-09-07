import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActividadesFontaneroModule } from './actividades-fontanero.module';
import { ActividadFontanero } from './entities/actividad-fontanero.entity';
import { TipoActividadFontanero } from './entities/tipo-actividad-fontanero.entity';
import { DocumentoActividadFontanero } from './entities/documento-actividad-fontanero.entity';
import {
  buildValidCreateActividadPayload,
  seedTiposActividadFontanero,
} from './testing/actividades-fontanero.test-helpers';

/**
 * QA #933 — registro y validación end-to-end (API + persistencia en memoria SQL).
 */
describe('QA #933 — registro y validación de actividades Fontanero', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let actividades: Repository<ActividadFontanero>;
  let tiposActividad: Repository<TipoActividadFontanero>;
  let validTipoActividadId: number;

  const signFontanero = (sub = 'fontanero-qa-1') => {
    const payload: JwtPayload = {
      sub,
      email: 'fontanero@asadasanjuan.cr',
      role: Role.FONTANERO,
      name: 'Fontanero QA',
    };
    return jwtService.sign(payload);
  };

  const postActividad = (
    body: Record<string, unknown>,
    token = signFontanero(),
  ) =>
    request(app.getHttpServer())
      .post('/api/v1/fontanero/actividades')
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
          entities: [ActividadFontanero, TipoActividadFontanero, DocumentoActividadFontanero, Usuario],
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
    tiposActividad = moduleFixture.get(getRepositoryToken(TipoActividadFontanero));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await actividades.clear();
    await tiposActividad.clear();
    const tipos = await seedTiposActividadFontanero(tiposActividad);
    validTipoActividadId = tipos[0].id;
  });

  it('registro válido persiste actividad vinculada al Fontanero autenticado y al tipo', async () => {
    const payload = buildValidCreateActividadPayload(validTipoActividadId, {
      titulo: 'Control sector norte QA',
      fechaActividad: '2026-09-07',
    });

    const response = await postActividad(payload).expect(201);

    expect(response.body).toMatchObject({
      titulo: payload.titulo,
      tipoActividadId: validTipoActividadId,
      fechaActividad: payload.fechaActividad,
    });

    expect(await actividades.count()).toBe(1);
    const saved = await actividades.findOne({
      where: { id: (response.body as { id: number }).id },
      relations: { tipoActividad: true },
    });

    expect(saved?.fontaneroId).toBe('fontanero-qa-1');
    expect(saved?.tipoActividad?.id).toBe(validTipoActividadId);
    expect(saved?.fechaActividad).toBe('2026-09-07');
  });

  it('intentos inválidos no generan registros y tras corregir se registra correctamente', async () => {
    await postActividad(
      buildValidCreateActividadPayload(validTipoActividadId, { titulo: '   ' }),
    ).expect(400);
    expect(await actividades.count()).toBe(0);

    await postActividad(
      buildValidCreateActividadPayload(validTipoActividadId, {
        fechaActividad: '2099-01-01',
      }),
    ).expect(400);
    expect(await actividades.count()).toBe(0);

    await postActividad(buildValidCreateActividadPayload(9999)).expect(404);
    expect(await actividades.count()).toBe(0);

    await tiposActividad.update({ id: validTipoActividadId }, { activo: false });
    await postActividad(buildValidCreateActividadPayload(validTipoActividadId)).expect(
      400,
    );
    expect(await actividades.count()).toBe(0);

    await tiposActividad.update({ id: validTipoActividadId }, { activo: true });
    const ok = await postActividad(
      buildValidCreateActividadPayload(validTipoActividadId, {
        titulo: 'Registro corregido QA',
      }),
    ).expect(201);

    expect(ok.body).toMatchObject({ titulo: 'Registro corregido QA' });
    expect(await actividades.count()).toBe(1);
  });

  it('seguridad: sin token, token inválido, rol distinto y fontaneroId manipulado', async () => {
    const payload = buildValidCreateActividadPayload(validTipoActividadId);

    await request(app.getHttpServer())
      .post('/api/v1/fontanero/actividades')
      .send(payload)
      .expect(401);
    expect(await actividades.count()).toBe(0);

    await postActividad(payload, 'token-invalido').expect(401);
    expect(await actividades.count()).toBe(0);

    const expired = jwtService.sign(
      {
        sub: 'fontanero-qa-1',
        email: 'fontanero@asadasanjuan.cr',
        role: Role.FONTANERO,
        name: 'Fontanero QA',
      },
      { expiresIn: -1 },
    );
    await postActividad(payload, expired).expect(401);
    expect(await actividades.count()).toBe(0);

    const adminToken = jwtService.sign({
      sub: 'admin-1',
      email: 'admin@asadasanjuan.cr',
      role: Role.ADMINISTRADORA,
      name: 'Admin',
    });
    await postActividad(payload, adminToken).expect(403);
    expect(await actividades.count()).toBe(0);

    await postActividad(
      { ...payload, fontaneroId: 'fontanero-ajeno', userId: 'otro' },
      signFontanero('fontanero-real'),
    ).expect(400);
    expect(await actividades.count()).toBe(0);

    await postActividad(payload, signFontanero('fontanero-real')).expect(201);
    const saved = await actividades.findOneBy({});
    expect(saved?.fontaneroId).toBe('fontanero-real');
  });
});
