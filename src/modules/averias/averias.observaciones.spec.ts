import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import { Role } from '../../common/enums/role.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { Rol } from '../usuarios/entities/rol.entity';
import { HorarioLaboralFontanero } from '../usuarios/entities/horario-laboral-fontanero.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  crearUsuarioPrueba,
  seedRolesBase,
} from '../usuarios/usuarios.test-helpers';
import { AVERIA_ADMIN_INVALID_ID } from './averia-admin-id.pipe';
import { AveriasModule } from './averias.module';
import {
  AVERIAS_TEST_ENTITIES,
  vaciarNotificacionesAveriaPrueba,
} from './averias.test-entities';
import {
  AVERIA_ADMIN_NOT_FOUND,
  AVERIA_FONTANERO_FORBIDDEN,
  type AveriaAdminDetail,
  type AveriaFontaneroDetail,
  type CreateObservacionAveriaResponse,
} from './averias.service';
import {
  OBSERVACION_AVERIA_REGISTRADA,
  OBSERVACION_AVERIA_VACIA,
} from './dto/create-observacion-averia.dto';
import { Averia } from './entities/averia.entity';
import { ObservacionAveria } from './entities/observacion-averia.entity';

const SENSITIVE =
  /password|passwordHash|refreshToken|"token"|sessions|credentials/i;

describe('POST /api/v1/fontanero/averias/:id/observaciones', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let averias: Repository<Averia>;
  let observaciones: Repository<ObservacionAveria>;
  let usuarios: Repository<Usuario>;
  let rolesMap: Record<Role, Rol>;
  let fontaneroA: Usuario;
  let fontaneroB: Usuario;
  let tokenA: string;
  let tokenB: string;
  let adminToken: string;
  let secretariaToken: string;
  let usuarioSeq = 0;

  const signAs = (role: Role, sub: string, name = 'Usuario') => {
    const payload: JwtPayload = {
      sub,
      email: 'usuario@asadasanjuan.cr',
      role,
      name,
    };
    return jwtService.sign(payload);
  };

  const postObservacion = (
    id: number | string,
    body: Record<string, unknown>,
    token?: string | null,
  ) => {
    const req = request(app.getHttpServer()).post(
      `/api/v1/fontanero/averias/${id}/observaciones`,
    );
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.send(body);
  };

  const persistAveria = async (overrides: Partial<Averia> = {}) => {
    usuarioSeq += 1;
    return averias.save(
      averias.create({
        codigoSeguimiento:
          overrides.codigoSeguimiento ?? `AV-OBS-${usuarioSeq}`,
        fechaReporte:
          overrides.fechaReporte ?? new Date('2026-09-12T15:00:00.000Z'),
        nombreReportante: overrides.nombreReportante ?? 'María Rodríguez',
        identificacionReportante:
          overrides.identificacionReportante === undefined
            ? '1-2345-6789'
            : overrides.identificacionReportante,
        telefonoReportante: overrides.telefonoReportante ?? '8888-1111',
        correoReportante:
          overrides.correoReportante === undefined
            ? 'maria@example.com'
            : overrides.correoReportante,
        idAbonado: overrides.idAbonado === undefined ? 14 : overrides.idAbonado,
        ubicacion: overrides.ubicacion ?? 'Frente a la escuela, 50 m sur',
        sectorComunidad: overrides.sectorComunidad ?? 'San Juan',
        descripcion: overrides.descripcion ?? 'Fuga visible',
        estado: overrides.estado ?? EstadoAveria.ASIGNADA,
        tipoAveria:
          overrides.tipoAveria === undefined ? null : overrides.tipoAveria,
        prioridad:
          overrides.prioridad === undefined ? null : overrides.prioridad,
        idFontaneroAsignado:
          overrides.idFontaneroAsignado === undefined
            ? fontaneroA.idUsuario
            : overrides.idFontaneroAsignado,
        fechaAsignacion:
          overrides.fechaAsignacion === undefined
            ? new Date('2026-09-13T08:15:00.000Z')
            : overrides.fechaAsignacion,
        fechaInicioAtencion:
          overrides.fechaInicioAtencion === undefined
            ? null
            : overrides.fechaInicioAtencion,
        fechaResolucion:
          overrides.fechaResolucion === undefined
            ? null
            : overrides.fechaResolucion,
        observacionesAtencion:
          overrides.observacionesAtencion === undefined
            ? 'Texto legado de atención'
            : overrides.observacionesAtencion,
      }),
    );
  };

  const publicMessage = (body: { message?: string | string[] }) => {
    const message = body.message;
    return Array.isArray(message) ? message.join(' ') : (message ?? '');
  };

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
          entities: [...AVERIAS_TEST_ENTITIES],
          synchronize: true,
        }),
        AuthModule,
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

    jwtService = moduleFixture.get(JwtService);
    const dataSource = moduleFixture.get(DataSource);
    averias = dataSource.getRepository(Averia);
    observaciones = dataSource.getRepository(ObservacionAveria);
    usuarios = dataSource.getRepository(Usuario);
    rolesMap = await seedRolesBase(dataSource.getRepository(Rol));

    fontaneroA = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero A',
      correo: 'fontanero.a@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    fontaneroB = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero B',
      correo: 'fontanero.b@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    tokenA = signAs(
      Role.FONTANERO,
      String(fontaneroA.idUsuario),
      'Fontanero A',
    );
    tokenB = signAs(
      Role.FONTANERO,
      String(fontaneroB.idUsuario),
      'Fontanero B',
    );
    adminToken = signAs(Role.ADMINISTRADORA, '1', 'Administradora');
    secretariaToken = signAs(Role.SECRETARIA, '2', 'Secretaria');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await vaciarNotificacionesAveriaPrueba(averias.manager.connection);
    await observaciones.clear();
    await averias.clear();
  });

  it('Fontanero A registra una observación válida en su avería', async () => {
    const averia = await persistAveria({ codigoSeguimiento: 'AV-OBS-OK' });
    const before = Date.now();

    const response = await postObservacion(
      averia.id,
      { observacion: 'Se revisó la ubicación y se identificó la fuga.' },
      tokenA,
    ).expect(201);

    const body = response.body as CreateObservacionAveriaResponse;
    expect(body.message).toBe(OBSERVACION_AVERIA_REGISTRADA);
    expect(body.data.id).toBeGreaterThan(0);
    expect(body.data.observacion).toBe(
      'Se revisó la ubicación y se identificó la fuga.',
    );
    expect(body.data.autor).toEqual({
      id: fontaneroA.idUsuario,
      nombre: 'Fontanero A',
    });
    expect(new Date(body.data.fechaCreacion).getTime()).toBeGreaterThanOrEqual(
      before - 1000,
    );
    expect(JSON.stringify(body)).not.toMatch(SENSITIVE);

    const rows = await observaciones.find({
      where: { idAveria: averia.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.idUsuarioAutor).toBe(fontaneroA.idUsuario);
    expect(rows[0]?.idAveria).toBe(averia.id);
    expect(rows[0]?.fechaCreacion).toBeInstanceOf(Date);

    const averiaLoaded = await averias.findOneBy({ id: averia.id });
    expect(averiaLoaded?.observacionesAtencion).toBe(
      'Texto legado de atención',
    );
  });

  it('una segunda observación crea otra fila y no altera la primera', async () => {
    const averia = await persistAveria({ codigoSeguimiento: 'AV-OBS-2' });
    const first = await postObservacion(
      averia.id,
      { observacion: 'Primera revisión en sitio.' },
      tokenA,
    ).expect(201);
    const firstBody = first.body as CreateObservacionAveriaResponse;

    const second = await postObservacion(
      averia.id,
      { observacion: 'Se verificó que no continúe la fuga.' },
      tokenA,
    ).expect(201);
    const secondBody = second.body as CreateObservacionAveriaResponse;

    expect(secondBody.data.id).not.toBe(firstBody.data.id);

    const rows = await observaciones.find({
      where: { idAveria: averia.id },
      order: { id: 'ASC' },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.observacion).toBe('Primera revisión en sitio.');
    expect(rows[1]?.observacion).toBe('Se verificó que no continúe la fuga.');
    expect(rows[0]?.id).toBe(firstBody.data.id);
  });

  it('recorta espacios alrededor del texto válido', async () => {
    const averia = await persistAveria({ codigoSeguimiento: 'AV-OBS-TRIM' });
    const response = await postObservacion(
      averia.id,
      {
        observacion:
          '  Se realizó la reparación y se verificó que no continúe la fuga.  ',
      },
      tokenA,
    ).expect(201);

    const body = response.body as CreateObservacionAveriaResponse;
    expect(body.data.observacion).toBe(
      'Se realizó la reparación y se verificó que no continúe la fuga.',
    );
    const row = await observaciones.findOneBy({ id: body.data.id });
    expect(row?.observacion).toBe(
      'Se realizó la reparación y se verificó que no continúe la fuga.',
    );
  });

  it('texto vacío responde 400 y no inserta', async () => {
    const averia = await persistAveria({ codigoSeguimiento: 'AV-OBS-EMPTY' });
    const response = await postObservacion(
      averia.id,
      { observacion: '' },
      tokenA,
    ).expect(400);
    expect(
      publicMessage(response.body as { message?: string | string[] }),
    ).toContain(OBSERVACION_AVERIA_VACIA);
    expect(await observaciones.count()).toBe(0);
  });

  it('solo espacios responde 400 y no inserta', async () => {
    const averia = await persistAveria({ codigoSeguimiento: 'AV-OBS-SPACES' });
    const response = await postObservacion(
      averia.id,
      { observacion: '    ' },
      tokenA,
    ).expect(400);
    expect(
      publicMessage(response.body as { message?: string | string[] }),
    ).toContain(OBSERVACION_AVERIA_VACIA);
    expect(await observaciones.count()).toBe(0);
  });

  it('sin sesión responde 401 y no inserta', async () => {
    const averia = await persistAveria({ codigoSeguimiento: 'AV-OBS-401' });
    const response = await postObservacion(averia.id, {
      observacion: 'Prueba sin sesión',
    }).expect(401);
    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    expect(await observaciones.count()).toBe(0);
  });

  it.each([
    [Role.ADMINISTRADORA, () => adminToken],
    [Role.SECRETARIA, () => secretariaToken],
    [Role.ABONADO, () => signAs(Role.ABONADO, '4')],
  ])('%s recibe 403 en la ruta del Fontanero', async (_role, token) => {
    const averia = await persistAveria({
      codigoSeguimiento: `AV-OBS-${_role}`,
    });
    const response = await postObservacion(
      averia.id,
      { observacion: 'Intento administrativo' },
      token(),
    ).expect(403);
    expect(response.body).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });
    expect(await observaciones.count()).toBe(0);
  });

  it('Fontanero B no puede registrar sobre la avería de A', async () => {
    const averia = await persistAveria({
      codigoSeguimiento: 'AV-OBS-AJENA',
      idFontaneroAsignado: fontaneroA.idUsuario,
    });
    const response = await postObservacion(
      averia.id,
      { observacion: 'Intento sobre avería ajena' },
      tokenB,
    ).expect(403);
    expect(response.body).toEqual({
      statusCode: 403,
      message: AVERIA_FONTANERO_FORBIDDEN,
    });
    expect(response.body).not.toHaveProperty('codigoSeguimiento');
    expect(await observaciones.count()).toBe(0);
  });

  it('avería sin Fontanero asignado se rechaza con 403', async () => {
    const averia = await persistAveria({
      codigoSeguimiento: 'AV-OBS-NA',
      estado: EstadoAveria.EN_REVISION,
      idFontaneroAsignado: null,
      fechaAsignacion: null,
    });
    const response = await postObservacion(
      averia.id,
      { observacion: 'Sin asignación' },
      tokenA,
    ).expect(403);
    expect(response.body).toMatchObject({
      statusCode: 403,
      message: AVERIA_FONTANERO_FORBIDDEN,
    });
    expect(await observaciones.count()).toBe(0);
  });

  it('avería inexistente responde 404', async () => {
    const response = await postObservacion(
      999999,
      { observacion: 'No existe' },
      tokenA,
    ).expect(404);
    expect(response.body).toEqual({
      statusCode: 404,
      message: AVERIA_ADMIN_NOT_FOUND,
    });
    expect(await observaciones.count()).toBe(0);
  });

  it('ID inválido responde 400', async () => {
    for (const id of ['abc', '0', '-1', '12.5']) {
      const response = await postObservacion(
        id,
        { observacion: 'Texto válido' },
        tokenA,
      );
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        statusCode: 400,
        message: AVERIA_ADMIN_INVALID_ID,
      });
    }
    expect(await observaciones.count()).toBe(0);
  });

  it('descarta o rechaza autor, fecha e IDs enviados en el body', async () => {
    const averia = await persistAveria({ codigoSeguimiento: 'AV-OBS-MASS' });
    const before = Date.now();
    const response = await postObservacion(
      averia.id,
      {
        observacion: 'Prueba',
        fontaneroId: 999,
        autorId: 999,
        fechaCreacion: '2000-01-01',
        id: 50,
      },
      tokenA,
    );

    expect(response.status).toBe(400);
    expect(await observaciones.count()).toBe(0);

    const valid = await postObservacion(
      averia.id,
      { observacion: 'Prueba autorizada' },
      tokenA,
    ).expect(201);
    const body = valid.body as CreateObservacionAveriaResponse;
    expect(body.data.autor.id).toBe(fontaneroA.idUsuario);
    expect(body.data.autor.id).not.toBe(999);
    expect(new Date(body.data.fechaCreacion).getFullYear()).not.toBe(2000);
    expect(new Date(body.data.fechaCreacion).getTime()).toBeGreaterThanOrEqual(
      before - 1000,
    );
  });

  it('una reasignación posterior impide guardar con la autorización antigua', async () => {
    const averia = await persistAveria({
      codigoSeguimiento: 'AV-OBS-RACE',
      idFontaneroAsignado: fontaneroA.idUsuario,
    });
    averia.idFontaneroAsignado = fontaneroB.idUsuario;
    await averias.save(averia);

    const response = await postObservacion(
      averia.id,
      { observacion: 'Después de la reasignación' },
      tokenA,
    ).expect(403);
    expect(response.body).toMatchObject({
      statusCode: 403,
      message: AVERIA_FONTANERO_FORBIDDEN,
    });
    expect(await observaciones.count()).toBe(0);
  });

  it('el detalle del Fontanero y el administrativo recuperan el historial cronológico', async () => {
    const averia = await persistAveria({
      codigoSeguimiento: 'AV-OBS-GET',
      observacionesAtencion: 'Texto legado de atención',
    });
    await postObservacion(
      averia.id,
      { observacion: 'Primera nota' },
      tokenA,
    ).expect(201);
    await postObservacion(
      averia.id,
      { observacion: 'Segunda nota' },
      tokenA,
    ).expect(201);

    const fontaneroDetalle = (
      await request(app.getHttpServer())
        .get(`/api/v1/fontanero/averias/${averia.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200)
    ).body as AveriaFontaneroDetail;

    expect(fontaneroDetalle.observacionesAtencion).toBe(
      'Texto legado de atención',
    );
    expect(fontaneroDetalle.observaciones).toHaveLength(2);
    expect(
      fontaneroDetalle.observaciones.map((item) => item.observacion),
    ).toEqual(['Primera nota', 'Segunda nota']);
    expect(fontaneroDetalle.observaciones[0]?.id).toBeLessThan(
      fontaneroDetalle.observaciones[1]?.id ?? 0,
    );
    expect(JSON.stringify(fontaneroDetalle)).not.toMatch(SENSITIVE);

    const adminDetalle = (
      await request(app.getHttpServer())
        .get(`/api/v1/admin/averias/${averia.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
    ).body as AveriaAdminDetail;

    expect(adminDetalle.observacionesAtencion).toBe('Texto legado de atención');
    expect(adminDetalle.observaciones).toHaveLength(2);
    expect(adminDetalle.observaciones?.map((item) => item.observacion)).toEqual(
      ['Primera nota', 'Segunda nota'],
    );
    expect(adminDetalle.observaciones?.[0]?.autor).toEqual({
      id: fontaneroA.idUsuario,
      nombre: 'Fontanero A',
    });
    expect(JSON.stringify(adminDetalle)).not.toMatch(SENSITIVE);
  });
});
