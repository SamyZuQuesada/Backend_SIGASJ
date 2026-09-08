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
import { ActividadFontanero } from './entities/actividad-fontanero.entity';
import { TipoActividadFontanero } from './entities/tipo-actividad-fontanero.entity';
import { DocumentoActividadFontanero } from './entities/documento-actividad-fontanero.entity';
import {
  buildValidCreateActividadPayload,
  seedTiposActividadFontanero,
} from './testing/actividades-fontanero.test-helpers';

/**
 * QA #937 — validación, solicitud de corrección y reenvío end-to-end.
 */
describe('QA #937 — validación y corrección de actividades Fontanero', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let actividades: Repository<ActividadFontanero>;
  let tiposActividad: Repository<TipoActividadFontanero>;
  let tipoTomaPresionId: number;

  const signAs = (role: Role, sub: string) => {
    const payload: JwtPayload = {
      sub,
      email: `${sub}@asadasanjuan.cr`,
      role,
      name: 'Usuario QA',
    };
    return jwtService.sign(payload);
  };

  const postActividad = (
    body: Record<string, unknown>,
    token = signAs(Role.FONTANERO, 'fontanero-qa-1'),
  ) =>
    request(app.getHttpServer())
      .post('/api/v1/fontanero/actividades')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const authGet = (path: string, token: string) =>
    request(app.getHttpServer())
      .get(`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`);

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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await actividades.clear();
    await tiposActividad.clear();
    const tipos = await seedTiposActividadFontanero(tiposActividad);
    const tomaPresion = tipos.find(
      (tipo) => tipo.codigo === TipoActividadFontaneroCodigo.TOMA_PRESION,
    );
    tipoTomaPresionId = tomaPresion?.id ?? tipos[1].id;
  });

  it('flujo integral: registrar → solicitar corrección → listar → corregir → CORREGIDA', async () => {
    const fontaneroToken = signAs(Role.FONTANERO, 'fontanero-qa-1');
    const adminToken = signAs(Role.ADMINISTRADORA, 'admin-qa-1');

    const created = await postActividad(
      buildValidCreateActividadPayload(tipoTomaPresionId, {
        titulo: 'Medición sector 3',
        presionMedida: 42,
      }),
      fontaneroToken,
    ).expect(201);

    const actividadId = (created.body as { id: number }).id;

    await authPatch(
      `/admin/actividades/${actividadId}/solicitar-correccion`,
      { observacion: 'Verifique la presión registrada' },
      adminToken,
    ).expect(200);

    const listado = await authGet(
      '/fontanero/actividades/correcciones',
      fontaneroToken,
    ).expect(200);

    expect(listado.body).toMatchObject({ total: 1 });
    expect(listado.body.data[0]).toMatchObject({
      id: actividadId,
      estado: EstadoActividadFontanero.REQUIERE_CORRECCION,
      observacionCorreccion: 'Verifique la presión registrada',
    });

    await authGet(
      `/fontanero/actividades/${actividadId}`,
      fontaneroToken,
    ).expect(200);

    const corregida = await authPatch(
      `/fontanero/actividades/${actividadId}/corregir`,
      {
        titulo: 'Medición sector 3 corregida',
        presionMedida: 44,
      },
      fontaneroToken,
    ).expect(200);

    expect(corregida.body).toMatchObject({
      id: actividadId,
      titulo: 'Medición sector 3 corregida',
      estado: EstadoActividadFontanero.CORREGIDA,
      observacionCorreccion: null,
    });

    expect(await actividades.count()).toBe(1);

    const sinPendientes = await authGet(
      '/fontanero/actividades/correcciones',
      fontaneroToken,
    ).expect(200);
    expect(sinPendientes.body.total).toBe(0);
  });

  it('corregir con datos inválidos responde 400 y mantiene REQUIERE_CORRECCION', async () => {
    const fontaneroToken = signAs(Role.FONTANERO, 'fontanero-qa-1');
    const adminToken = signAs(Role.ADMINISTRADORA, 'admin-qa-1');

    const created = await postActividad(
      buildValidCreateActividadPayload(tipoTomaPresionId, {
        presionMedida: 40,
      }),
      fontaneroToken,
    ).expect(201);

    const actividadId = (created.body as { id: number }).id;

    await authPatch(
      `/admin/actividades/${actividadId}/solicitar-correccion`,
      { observacion: 'Ajuste la medición' },
      adminToken,
    ).expect(200);

    await authPatch(
      `/fontanero/actividades/${actividadId}/corregir`,
      { titulo: 'Intento inválido', presionMedida: -1 },
      fontaneroToken,
    ).expect(400);

    const persisted = await actividades.findOneByOrFail({ id: actividadId });
    expect(persisted.estado).toBe(EstadoActividadFontanero.REQUIERE_CORRECCION);
    expect(persisted.observacionCorreccion).toBe('Ajuste la medición');
  });

  it('solicitar corrección sobre actividad inexistente responde 404', async () => {
    const adminToken = signAs(Role.ADMINISTRADORA, 'admin-qa-1');

    await authPatch(
      '/admin/actividades/99999/solicitar-correccion',
      { observacion: 'No existe' },
      adminToken,
    ).expect(404);
  });

  it('corregir actividad que no está en REQUIERE_CORRECCION responde 403', async () => {
    const fontaneroToken = signAs(Role.FONTANERO, 'fontanero-qa-1');

    const created = await postActividad(
      buildValidCreateActividadPayload(tipoTomaPresionId, {
        presionMedida: 35,
      }),
      fontaneroToken,
    ).expect(201);

    const actividadId = (created.body as { id: number }).id;

    await authPatch(
      `/fontanero/actividades/${actividadId}/corregir`,
      { titulo: 'No permitido', presionMedida: 36 },
      fontaneroToken,
    ).expect(403);
  });

  it('lista de correcciones solo incluye propias pendientes', async () => {
    const fontanero1 = signAs(Role.FONTANERO, 'fontanero-1');
    const fontanero2 = signAs(Role.FONTANERO, 'fontanero-2');
    const adminToken = signAs(Role.ADMINISTRADORA, 'admin-qa-1');

    const actividad1 = await postActividad(
      buildValidCreateActividadPayload(tipoTomaPresionId, {
        titulo: 'Actividad fontanero 1',
        presionMedida: 30,
      }),
      fontanero1,
    ).expect(201);

    const actividad2 = await postActividad(
      buildValidCreateActividadPayload(tipoTomaPresionId, {
        titulo: 'Actividad fontanero 2',
        presionMedida: 31,
      }),
      fontanero2,
    ).expect(201);

    await authPatch(
      `/admin/actividades/${(actividad1.body as { id: number }).id}/solicitar-correccion`,
      { observacion: 'Motivo 1' },
      adminToken,
    ).expect(200);

    await authPatch(
      `/admin/actividades/${(actividad2.body as { id: number }).id}/solicitar-correccion`,
      { observacion: 'Motivo 2' },
      adminToken,
    ).expect(200);

    const listado1 = await authGet(
      '/fontanero/actividades/correcciones',
      fontanero1,
    ).expect(200);

    expect(listado1.body.total).toBe(1);
    expect(listado1.body.data[0].titulo).toBe('Actividad fontanero 1');

    const listado2 = await authGet(
      '/fontanero/actividades/correcciones',
      fontanero2,
    ).expect(200);

    expect(listado2.body.total).toBe(1);
    expect(listado2.body.data[0].titulo).toBe('Actividad fontanero 2');
  });
});
