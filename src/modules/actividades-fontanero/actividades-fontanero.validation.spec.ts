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

const assertReadableValidationError = (body: unknown) => {
  expect(body).toMatchObject({ statusCode: 400 });
  const message = (body as { message?: string | string[] }).message;
  expect(message).toBeDefined();
  if (Array.isArray(message)) {
    expect(message.length).toBeGreaterThan(0);
    for (const item of message) {
      expect(typeof item).toBe('string');
      expect(item.length).toBeGreaterThan(0);
    }
  } else {
    expect(typeof message).toBe('string');
    expect((message as string).length).toBeGreaterThan(0);
  }
};

describe('POST /api/v1/fontanero/actividades — validación (#931)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let actividades: Repository<ActividadFontanero>;
  let tiposActividad: Repository<TipoActividadFontanero>;
  let validTipoActividadId: number;

  const signFontanero = () => {
    const payload: JwtPayload = {
      sub: 'fontanero-1',
      email: 'fontanero@asadasanjuan.cr',
      role: Role.FONTANERO,
      name: 'Fontanero',
    };
    return jwtService.sign(payload);
  };

  const postActividad = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/v1/fontanero/actividades')
      .set('Authorization', `Bearer ${signFontanero()}`)
      .send(body);

  const validPayload = (overrides: Record<string, unknown> = {}) =>
    buildValidCreateActividadPayload(validTipoActividadId, overrides);

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
    const tipos = await seedTiposActividadFontanero(tiposActividad);
    validTipoActividadId = tipos[0].id;
  });

  it('payload válido responde 201 y persiste el registro', async () => {
    const payload = validPayload();
    const response = await postActividad(payload).expect(201);

    expect(response.body).toMatchObject({
      titulo: payload.titulo,
      tipoActividadId: payload.tipoActividadId,
      fechaActividad: payload.fechaActividad,
    });
    expect(await actividades.count()).toBe(1);
  });

  it('rechaza payload sin título', async () => {
    const { titulo: _titulo, ...payload } = validPayload();
    const response = await postActividad(payload).expect(400);

    assertReadableValidationError(response.body);
    expect(await actividades.count()).toBe(0);
  });

  it('rechaza título vacío o solo espacios', async () => {
    const response = await postActividad(
      validPayload({ titulo: '   ' }),
    ).expect(400);

    assertReadableValidationError(response.body);
    expect(JSON.stringify(response.body)).toContain('obligatorio');
    expect(await actividades.count()).toBe(0);
  });

  it('rechaza título que supera 200 caracteres', async () => {
    const response = await postActividad(
      validPayload({ titulo: 'A'.repeat(201) }),
    ).expect(400);

    assertReadableValidationError(response.body);
    expect(JSON.stringify(response.body)).toContain('200');
    expect(await actividades.count()).toBe(0);
  });

  it('rechaza payload sin fecha de actividad', async () => {
    const { fechaActividad: _fecha, ...payload } = validPayload();
    const response = await postActividad(payload).expect(400);

    assertReadableValidationError(response.body);
    expect(await actividades.count()).toBe(0);
  });

  it('rechaza fecha con formato incorrecto', async () => {
    const response = await postActividad(
      validPayload({ fechaActividad: '07/09/2026' }),
    ).expect(400);

    assertReadableValidationError(response.body);
    expect(JSON.stringify(response.body)).toContain('YYYY-MM-DD');
    expect(await actividades.count()).toBe(0);
  });

  it('rechaza fecha de calendario inválida', async () => {
    const response = await postActividad(
      validPayload({ fechaActividad: '2026-02-31' }),
    ).expect(400);

    assertReadableValidationError(response.body);
    expect(JSON.stringify(response.body)).toMatch(/válid/i);
    expect(await actividades.count()).toBe(0);
  });

  it('rechaza fecha futura', async () => {
    const response = await postActividad(
      validPayload({ fechaActividad: '2099-01-01' }),
    ).expect(400);

    assertReadableValidationError(response.body);
    expect(JSON.stringify(response.body)).toContain('futura');
    expect(await actividades.count()).toBe(0);
  });

  it('rechaza tipoActividadId inválido o menor a 1', async () => {
    const cero = await postActividad(
      validPayload({ tipoActividadId: 0 }),
    ).expect(400);
    assertReadableValidationError(cero.body);
    expect(await actividades.count()).toBe(0);

    const negativo = await postActividad(
      validPayload({ tipoActividadId: -1 }),
    ).expect(400);
    assertReadableValidationError(negativo.body);
    expect(await actividades.count()).toBe(0);
  });

  it('rechaza ubicación que supera 200 caracteres', async () => {
    const response = await postActividad(
      validPayload({ ubicacion: 'U'.repeat(201) }),
    ).expect(400);

    assertReadableValidationError(response.body);
    expect(await actividades.count()).toBe(0);
  });

  it('rechaza campos no permitidos enviados por el cliente', async () => {
    const response = await postActividad({
      ...validPayload(),
      fontaneroId: 'otro-fontanero',
    }).expect(400);

    assertReadableValidationError(response.body);
    expect(await actividades.count()).toBe(0);
  });

  it('rechaza tipo de actividad inexistente sin persistir', async () => {
    const response = await postActividad(
      buildValidCreateActividadPayload(9999),
    ).expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      message: 'Tipo de actividad no encontrado',
    });
    expect(await actividades.count()).toBe(0);
  });

  it('rechaza tipo de actividad inactivo sin persistir', async () => {
    await tiposActividad.update(
      { id: validTipoActividadId },
      { activo: false },
    );

    const response = await postActividad(validPayload()).expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
      message: 'El tipo de actividad no está activo',
    });
    expect(await actividades.count()).toBe(0);
  });

  it('valida datos específicos obligatorios según el tipo de actividad', async () => {
    const tipos = await tiposActividad.find({ order: { id: 'ASC' } });
    const tipoTomaPresion = tipos.find((t) => t.codigo === 'TOMA_PRESION');
    expect(tipoTomaPresion).toBeDefined();

    const invalido = await postActividad({
      tipoActividadId: tipoTomaPresion!.id,
      fechaActividad: '2026-09-07',
      titulo: 'Medición en tanque principal',
    }).expect(400);

    assertReadableValidationError(invalido.body);
    expect(JSON.stringify(invalido.body)).toContain('presión medida');
    expect(await actividades.count()).toBe(0);

    const valido = await postActividad({
      tipoActividadId: tipoTomaPresion!.id,
      fechaActividad: '2026-09-07',
      titulo: 'Medición en tanque principal',
      presionMedida: 45.0,
    }).expect(201);

    expect(valido.body).toMatchObject({
      tipoActividadId: tipoTomaPresion!.id,
      datosEspecificos: { presionMedida: 45.0 },
    });
    expect(await actividades.count()).toBe(1);
  });
});
