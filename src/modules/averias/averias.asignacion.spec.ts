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
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  crearUsuarioPrueba,
  seedRolesBase,
  seedStaffLoginUsers,
} from '../usuarios/usuarios.test-helpers';
import { AVERIA_ADMIN_INVALID_ID } from './averia-admin-id.pipe';
import { AveriasModule } from './averias.module';
import {
  AVERIA_ASIGNADA_SIN_FONTANERO,
  mensajeTransicionEstadoAveriaInvalida,
} from './averias.estado-transiciones';
import {
  AVERIA_ADMIN_NOT_FOUND,
  AVERIA_YA_ASIGNADA,
  FONTANERO_ASIGNABLE_NOT_FOUND,
  FONTANERO_INACTIVO,
  FONTANERO_ROL_INVALIDO,
  type AveriaAdminDetail,
  type AveriasAdminFontanerosListado,
  type AveriasAdminListado,
} from './averias.service';
import { Averia } from './entities/averia.entity';

describe('PBI 2.4 — asignación de avería al Fontanero', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let averias: Repository<Averia>;
  let usuarios: Repository<Usuario>;
  let rolesMap: Record<Role, Rol>;
  let adminToken: string;
  let secretariaToken: string;
  let usuarioSeq = 0;

  const persistUsuario = (
    input: {
      nombre?: string;
      role?: Role;
      activo?: boolean;
    } = {},
  ) => {
    usuarioSeq += 1;
    return crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: input.nombre ?? `Fontanero ${usuarioSeq}`,
      correo: `fontanero.${usuarioSeq}.${Date.now()}@asadasanjuan.cr`,
      role: input.role ?? Role.FONTANERO,
      activo: input.activo,
    });
  };

  const signAs = (role: Role, sub = '1') => {
    const payload: JwtPayload = {
      sub,
      email: 'usuario@asadasanjuan.cr',
      role,
      name: 'Usuario',
    };
    return jwtService.sign(payload);
  };

  const persistAveria = async (overrides: Partial<Averia> = {}) => {
    return averias.save(
      averias.create({
        codigoSeguimiento: overrides.codigoSeguimiento ?? 'AV-ASG-0001',
        fechaReporte:
          overrides.fechaReporte ?? new Date('2026-09-12T15:00:00.000Z'),
        nombreReportante: overrides.nombreReportante ?? 'María Rodríguez',
        identificacionReportante: null,
        telefonoReportante: '8888-1111',
        correoReportante: null,
        idAbonado: null,
        ubicacion: 'Frente a la escuela',
        sectorComunidad: 'San Juan',
        descripcion: 'Fuga visible',
        estado: overrides.estado ?? EstadoAveria.EN_REVISION,
        tipoAveria: overrides.tipoAveria ?? null,
        prioridad: overrides.prioridad ?? null,
        idFontaneroAsignado:
          overrides.idFontaneroAsignado === undefined
            ? null
            : overrides.idFontaneroAsignado,
        fechaAsignacion:
          overrides.fechaAsignacion === undefined
            ? null
            : overrides.fechaAsignacion,
        fechaInicioAtencion: null,
        fechaResolucion: null,
        observacionesAtencion: null,
      }),
    );
  };

  const patchAsignacion = (
    id: number | string,
    body: Record<string, unknown>,
    token?: string | null,
  ) => {
    const req = request(app.getHttpServer()).patch(
      `/api/v1/admin/averias/${id}/asignacion`,
    );
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.send(body);
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
          entities: [Averia, Usuario, Rol],
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
    usuarios = dataSource.getRepository(Usuario);
    rolesMap = await seedRolesBase(dataSource.getRepository(Rol));
    await seedStaffLoginUsers(usuarios, rolesMap);

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@asadasanjuan.cr', password: 'Password123!' });
    expect(adminLogin.status).toBe(200);
    adminToken = (adminLogin.body as { accessToken: string }).accessToken;

    const secretariaLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'secretaria@asadasanjuan.cr',
        password: 'Password123!',
      });
    expect(secretariaLogin.status).toBe(200);
    secretariaToken = (secretariaLogin.body as { accessToken: string })
      .accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await averias.clear();
    await usuarios.clear();
  });

  it('lista fontaneros asignables como { id, nombre } sin secretos', async () => {
    const fontanero = await persistUsuario({ nombre: 'Carlos Pérez' });
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/averias/fontaneros')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const body = response.body as AveriasAdminFontanerosListado;
    expect(body.data).toEqual([
      { id: fontanero.idUsuario, nombre: 'Carlos Pérez' },
    ]);
    expect(JSON.stringify(body)).not.toMatch(
      /password|passwordHash|refreshToken/i,
    );
  });

  it('asigna un Usuario existente, guarda fecha y pasa EN_REVISION → ASIGNADA', async () => {
    const fontanero = await persistUsuario();
    const saved = await persistAveria({ codigoSeguimiento: 'AV-ASG-OK' });
    const before = Date.now();

    const response = await patchAsignacion(
      saved.id,
      { fontaneroId: fontanero.idUsuario },
      secretariaToken,
    ).expect(200);
    const body = response.body as AveriaAdminDetail;

    expect(body.estado).toBe(EstadoAveria.ASIGNADA);
    expect(body.fontanero).toEqual({
      id: fontanero.idUsuario,
      nombre: fontanero.nombre,
    });
    expect(body.fechaAsignacion).toBeDefined();
    expect(
      new Date(body.fechaAsignacion as unknown as string).getTime(),
    ).toBeGreaterThanOrEqual(before - 1000);
    expect(body).not.toHaveProperty('idFontaneroAsignado');
    expect(body).not.toHaveProperty('passwordHash');

    const persistida = await averias.findOneBy({ id: saved.id });
    expect(persistida?.estado).toBe(EstadoAveria.ASIGNADA);
    expect(persistida?.idFontaneroAsignado).toBe(fontanero.idUsuario);
    expect(persistida?.fechaAsignacion).toBeInstanceOf(Date);

    const detalle = await request(app.getHttpServer())
      .get(`/api/v1/admin/averias/${saved.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(detalle.body).toMatchObject({
      estado: EstadoAveria.ASIGNADA,
      fontanero: { id: fontanero.idUsuario, nombre: fontanero.nombre },
    });

    const listado = await request(app.getHttpServer())
      .get('/api/v1/admin/averias')
      .query({ fontaneroId: fontanero.idUsuario })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((listado.body as AveriasAdminListado).total).toBe(1);
  });

  it('también asigna desde PENDIENTE porque 2.3 lo permite', async () => {
    const fontanero = await persistUsuario();
    const saved = await persistAveria({
      codigoSeguimiento: 'AV-ASG-PEN',
      estado: EstadoAveria.PENDIENTE,
    });
    await patchAsignacion(
      saved.id,
      { fontaneroId: fontanero.idUsuario },
      adminToken,
    ).expect(200);
    const persistida = await averias.findOneBy({ id: saved.id });
    expect(persistida?.estado).toBe(EstadoAveria.ASIGNADA);
  });

  it('avería inexistente → 404', async () => {
    const fontanero = await persistUsuario();
    const response = await patchAsignacion(
      9999,
      { fontaneroId: fontanero.idUsuario },
      adminToken,
    ).expect(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      message: AVERIA_ADMIN_NOT_FOUND,
    });
  });

  it('fontanero inexistente → 404', async () => {
    const saved = await persistAveria({ codigoSeguimiento: 'AV-ASG-NF' });
    const response = await patchAsignacion(
      saved.id,
      { fontaneroId: 8888 },
      adminToken,
    ).expect(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      message: FONTANERO_ASIGNABLE_NOT_FOUND,
    });
  });

  it('RESUELTA y CANCELADA no son asignables', async () => {
    const fontanero = await persistUsuario();
    const resuelta = await persistAveria({
      codigoSeguimiento: 'AV-ASG-RES',
      estado: EstadoAveria.RESUELTA,
    });
    const cancelada = await persistAveria({
      codigoSeguimiento: 'AV-ASG-CAN',
      estado: EstadoAveria.CANCELADA,
    });

    const r1 = await patchAsignacion(
      resuelta.id,
      { fontaneroId: fontanero.idUsuario },
      adminToken,
    ).expect(400);
    expect(r1.body).toMatchObject({
      message: mensajeTransicionEstadoAveriaInvalida(
        EstadoAveria.RESUELTA,
        EstadoAveria.ASIGNADA,
      ),
    });

    const r2 = await patchAsignacion(
      cancelada.id,
      { fontaneroId: fontanero.idUsuario },
      adminToken,
    ).expect(400);
    expect(r2.body).toMatchObject({
      message: mensajeTransicionEstadoAveriaInvalida(
        EstadoAveria.CANCELADA,
        EstadoAveria.ASIGNADA,
      ),
    });
  });

  it('RECIBIDA no es asignable (transición 2.3)', async () => {
    const fontanero = await persistUsuario();
    const saved = await persistAveria({
      codigoSeguimiento: 'AV-ASG-REC',
      estado: EstadoAveria.RECIBIDA,
    });
    const response = await patchAsignacion(
      saved.id,
      { fontaneroId: fontanero.idUsuario },
      adminToken,
    ).expect(400);
    expect(response.body).toMatchObject({
      message: mensajeTransicionEstadoAveriaInvalida(
        EstadoAveria.RECIBIDA,
        EstadoAveria.ASIGNADA,
      ),
    });
  });

  it('rechaza si ya tiene fontanero asignado', async () => {
    const actual = await persistUsuario({ nombre: 'Fontanero actual' });
    const otro = await persistUsuario({ nombre: 'Fontanero otro' });
    const saved = await persistAveria({
      codigoSeguimiento: 'AV-ASG-DUP',
      estado: EstadoAveria.ASIGNADA,
      idFontaneroAsignado: actual.idUsuario,
      fechaAsignacion: new Date('2026-09-13T08:00:00.000Z'),
    });
    const response = await patchAsignacion(
      saved.id,
      { fontaneroId: otro.idUsuario },
      adminToken,
    ).expect(400);
    expect(response.body).toMatchObject({
      statusCode: 400,
      message: AVERIA_YA_ASIGNADA,
    });
    const persistida = await averias.findOneBy({ id: saved.id });
    expect(persistida?.idFontaneroAsignado).toBe(actual.idUsuario);
  });

  it('FONTANERO no puede asignar ni listar candidatos (403)', async () => {
    const fontanero = await persistUsuario();
    const saved = await persistAveria({ codigoSeguimiento: 'AV-ASG-403' });
    const token = signAs(Role.FONTANERO, String(fontanero.idUsuario));

    await patchAsignacion(
      saved.id,
      { fontaneroId: fontanero.idUsuario },
      token,
    ).expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/admin/averias/fontaneros')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('sin token → 401; ID/body inválidos → 400', async () => {
    const saved = await persistAveria({ codigoSeguimiento: 'AV-ASG-VAL' });
    await patchAsignacion(saved.id, { fontaneroId: 1 }).expect(401);

    const invalidId = await patchAsignacion(
      'abc',
      { fontaneroId: 1 },
      adminToken,
    ).expect(400);
    expect(invalidId.body).toMatchObject({
      message: AVERIA_ADMIN_INVALID_ID,
    });

    await patchAsignacion(saved.id, {}, adminToken).expect(400);
    await patchAsignacion(
      saved.id,
      { fontaneroId: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
      adminToken,
    ).expect(400);
    await patchAsignacion(
      saved.id,
      { fontaneroId: 1, extra: true },
      adminToken,
    ).expect(400);
  });

  it('2.1, 2.2 y 2.3 siguen funcionando junto a la asignación', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/public/averias')
      .send({
        nombreReportante: 'María Rodríguez',
        telefonoReportante: '8888-8888',
        ubicacion: 'Frente a la escuela',
        sectorComunidad: 'San Juan',
        descripcion: 'Fuga visible en tubería',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      data: { estado: 'Recibida' },
    });

    const listado = await request(app.getHttpServer())
      .get('/api/v1/admin/averias')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((listado.body as AveriasAdminListado).total).toBe(1);

    const averia = await averias.find();
    const estado = await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${averia[0].id}/estado`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: EstadoAveria.EN_REVISION })
      .expect(200);
    expect((estado.body as AveriaAdminDetail).estado).toBe(
      EstadoAveria.EN_REVISION,
    );
  });

  it('PATCH /estado no puede marcar ASIGNADA sin fontanero', async () => {
    const enRevision = await persistAveria({
      codigoSeguimiento: 'AV-ASG-EST',
      estado: EstadoAveria.EN_REVISION,
    });
    const pendiente = await persistAveria({
      codigoSeguimiento: 'AV-ASG-EST2',
      estado: EstadoAveria.PENDIENTE,
    });

    const r1 = await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${enRevision.id}/estado`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: EstadoAveria.ASIGNADA })
      .expect(400);
    expect(r1.body).toMatchObject({ message: AVERIA_ASIGNADA_SIN_FONTANERO });

    const r2 = await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${pendiente.id}/estado`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: EstadoAveria.ASIGNADA })
      .expect(400);
    expect(r2.body).toMatchObject({ message: AVERIA_ASIGNADA_SIN_FONTANERO });
  });

  it('una avería ASIGNADA por /asignacion siempre tiene fontanero y fecha', async () => {
    const fontanero = await persistUsuario();
    const saved = await persistAveria({ codigoSeguimiento: 'AV-ASG-INV' });
    await patchAsignacion(
      saved.id,
      { fontaneroId: fontanero.idUsuario },
      adminToken,
    ).expect(200);

    const persistida = await averias.findOneBy({ id: saved.id });
    expect(persistida?.estado).toBe(EstadoAveria.ASIGNADA);
    expect(persistida?.idFontaneroAsignado).not.toBeNull();
    expect(persistida?.idFontaneroAsignado).toBe(fontanero.idUsuario);
    expect(persistida?.fechaAsignacion).toBeInstanceOf(Date);
  });

  it('ABONADO no puede asignar (403)', async () => {
    const fontanero = await persistUsuario();
    const saved = await persistAveria({ codigoSeguimiento: 'AV-ASG-ABO' });
    await patchAsignacion(
      saved.id,
      { fontaneroId: fontanero.idUsuario },
      signAs('ABONADO' as Role, '9'),
    ).expect(403);
  });

  it('GET /fontaneros devuelve A y B, no Secretaria, Administradora ni inactivo', async () => {
    const fontaneroA = await persistUsuario({ nombre: 'Carlos Pérez' });
    const fontaneroB = await persistUsuario({ nombre: 'José Ramírez' });
    await persistUsuario({
      nombre: 'Secretaria extra',
      role: Role.SECRETARIA,
    });
    await persistUsuario({
      nombre: 'Otra admin',
      role: Role.ADMINISTRADORA,
    });
    await persistUsuario({
      nombre: 'Fontanero inactivo',
      activo: false,
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/averias/fontaneros')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const body = response.body as AveriasAdminFontanerosListado;
    expect(body.data).toEqual([
      { id: fontaneroA.idUsuario, nombre: 'Carlos Pérez' },
      { id: fontaneroB.idUsuario, nombre: 'José Ramírez' },
    ]);
  });

  it('asigna Avería A a Fontanero A y Avería B a Fontanero B', async () => {
    const fontaneroA = await persistUsuario({ nombre: 'Carlos Pérez' });
    const fontaneroB = await persistUsuario({ nombre: 'José Ramírez' });
    const averiaA = await persistAveria({ codigoSeguimiento: 'AV-ASG-A' });
    const averiaB = await persistAveria({ codigoSeguimiento: 'AV-ASG-B' });

    const r1 = await patchAsignacion(
      averiaA.id,
      { fontaneroId: fontaneroA.idUsuario },
      adminToken,
    ).expect(200);
    const r2 = await patchAsignacion(
      averiaB.id,
      { fontaneroId: fontaneroB.idUsuario },
      adminToken,
    ).expect(200);

    expect((r1.body as AveriaAdminDetail).fontanero).toEqual({
      id: fontaneroA.idUsuario,
      nombre: 'Carlos Pérez',
    });
    expect((r2.body as AveriaAdminDetail).fontanero).toEqual({
      id: fontaneroB.idUsuario,
      nombre: 'José Ramírez',
    });
    expect(
      (await averias.findOneBy({ id: averiaA.id }))?.idFontaneroAsignado,
    ).toBe(fontaneroA.idUsuario);
    expect(
      (await averias.findOneBy({ id: averiaB.id }))?.idFontaneroAsignado,
    ).toBe(fontaneroB.idUsuario);
  });

  it('rechaza Secretaria, Administradora y Fontanero inactivo', async () => {
    const secretaria = await persistUsuario({
      nombre: 'Secretaria no asignable',
      role: Role.SECRETARIA,
    });
    const administradora = await persistUsuario({
      nombre: 'Admin no asignable',
      role: Role.ADMINISTRADORA,
    });
    const inactivo = await persistUsuario({
      nombre: 'Fontanero inactivo',
      activo: false,
    });
    const averiaSec = await persistAveria({ codigoSeguimiento: 'AV-ASG-SEC' });
    const averiaAdm = await persistAveria({ codigoSeguimiento: 'AV-ASG-ADM' });
    const averiaIna = await persistAveria({ codigoSeguimiento: 'AV-ASG-INA' });

    const rSec = await patchAsignacion(
      averiaSec.id,
      { fontaneroId: secretaria.idUsuario },
      adminToken,
    ).expect(400);
    expect(rSec.body).toMatchObject({ message: FONTANERO_ROL_INVALIDO });

    const rAdm = await patchAsignacion(
      averiaAdm.id,
      { fontaneroId: administradora.idUsuario },
      adminToken,
    ).expect(400);
    expect(rAdm.body).toMatchObject({ message: FONTANERO_ROL_INVALIDO });

    const rIna = await patchAsignacion(
      averiaIna.id,
      { fontaneroId: inactivo.idUsuario },
      adminToken,
    ).expect(400);
    expect(rIna.body).toMatchObject({ message: FONTANERO_INACTIVO });
  });
});
