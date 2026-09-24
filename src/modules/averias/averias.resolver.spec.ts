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
  type AveriaAdminDetail,
  type AveriaFontaneroDetail,
  type ResolverAveriaResponse,
} from './averias.service';
import {
  AVERIA_FONTANERO_RESOLVER_FORBIDDEN,
  AVERIA_NO_EN_ATENCION,
  AVERIA_RESUELTA_OK,
  OBSERVACION_FINAL_VACIA,
} from './dto/resolver-averia.dto';
import { Averia } from './entities/averia.entity';
import { ObservacionAveria } from './entities/observacion-averia.entity';

const SENSITIVE =
  /password|passwordHash|refreshToken|"token"|sessions|credentials/i;
const OBSERVACION_FINAL =
  'Se reemplazó el tramo dañado y se verificó que no continúe la fuga.';

describe('PATCH /api/v1/fontanero/averias/:id/resolver', () => {
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

  const patchResolver = (
    id: number | string,
    body: Record<string, unknown>,
    token?: string | null,
  ) => {
    const req = request(app.getHttpServer()).patch(
      `/api/v1/fontanero/averias/${id}/resolver`,
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
          overrides.codigoSeguimiento ?? `AV-RES-${usuarioSeq}`,
        fechaReporte:
          overrides.fechaReporte ?? new Date('2026-09-12T15:00:00.000Z'),
        nombreReportante: overrides.nombreReportante ?? 'María Rodríguez',
        identificacionReportante: '1-2345-6789',
        telefonoReportante: '8888-1111',
        correoReportante: 'maria@example.com',
        idAbonado: 14,
        ubicacion: 'Frente a la escuela, 50 m sur',
        sectorComunidad: 'San Juan',
        descripcion: 'Fuga visible',
        estado: overrides.estado ?? EstadoAveria.EN_ATENCION,
        tipoAveria: overrides.tipoAveria ?? 'TUBERIA_DANADA',
        prioridad: overrides.prioridad ?? 'ALTA',
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
            ? new Date('2026-09-13T09:00:00.000Z')
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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await vaciarNotificacionesAveriaPrueba(averias.manager.connection);
    await observaciones.clear();
    await averias.clear();
  });

  it('cierra una avería en atención con observación final', async () => {
    const averia = await persistAveria({ codigoSeguimiento: 'AV-RES-OK' });
    const updatedAtAntes = averia.updatedAt;
    const before = Date.now();

    const response = await patchResolver(
      averia.id,
      { observacionFinal: `  ${OBSERVACION_FINAL}  ` },
      tokenA,
    ).expect(200);

    const body = response.body as ResolverAveriaResponse;
    expect(body.message).toBe(AVERIA_RESUELTA_OK);
    expect(body.data.estado).toBe(EstadoAveria.RESUELTA);
    expect(body.data.observacionesAtencion).toBe('Texto legado de atención');
    expect(body.data.observaciones).toHaveLength(1);
    expect(body.data.observaciones[0]?.observacion).toBe(OBSERVACION_FINAL);
    expect(body.data.observaciones[0]?.autor).toEqual({
      id: fontaneroA.idUsuario,
      nombre: 'Fontanero A',
    });
    expect(
      new Date(body.data.fechaResolucion as unknown as string).getTime(),
    ).toBeGreaterThanOrEqual(before - 1000);
    expect(JSON.stringify(body)).not.toMatch(SENSITIVE);
    expect(JSON.stringify(body.data)).not.toMatch(
      /fontaneroId|"estado":"EN_ATENCION"/,
    );

    const persistida = await averias.findOneBy({ id: averia.id });
    expect(persistida?.estado).toBe(EstadoAveria.RESUELTA);
    expect(persistida?.fechaResolucion).toBeInstanceOf(Date);
    expect(persistida?.observacionesAtencion).toBe('Texto legado de atención');
    expect(persistida?.idFontaneroAsignado).toBe(fontaneroA.idUsuario);
    expect(persistida?.updatedAt.getTime()).toBeGreaterThanOrEqual(
      updatedAtAntes.getTime(),
    );

    const rows = await observaciones.find({ where: { idAveria: averia.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.idUsuarioAutor).toBe(fontaneroA.idUsuario);
    expect(rows[0]?.fechaCreacion).toBeInstanceOf(Date);
  });

  it('rechaza observación vacía o solo espacios y no cambia el estado', async () => {
    const averia = await persistAveria({ codigoSeguimiento: 'AV-RES-EMPTY' });
    for (const observacionFinal of ['', '    ']) {
      const response = await patchResolver(
        averia.id,
        { observacionFinal },
        tokenA,
      ).expect(400);
      expect(
        publicMessage(response.body as { message?: string | string[] }),
      ).toContain(OBSERVACION_FINAL_VACIA);
    }
    expect(await observaciones.count()).toBe(0);
    expect((await averias.findOneBy({ id: averia.id }))?.estado).toBe(
      EstadoAveria.EN_ATENCION,
    );
  });

  it.each([
    [EstadoAveria.RECIBIDA, 'AV-RES-REC'],
    [EstadoAveria.ASIGNADA, 'AV-RES-ASIG'],
    [EstadoAveria.PENDIENTE, 'AV-RES-PEND'],
    [EstadoAveria.EN_REVISION, 'AV-RES-REV'],
    [EstadoAveria.RESUELTA, 'AV-RES-DONE'],
  ])('rechaza cierre desde %s', async (estado, codigo) => {
    const averia = await persistAveria({
      codigoSeguimiento: codigo,
      estado,
      fechaResolucion:
        estado === EstadoAveria.RESUELTA
          ? new Date('2026-09-14T12:00:00.000Z')
          : null,
    });
    const response = await patchResolver(
      averia.id,
      { observacionFinal: OBSERVACION_FINAL },
      tokenA,
    ).expect(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      message: AVERIA_NO_EN_ATENCION,
    });
    expect(await observaciones.count()).toBe(0);
    expect((await averias.findOneBy({ id: averia.id }))?.estado).toBe(estado);
  });

  it('Fontanero B no puede resolver la avería de A', async () => {
    const averia = await persistAveria({ codigoSeguimiento: 'AV-RES-AJENA' });
    const response = await patchResolver(
      averia.id,
      { observacionFinal: OBSERVACION_FINAL },
      tokenB,
    ).expect(403);
    expect(response.body).toEqual({
      statusCode: 403,
      message: AVERIA_FONTANERO_RESOLVER_FORBIDDEN,
    });
    expect(response.body).not.toHaveProperty('codigoSeguimiento');
    expect(await observaciones.count()).toBe(0);
    expect((await averias.findOneBy({ id: averia.id }))?.estado).toBe(
      EstadoAveria.EN_ATENCION,
    );
  });

  it('avería sin Fontanero no se cierra', async () => {
    const averia = await persistAveria({
      codigoSeguimiento: 'AV-RES-NA',
      idFontaneroAsignado: null,
      fechaAsignacion: null,
    });
    const response = await patchResolver(
      averia.id,
      { observacionFinal: OBSERVACION_FINAL },
      tokenA,
    ).expect(403);
    expect(response.body).toMatchObject({
      message: AVERIA_FONTANERO_RESOLVER_FORBIDDEN,
    });
    expect(await observaciones.count()).toBe(0);
  });

  it('avería inexistente responde 404', async () => {
    const response = await patchResolver(
      999999,
      { observacionFinal: OBSERVACION_FINAL },
      tokenA,
    ).expect(404);
    expect(response.body).toEqual({
      statusCode: 404,
      message: AVERIA_ADMIN_NOT_FOUND,
    });
  });

  it('sin sesión responde 401', async () => {
    const averia = await persistAveria({ codigoSeguimiento: 'AV-RES-401' });
    const response = await patchResolver(averia.id, {
      observacionFinal: OBSERVACION_FINAL,
    }).expect(401);
    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    expect((await averias.findOneBy({ id: averia.id }))?.estado).toBe(
      EstadoAveria.EN_ATENCION,
    );
  });

  it.each([
    [Role.ADMINISTRADORA, () => adminToken],
    [Role.SECRETARIA, () => signAs(Role.SECRETARIA, '2')],
    [Role.ABONADO, () => signAs(Role.ABONADO, '4')],
  ])('%s recibe 403 en la ruta del Fontanero', async (_role, token) => {
    const averia = await persistAveria({
      codigoSeguimiento: `AV-RES-${_role}`,
    });
    const response = await patchResolver(
      averia.id,
      { observacionFinal: OBSERVACION_FINAL },
      token(),
    ).expect(403);
    expect(response.body).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });
    expect(await observaciones.count()).toBe(0);
  });

  it('ID inválido responde 400', async () => {
    for (const id of ['abc', '0', '-1']) {
      const response = await patchResolver(
        id,
        {
          observacionFinal: OBSERVACION_FINAL,
        },
        tokenA,
      );
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        message: AVERIA_ADMIN_INVALID_ID,
      });
    }
  });

  it('rechaza estado, fecha y autor enviados en el body', async () => {
    const averia = await persistAveria({ codigoSeguimiento: 'AV-RES-MASS' });
    const response = await patchResolver(
      averia.id,
      {
        observacionFinal: OBSERVACION_FINAL,
        estado: EstadoAveria.RESUELTA,
        fechaResolucion: '2000-01-01',
        fontaneroId: 999,
      },
      tokenA,
    ).expect(400);
    expect(response.body).toMatchObject({ statusCode: 400 });
    expect((await averias.findOneBy({ id: averia.id }))?.estado).toBe(
      EstadoAveria.EN_ATENCION,
    );
    expect(await observaciones.count()).toBe(0);
  });

  it('el detalle del Fontanero y el administrativo reflejan el cierre', async () => {
    const averia = await persistAveria({ codigoSeguimiento: 'AV-RES-GET' });
    await patchResolver(
      averia.id,
      { observacionFinal: OBSERVACION_FINAL },
      tokenA,
    ).expect(200);

    const fontaneroDetalle = (
      await request(app.getHttpServer())
        .get(`/api/v1/fontanero/averias/${averia.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200)
    ).body as AveriaFontaneroDetail;
    expect(fontaneroDetalle.estado).toBe(EstadoAveria.RESUELTA);
    expect(fontaneroDetalle.fechaResolucion).toBeTruthy();
    expect(fontaneroDetalle.observaciones.at(-1)?.observacion).toBe(
      OBSERVACION_FINAL,
    );

    const adminDetalle = (
      await request(app.getHttpServer())
        .get(`/api/v1/admin/averias/${averia.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
    ).body as AveriaAdminDetail;
    expect(adminDetalle.estado).toBe(EstadoAveria.RESUELTA);
    expect(adminDetalle.fechaResolucion).toBeTruthy();
    expect(adminDetalle.observaciones.at(-1)?.observacion).toBe(
      OBSERVACION_FINAL,
    );
    expect(adminDetalle.observacionesAtencion).toBe('Texto legado de atención');
  });
});
