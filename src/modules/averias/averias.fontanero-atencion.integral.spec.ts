import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { partesLaboralesEnAsada } from '../../common/time/reloj-asada';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import { PrioridadAveria } from '../../common/enums/prioridad-averia.enum';
import { Role } from '../../common/enums/role.enum';
import { TipoAveria } from '../../common/enums/tipo-averia.enum';
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
  type AveriasAdminListado,
  type ResolverAveriaResponse,
} from './averias.service';
import {
  AVERIA_FONTANERO_RESOLVER_FORBIDDEN,
  AVERIA_NO_EN_ATENCION,
  OBSERVACION_FINAL_VACIA,
} from './dto/resolver-averia.dto';
import { OBSERVACION_AVERIA_VACIA } from './dto/create-observacion-averia.dto';
import { Averia } from './entities/averia.entity';
import { ObservacionAveria } from './entities/observacion-averia.entity';

/**
 * Evidencia automatizada del Backlog 2.5: consulta, documentación y cierre
 * de una avería por el Fontanero asignado, más permisos y cruce con 2.3.
 */
describe('PBI 2.5 — atención integral del Fontanero', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let averias: Repository<Averia>;
  let observaciones: Repository<ObservacionAveria>;
  let fontaneroA: Usuario;
  let fontaneroB: Usuario;
  let horarios: Repository<HorarioLaboralFontanero>;
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

  const auth = (req: request.Test, token?: string | null) => {
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  };

  const getFontanero = (id: number, token?: string | null) =>
    auth(
      request(app.getHttpServer()).get(`/api/v1/fontanero/averias/${id}`),
      token,
    );

  const postObservacion = (
    id: number,
    body: Record<string, unknown>,
    token?: string | null,
  ) =>
    auth(
      request(app.getHttpServer()).post(
        `/api/v1/fontanero/averias/${id}/observaciones`,
      ),
      token,
    ).send(body);

  const patchResolver = (
    id: number,
    body: Record<string, unknown>,
    token?: string | null,
  ) =>
    auth(
      request(app.getHttpServer()).patch(
        `/api/v1/fontanero/averias/${id}/resolver`,
      ),
      token,
    ).send(body);

  const patchAdminEstado = (id: number, estado: EstadoAveria) =>
    auth(
      request(app.getHttpServer()).patch(`/api/v1/admin/averias/${id}/estado`),
      adminToken,
    ).send({ estado });

  const getAdminListado = (query: Record<string, string>) =>
    auth(
      request(app.getHttpServer()).get('/api/v1/admin/averias').query(query),
      adminToken,
    );

  const persistAveria = async (overrides: Partial<Averia> = {}) => {
    usuarioSeq += 1;
    return averias.save(
      averias.create({
        codigoSeguimiento:
          overrides.codigoSeguimiento ?? `AV-INT-${usuarioSeq}`,
        fechaReporte:
          overrides.fechaReporte ?? new Date('2026-09-12T15:00:00.000Z'),
        nombreReportante: 'María Rodríguez',
        identificacionReportante: '1-2345-6789',
        telefonoReportante: '8888-1111',
        correoReportante: 'maria@example.com',
        idAbonado: 14,
        ubicacion: 'Frente a la escuela, 50 m sur',
        sectorComunidad: 'San Juan',
        descripcion: 'Fuga visible junto al medidor comunitario.',
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
        fechaInicioAtencion: overrides.fechaInicioAtencion ?? null,
        fechaResolucion: overrides.fechaResolucion ?? null,
        observacionesAtencion: overrides.observacionesAtencion ?? null,
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
        ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
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
    horarios = dataSource.getRepository(HorarioLaboralFontanero);
    const usuarios = dataSource.getRepository(Usuario);
    const rolesMap = await seedRolesBase(dataSource.getRepository(Rol));

    fontaneroA = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero A',
      correo: 'fontanero.a.int@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    fontaneroB = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero B',
      correo: 'fontanero.b.int@asadasanjuan.cr',
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
    await horarios.clear();
  });

  it('Fontanero A consulta su avería y Fontanero B no puede verla ni modificarla', async () => {
    const averia = await persistAveria({
      codigoSeguimiento: 'AV-INT-PERM',
      tipoAveria: TipoAveria.TUBERIA_DANADA,
      prioridad: PrioridadAveria.ALTA,
    });

    const propio = (await getFontanero(averia.id, tokenA).expect(200))
      .body as AveriaFontaneroDetail;
    expect(propio.codigoSeguimiento).toBe('AV-INT-PERM');
    expect(propio.sectorComunidad).toBe('San Juan');
    expect(propio.ubicacion).toBe('Frente a la escuela, 50 m sur');
    expect(propio.descripcion).toContain('Fuga visible');
    expect(propio.nombreReportante).toBe('María Rodríguez');
    expect(propio.telefonoReportante).toBe('8888-1111');
    expect(propio).not.toHaveProperty('identificacionReportante');
    expect(JSON.stringify(propio)).not.toMatch(/password|refreshToken/i);

    const ajena = await getFontanero(averia.id, tokenB).expect(403);
    expect(ajena.body).toEqual({
      statusCode: 403,
      message: AVERIA_FONTANERO_FORBIDDEN,
    });
    expect(ajena.body).not.toHaveProperty('codigoSeguimiento');

    const obsAjena = await postObservacion(
      averia.id,
      { observacion: 'Intento de Fontanero B' },
      tokenB,
    ).expect(403);
    expect(obsAjena.body).toMatchObject({
      message: AVERIA_FONTANERO_FORBIDDEN,
    });

    await persistAveria({
      codigoSeguimiento: 'AV-INT-ATT',
      estado: EstadoAveria.EN_ATENCION,
      fechaInicioAtencion: new Date('2026-09-13T09:00:00.000Z'),
    });
    const atencion = await averias.findOneByOrFail({
      codigoSeguimiento: 'AV-INT-ATT',
    });
    const resolverAjena = await patchResolver(
      atencion.id,
      { observacionFinal: 'Cierre no autorizado' },
      tokenB,
    ).expect(403);
    expect(resolverAjena.body).toMatchObject({
      message: AVERIA_FONTANERO_RESOLVER_FORBIDDEN,
    });
    expect(await observaciones.count()).toBe(0);
  });

  it('sin sesión y otros roles no acceden a las rutas del Fontanero', async () => {
    const averia = await persistAveria({ codigoSeguimiento: 'AV-INT-ROLES' });

    await getFontanero(averia.id).expect(401);
    await postObservacion(averia.id, { observacion: 'sin sesión' }).expect(401);
    await patchResolver(averia.id, { observacionFinal: 'sin sesión' }).expect(
      401,
    );

    for (const role of [Role.ADMINISTRADORA, Role.SECRETARIA, Role.ABONADO]) {
      const token = signAs(role, String(role === Role.ADMINISTRADORA ? 1 : 9));
      await getFontanero(averia.id, token).expect(403);
      await postObservacion(
        averia.id,
        { observacion: 'rol ajeno' },
        token,
      ).expect(403);
    }
  });

  it('muestra pendientes de tipo, prioridad y observaciones sin error', async () => {
    const averia = await persistAveria({
      codigoSeguimiento: 'AV-INT-PEND',
      estado: EstadoAveria.ASIGNADA,
    });
    const body = (await getFontanero(averia.id, tokenA).expect(200))
      .body as AveriaFontaneroDetail;
    expect(body.tipoAveria).toBe('Sin clasificar');
    expect(body.prioridad).toBe('Sin asignar');
    expect(body.fechaInicioAtencion).toBeNull();
    expect(body.fechaResolucion).toBeNull();
    expect(body.observaciones).toEqual([]);
  });

  it('registra tres observaciones independientes con autor y fecha', async () => {
    const averia = await persistAveria({
      codigoSeguimiento: 'AV-INT-OBS',
      estado: EstadoAveria.EN_ATENCION,
      fechaInicioAtencion: new Date('2026-09-13T09:00:00.000Z'),
    });

    const textos = [
      'Se identificó una fuga cerca del medidor.',
      'Se reemplazó la sección dañada.',
      'Se verificó la presión del sector.',
    ];
    for (const observacion of textos) {
      await postObservacion(averia.id, { observacion }, tokenA).expect(201);
    }

    await postObservacion(averia.id, { observacion: '' }, tokenA).expect(400);
    await postObservacion(averia.id, { observacion: '    ' }, tokenA).expect(
      400,
    );

    const detalle = (await getFontanero(averia.id, tokenA).expect(200))
      .body as AveriaFontaneroDetail;
    expect(detalle.observaciones.map((item) => item.observacion)).toEqual(
      textos,
    );
    expect(
      detalle.observaciones.every(
        (item) =>
          item.autor.id === fontaneroA.idUsuario &&
          item.autor.nombre === 'Fontanero A' &&
          Boolean(item.fechaCreacion),
      ),
    ).toBe(true);

    const rows = await observaciones.find({
      where: { idAveria: averia.id },
      order: { id: 'ASC' },
    });
    expect(rows).toHaveLength(3);
    expect(
      rows.every((row) => row.idUsuarioAutor === fontaneroA.idUsuario),
    ).toBe(true);
  });

  it('el Fontanero ve prioridad y clasificación persistidas por Administración (2.3)', async () => {
    const averia = await persistAveria({ codigoSeguimiento: 'AV-INT-CLAS' });

    await auth(
      request(app.getHttpServer()).patch(
        `/api/v1/admin/averias/${averia.id}/clasificacion`,
      ),
      adminToken,
    )
      .send({ clasificacion: TipoAveria.TUBERIA_DANADA })
      .expect(200);
    await auth(
      request(app.getHttpServer()).patch(
        `/api/v1/admin/averias/${averia.id}/prioridad`,
      ),
      adminToken,
    )
      .send({ prioridad: PrioridadAveria.MEDIA })
      .expect(200);

    const fontanero = (await getFontanero(averia.id, tokenA).expect(200))
      .body as AveriaFontaneroDetail;
    expect(fontanero.tipoAveria).toBe(TipoAveria.TUBERIA_DANADA);
    expect(fontanero.prioridad).toBe(PrioridadAveria.MEDIA);

    const admin = (
      await auth(
        request(app.getHttpServer()).get(`/api/v1/admin/averias/${averia.id}`),
        adminToken,
      ).expect(200)
    ).body as AveriaAdminDetail;
    expect(admin.tipoAveria).toBe(TipoAveria.TUBERIA_DANADA);
    expect(admin.prioridad).toBe(PrioridadAveria.MEDIA);
  });

  it('ASIGNADA y PENDIENTE pueden pasar a EN_ATENCION por gestión administrativa', async () => {
    const partes = partesLaboralesEnAsada(new Date());
    await horarios.save(
      horarios.create({
        idFontanero: fontaneroA.idUsuario,
        diaSemana: partes.diaSemana,
        horaInicio: '00:00:00',
        horaFin: '23:59:59',
        activo: true,
      }),
    );
    const asignada = await persistAveria({
      codigoSeguimiento: 'AV-INT-INI-A',
      estado: EstadoAveria.ASIGNADA,
    });
    await patchAdminEstado(asignada.id, EstadoAveria.EN_ATENCION).expect(200);
    expect(
      (await getFontanero(asignada.id, tokenA).expect(200)).body.estado,
    ).toBe(EstadoAveria.EN_ATENCION);

    const pendiente = await persistAveria({
      codigoSeguimiento: 'AV-INT-INI-P',
      estado: EstadoAveria.PENDIENTE,
    });
    await patchAdminEstado(pendiente.id, EstadoAveria.EN_ATENCION).expect(200);
    expect(
      (await getFontanero(pendiente.id, tokenA).expect(200)).body.estado,
    ).toBe(EstadoAveria.EN_ATENCION);
  });

  it('recorre el cierre válido y deja el caso en consultas históricas', async () => {
    const averia = await persistAveria({
      codigoSeguimiento: 'AV-INT-CIERRE',
      estado: EstadoAveria.EN_ATENCION,
      tipoAveria: TipoAveria.TUBERIA_DANADA,
      prioridad: PrioridadAveria.ALTA,
      fechaInicioAtencion: new Date('2026-09-13T09:00:00.000Z'),
    });
    await postObservacion(
      averia.id,
      { observacion: 'Se identificó la fuga.' },
      tokenA,
    ).expect(201);

    const vacia = await patchResolver(
      averia.id,
      { observacionFinal: '' },
      tokenA,
    ).expect(400);
    expect(
      publicMessage(vacia.body as { message?: string | string[] }),
    ).toContain(OBSERVACION_FINAL_VACIA);
    const espacios = await patchResolver(
      averia.id,
      { observacionFinal: '    ' },
      tokenA,
    ).expect(400);
    expect(
      publicMessage(espacios.body as { message?: string | string[] }),
    ).toContain(OBSERVACION_FINAL_VACIA);
    expect((await averias.findOneBy({ id: averia.id }))?.estado).toBe(
      EstadoAveria.EN_ATENCION,
    );
    expect(
      (await averias.findOneBy({ id: averia.id }))?.fechaResolucion,
    ).toBeNull();

    const cierre = (
      await patchResolver(
        averia.id,
        { observacionFinal: 'Se reparó y se verificó la presión.' },
        tokenA,
      ).expect(200)
    ).body as ResolverAveriaResponse;
    expect(cierre.data.estado).toBe(EstadoAveria.RESUELTA);
    expect(cierre.data.fechaResolucion).toBeTruthy();
    expect(cierre.data.observaciones).toHaveLength(2);
    expect(cierre.data.observaciones[0]?.observacion).toBe(
      'Se identificó la fuga.',
    );
    expect(cierre.data.observaciones[1]?.observacion).toBe(
      'Se reparó y se verificó la presión.',
    );
    expect(cierre.data.observaciones[1]?.autor.nombre).toBe('Fontanero A');

    const persistida = await averias.findOneBy({ id: averia.id });
    expect(persistida?.estado).toBe(EstadoAveria.RESUELTA);
    expect(persistida?.fechaResolucion).toBeInstanceOf(Date);
    expect(persistida?.tipoAveria).toBe(TipoAveria.TUBERIA_DANADA);
    expect(persistida?.prioridad).toBe(PrioridadAveria.ALTA);

    const recarga = (await getFontanero(averia.id, tokenA).expect(200))
      .body as AveriaFontaneroDetail;
    expect(recarga.estado).toBe(EstadoAveria.RESUELTA);
    expect(recarga.observaciones).toHaveLength(2);

    const enAtencion = (
      await getAdminListado({ estado: EstadoAveria.EN_ATENCION }).expect(200)
    ).body as AveriasAdminListado;
    expect(
      enAtencion.data.some(
        (item) => item.codigoSeguimiento === 'AV-INT-CIERRE',
      ),
    ).toBe(false);

    const resueltas = (
      await getAdminListado({ estado: EstadoAveria.RESUELTA }).expect(200)
    ).body as AveriasAdminListado;
    expect(
      resueltas.data.some((item) => item.codigoSeguimiento === 'AV-INT-CIERRE'),
    ).toBe(true);

    const adminDetalle = (
      await auth(
        request(app.getHttpServer()).get(`/api/v1/admin/averias/${averia.id}`),
        adminToken,
      ).expect(200)
    ).body as AveriaAdminDetail;
    expect(adminDetalle.estado).toBe(EstadoAveria.RESUELTA);
    expect(adminDetalle.fechaResolucion).toBeTruthy();
    expect(adminDetalle.observaciones).toHaveLength(2);

    await patchResolver(
      averia.id,
      { observacionFinal: 'Segundo cierre' },
      tokenA,
    ).expect(400);
  });

  it('rechaza resolver desde Recibida, Asignada, Pendiente y 404 inexistente', async () => {
    const recibida = await persistAveria({
      codigoSeguimiento: 'AV-INT-REC',
      estado: EstadoAveria.RECIBIDA,
      idFontaneroAsignado: fontaneroA.idUsuario,
    });
    const asignada = await persistAveria({
      codigoSeguimiento: 'AV-INT-ASG',
      estado: EstadoAveria.ASIGNADA,
    });
    const pendiente = await persistAveria({
      codigoSeguimiento: 'AV-INT-PEN2',
      estado: EstadoAveria.PENDIENTE,
    });

    for (const item of [recibida, asignada, pendiente]) {
      const response = await patchResolver(
        item.id,
        { observacionFinal: 'Cierre inválido' },
        tokenA,
      ).expect(400);
      expect(response.body).toMatchObject({ message: AVERIA_NO_EN_ATENCION });
      expect((await averias.findOneBy({ id: item.id }))?.estado).toBe(
        item.estado,
      );
    }

    const missing = await patchResolver(
      999999,
      { observacionFinal: 'No existe' },
      tokenA,
    ).expect(404);
    expect(missing.body).toEqual({
      statusCode: 404,
      message: AVERIA_ADMIN_NOT_FOUND,
    });
  });

  it('observación vacía responde 400 con mensaje de negocio', async () => {
    const averia = await persistAveria({
      codigoSeguimiento: 'AV-INT-400',
      estado: EstadoAveria.EN_ATENCION,
      fechaInicioAtencion: new Date('2026-09-13T09:00:00.000Z'),
    });
    const response = await postObservacion(
      averia.id,
      { observacion: '' },
      tokenA,
    ).expect(400);
    expect(
      publicMessage(response.body as { message?: string | string[] }),
    ).toContain(OBSERVACION_AVERIA_VACIA);
  });
});
