import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { DiaSemana } from '../../common/enums/dia-semana.enum';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import { Role } from '../../common/enums/role.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import {
  fechaEnAsada,
  partesLaboralesEnAsada,
} from '../../common/time/reloj-asada';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { HorarioLaboralFontanero } from '../usuarios/entities/horario-laboral-fontanero.entity';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  MOTIVO_DENTRO_DE_HORARIO,
  MOTIVO_FUERA_DE_HORARIO,
  MOTIVO_SIN_HORARIO,
  ResultadoHorarioLaboral,
} from '../usuarios/validacion-horario-laboral-fontanero';
import { ValidacionHorarioLaboralFontaneroService } from '../usuarios/validacion-horario-laboral-fontanero.service';
import {
  crearUsuarioPrueba,
  seedRolesBase,
} from '../usuarios/usuarios.test-helpers';
import { AveriasModule } from './averias.module';
import {
  AVERIAS_TEST_ENTITIES,
  vaciarNotificacionesAveriaPrueba,
} from './averias.test-entities';
import { MENSAJE_INICIO_ATENCION_FUERA_DE_HORARIO } from './averias.inicio-atencion';
import {
  AVERIA_FONTANERO_FORBIDDEN,
  type AveriaAdminDetail,
  type AveriaAsignacionResult,
  type AveriaFontaneroDetail,
  type AveriasAdminListado,
} from './averias.service';
import { Averia } from './entities/averia.entity';
import { ObservacionAveria } from './entities/observacion-averia.entity';

/**
 * Evidencia automatizada del Backlog 3.6: horario de Fontanero A,
 * asignación, inicio de atención, permisos y cruce admin/fontanero.
 */
describe('PBI 3.6 — horario laboral integral', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let validacion: ValidacionHorarioLaboralFontaneroService;
  let averias: Repository<Averia>;
  let horarios: Repository<HorarioLaboralFontanero>;
  let fontaneroA: Usuario;
  let fontaneroB: Usuario;
  let tokenA: string;
  let tokenB: string;
  let adminToken: string;
  let seq = 0;

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

  const persistAveria = async (overrides: Partial<Averia> = {}) => {
    seq += 1;
    return averias.save(
      averias.create({
        codigoSeguimiento: overrides.codigoSeguimiento ?? `AV-H36-${seq}`,
        fechaReporte:
          overrides.fechaReporte ?? new Date('2026-09-12T15:00:00.000Z'),
        nombreReportante: 'María Rodríguez',
        telefonoReportante: '8888-1111',
        ubicacion: 'Frente a la escuela',
        sectorComunidad: 'San Juan',
        descripcion: 'Fuga visible',
        estado: overrides.estado ?? EstadoAveria.EN_REVISION,
        idFontaneroAsignado:
          overrides.idFontaneroAsignado === undefined
            ? null
            : overrides.idFontaneroAsignado,
        fechaAsignacion:
          overrides.fechaAsignacion === undefined
            ? null
            : overrides.fechaAsignacion,
        fechaInicioAtencion:
          overrides.fechaInicioAtencion === undefined
            ? null
            : overrides.fechaInicioAtencion,
      }),
    );
  };

  const definirHorarioPruebaA = async () =>
    horarios.save(
      horarios.create({
        idFontanero: fontaneroA.idUsuario,
        diaSemana: DiaSemana.LUNES,
        horaInicio: '07:00:00',
        horaFin: '16:00:00',
        activo: true,
      }),
    );

  const definirHorarioJornadaCompleta = async (idFontanero: number) => {
    const partes = partesLaboralesEnAsada(new Date());
    return horarios.save(
      horarios.create({
        idFontanero,
        diaSemana: partes.diaSemana,
        horaInicio: '00:00:00',
        horaFin: '23:59:59',
        activo: true,
      }),
    );
  };

  const definirHorarioFueraDeAhora = async (idFontanero: number) => {
    const partes = partesLaboralesEnAsada(new Date());
    const ventana =
      partes.segundosDesdeMedianoche >= 3600
        ? { horaInicio: '00:00:00', horaFin: '00:01:00' }
        : { horaInicio: '23:00:00', horaFin: '23:30:00' };
    return horarios.save(
      horarios.create({
        idFontanero,
        diaSemana: partes.diaSemana,
        ...ventana,
        activo: true,
      }),
    );
  };

  const patchAsignacion = (
    id: number,
    fontaneroId: number,
    token?: string | null,
  ) =>
    auth(
      request(app.getHttpServer()).patch(
        `/api/v1/admin/averias/${id}/asignacion`,
      ),
      token,
    ).send({ fontaneroId });

  const patchIniciar = (
    id: number,
    token?: string | null,
    body: Record<string, unknown> = {},
  ) =>
    auth(
      request(app.getHttpServer()).patch(
        `/api/v1/fontanero/averias/${id}/iniciar-atencion`,
      ),
      token,
    ).send(body);

  const getFontanero = (id: number, token?: string | null) =>
    auth(
      request(app.getHttpServer()).get(`/api/v1/fontanero/averias/${id}`),
      token,
    );

  const getAdminDetalle = (id: number, token?: string | null) =>
    auth(
      request(app.getHttpServer()).get(`/api/v1/admin/averias/${id}`),
      token,
    );

  const getAdminListado = (
    query: Record<string, string | number> = {},
    token?: string | null,
  ) =>
    auth(
      request(app.getHttpServer()).get('/api/v1/admin/averias'),
      token,
    ).query(query);

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
      }),
    );
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    validacion = moduleFixture.get(ValidacionHorarioLaboralFontaneroService);
    const dataSource = moduleFixture.get(DataSource);
    averias = dataSource.getRepository(Averia);
    horarios = dataSource.getRepository(HorarioLaboralFontanero);
    const usuarios = dataSource.getRepository(Usuario);
    const rolesMap = await seedRolesBase(dataSource.getRepository(Rol));

    fontaneroA = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero A',
      correo: 'fontanero.a.36@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    fontaneroB = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero B',
      correo: 'fontanero.b.36@asadasanjuan.cr',
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
    await averias.clear();
    await horarios.clear();
  });

  it('almacena el horario de prueba de Fontanero A y lo consulta', async () => {
    const creado = await definirHorarioPruebaA();
    const persistido = await horarios.findOneBy({ id: creado.id });

    expect(persistido).toMatchObject({
      idFontanero: fontaneroA.idUsuario,
      diaSemana: DiaSemana.LUNES,
      horaInicio: '07:00:00',
      horaFin: '16:00:00',
      activo: true,
    });

    const listado = await horarios.find({
      where: { idFontanero: fontaneroA.idUsuario },
    });
    expect(listado).toHaveLength(1);
    expect(listado[0]?.idFontanero).toBe(fontaneroA.idUsuario);
  });

  it('clasifica hora dentro, anterior, posterior y día sin jornada', async () => {
    await definirHorarioPruebaA();

    const dentro = await validacion.evaluar(
      fontaneroA.idUsuario,
      fechaEnAsada(2026, 8, 21, 10, 0, 0),
    );
    expect(dentro.resultado).toBe(ResultadoHorarioLaboral.DENTRO_DE_HORARIO);
    expect(dentro.puedeIniciarAtencion).toBe(true);
    expect(dentro.motivo).toBe(MOTIVO_DENTRO_DE_HORARIO);

    const antes = await validacion.evaluar(
      fontaneroA.idUsuario,
      fechaEnAsada(2026, 8, 21, 6, 59, 0),
    );
    expect(antes.resultado).toBe(ResultadoHorarioLaboral.FUERA_DE_HORARIO);
    expect(antes.puedeIniciarAtencion).toBe(false);
    expect(antes.motivo).toBe(MOTIVO_FUERA_DE_HORARIO);

    const despues = await validacion.evaluar(
      fontaneroA.idUsuario,
      fechaEnAsada(2026, 8, 21, 16, 0, 0),
    );
    expect(despues.resultado).toBe(ResultadoHorarioLaboral.FUERA_DE_HORARIO);
    expect(despues.puedeIniciarAtencion).toBe(false);

    const sinJornada = await validacion.evaluar(
      fontaneroA.idUsuario,
      fechaEnAsada(2026, 8, 22, 10, 0, 0),
    );
    expect(sinJornada.resultado).toBe(
      ResultadoHorarioLaboral.SIN_HORARIO_CONFIGURADO,
    );
    expect(sinJornada.puedeIniciarAtencion).toBe(false);
    expect(sinJornada.motivo).toBe(MOTIVO_SIN_HORARIO);
    expect(Object.values(EstadoAveria)).not.toContain('FUERA_DE_HORARIO');
  });

  it('asignación dentro de horario queda Asignada y conserva al Fontanero', async () => {
    await definirHorarioJornadaCompleta(fontaneroA.idUsuario);
    const averia = await persistAveria({ codigoSeguimiento: 'AV-H36-IN' });

    const asignada = (
      await patchAsignacion(averia.id, fontaneroA.idUsuario, adminToken).expect(
        200,
      )
    ).body as AveriaAsignacionResult;

    expect(asignada.estado).toBe(EstadoAveria.ASIGNADA);
    expect(asignada.horarioLaboral.dentroDeHorario).toBe(true);
    expect(asignada.fontanero).toEqual({
      id: fontaneroA.idUsuario,
      nombre: 'Fontanero A',
    });
    expect(asignada.estado).not.toBe('FUERA_DE_HORARIO');

    const admin = (await getAdminDetalle(averia.id, adminToken).expect(200))
      .body as AveriaAdminDetail;
    expect(admin.estado).toBe(EstadoAveria.ASIGNADA);
    expect(admin.fontanero?.id).toBe(fontaneroA.idUsuario);
    expect(admin.fechaAsignacion).toBeTruthy();
    expect(admin.fechaInicioAtencion).toBeNull();

    const listado = (
      await getAdminListado(
        { estado: EstadoAveria.ASIGNADA },
        adminToken,
      ).expect(200)
    ).body as AveriasAdminListado;
    expect(listado.data.some((item) => item.id === averia.id)).toBe(true);
    expect(
      listado.data.find((item) => item.id === averia.id)?.fontanero?.nombre,
    ).toBe('Fontanero A');

    const fontanero = (await getFontanero(averia.id, tokenA).expect(200))
      .body as AveriaFontaneroDetail;
    expect(fontanero.estado).toBe(EstadoAveria.ASIGNADA);
    expect(fontanero.fechaInicioAtencion).toBeNull();
  });

  it('asignación fuera de horario queda Pendiente de atención y conserva al Fontanero', async () => {
    await definirHorarioFueraDeAhora(fontaneroA.idUsuario);
    const averia = await persistAveria({ codigoSeguimiento: 'AV-H36-OUT' });

    const asignada = (
      await patchAsignacion(averia.id, fontaneroA.idUsuario, adminToken).expect(
        200,
      )
    ).body as AveriaAsignacionResult;

    expect(asignada.estado).toBe(EstadoAveria.PENDIENTE);
    expect(asignada.horarioLaboral.dentroDeHorario).toBe(false);
    expect(asignada.fontanero?.id).toBe(fontaneroA.idUsuario);
    expect(asignada.estado).not.toBe('FUERA_DE_HORARIO');

    const persistida = await averias.findOneBy({ id: averia.id });
    expect(persistida?.estado).toBe(EstadoAveria.PENDIENTE);
    expect(persistida?.idFontaneroAsignado).toBe(fontaneroA.idUsuario);
    expect(persistida?.fechaInicioAtencion).toBeNull();

    const admin = (await getAdminDetalle(averia.id, adminToken).expect(200))
      .body as AveriaAdminDetail;
    expect(admin.estado).toBe(EstadoAveria.PENDIENTE);
    expect(admin.fontanero?.nombre).toBe('Fontanero A');
    expect(admin.fechaAsignacion).toBeTruthy();
    expect(admin.fechaInicioAtencion).toBeNull();

    const listado = (
      await getAdminListado(
        { estado: EstadoAveria.PENDIENTE },
        adminToken,
      ).expect(200)
    ).body as AveriasAdminListado;
    const item = listado.data.find((row) => row.id === averia.id);
    expect(item?.estado).toBe(EstadoAveria.PENDIENTE);
    expect(item?.fontanero?.id).toBe(fontaneroA.idUsuario);

    const fontanero = (await getFontanero(averia.id, tokenA).expect(200))
      .body as AveriaFontaneroDetail;
    expect(fontanero.estado).toBe(EstadoAveria.PENDIENTE);
    expect(fontanero.fechaInicioAtencion).toBeNull();
  });

  it('fuera de horario rechaza el inicio y no registra fechaInicioAtencion', async () => {
    await definirHorarioFueraDeAhora(fontaneroA.idUsuario);
    const averia = await persistAveria({
      codigoSeguimiento: 'AV-H36-REJ',
      estado: EstadoAveria.PENDIENTE,
      idFontaneroAsignado: fontaneroA.idUsuario,
      fechaAsignacion: new Date('2026-09-13T08:15:00.000Z'),
    });

    const response = await patchIniciar(averia.id, tokenA).expect(400);
    expect(response.body).toMatchObject({
      message: MENSAJE_INICIO_ATENCION_FUERA_DE_HORARIO,
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /TypeORM|SQL Server|stack/i,
    );

    const persistida = await averias.findOneBy({ id: averia.id });
    expect(persistida?.estado).toBe(EstadoAveria.PENDIENTE);
    expect(persistida?.fechaInicioAtencion).toBeNull();
    expect(persistida?.idFontaneroAsignado).toBe(fontaneroA.idUsuario);
  });

  it('la validación no se evita manipulando el body ni el PATCH administrativo', async () => {
    await definirHorarioFueraDeAhora(fontaneroA.idUsuario);
    const averia = await persistAveria({
      codigoSeguimiento: 'AV-H36-MAN',
      estado: EstadoAveria.PENDIENTE,
      idFontaneroAsignado: fontaneroA.idUsuario,
      fechaAsignacion: new Date('2026-09-13T08:15:00.000Z'),
    });

    await patchIniciar(averia.id, tokenA, {
      fechaInicioAtencion: '1999-01-01T00:00:00.000Z',
      estado: EstadoAveria.EN_ATENCION,
    }).expect(400);

    const adminPatch = await auth(
      request(app.getHttpServer()).patch(
        `/api/v1/admin/averias/${averia.id}/estado`,
      ),
      adminToken,
    )
      .send({ estado: EstadoAveria.EN_ATENCION })
      .expect(400);
    expect(adminPatch.body).toMatchObject({
      message: MENSAJE_INICIO_ATENCION_FUERA_DE_HORARIO,
    });

    const persistida = await averias.findOneBy({ id: averia.id });
    expect(persistida?.estado).toBe(EstadoAveria.PENDIENTE);
    expect(persistida?.fechaInicioAtencion).toBeNull();
  });

  it('responde 401 sin sesión y 403 a otro Fontanero o a la Administradora', async () => {
    await definirHorarioJornadaCompleta(fontaneroA.idUsuario);
    const averia = await persistAveria({
      codigoSeguimiento: 'AV-H36-SEC',
      estado: EstadoAveria.ASIGNADA,
      idFontaneroAsignado: fontaneroA.idUsuario,
      fechaAsignacion: new Date('2026-09-13T08:15:00.000Z'),
    });

    await patchIniciar(averia.id).expect(401);
    await getFontanero(averia.id).expect(401);
    await getAdminDetalle(averia.id).expect(401);

    const ajeno = await patchIniciar(averia.id, tokenB).expect(403);
    expect(ajeno.body).toMatchObject({ message: AVERIA_FONTANERO_FORBIDDEN });
    await getFontanero(averia.id, tokenB).expect(403);
    await patchIniciar(averia.id, adminToken).expect(403);

    const persistida = await averias.findOneBy({ id: averia.id });
    expect(persistida?.estado).toBe(EstadoAveria.ASIGNADA);
    expect(persistida?.fechaInicioAtencion).toBeNull();
  });

  it('Pendiente de atención → En atención dentro de horario y registra fecha', async () => {
    await definirHorarioJornadaCompleta(fontaneroA.idUsuario);
    const averia = await persistAveria({
      codigoSeguimiento: 'AV-H36-PEN',
      estado: EstadoAveria.PENDIENTE,
      idFontaneroAsignado: fontaneroA.idUsuario,
      fechaAsignacion: new Date('2026-09-13T08:15:00.000Z'),
    });
    const before = Date.now();

    const body = (await patchIniciar(averia.id, tokenA).expect(200))
      .body as AveriaFontaneroDetail;
    expect(body.estado).toBe(EstadoAveria.EN_ATENCION);
    expect(body.fechaInicioAtencion).toBeTruthy();
    expect(
      new Date(body.fechaInicioAtencion as unknown as string).getTime(),
    ).toBeGreaterThanOrEqual(before - 1000);

    const persistida = await averias.findOneBy({ id: averia.id });
    expect(persistida?.estado).toBe(EstadoAveria.EN_ATENCION);
    expect(persistida?.fechaInicioAtencion).toBeInstanceOf(Date);
    expect(persistida?.idFontaneroAsignado).toBe(fontaneroA.idUsuario);

    const admin = (await getAdminDetalle(averia.id, adminToken).expect(200))
      .body as AveriaAdminDetail;
    expect(admin.estado).toBe(EstadoAveria.EN_ATENCION);
    expect(admin.fontanero?.nombre).toBe('Fontanero A');
    expect(admin.fechaInicioAtencion).toBeTruthy();

    const listado = (
      await getAdminListado(
        { estado: EstadoAveria.EN_ATENCION },
        adminToken,
      ).expect(200)
    ).body as AveriasAdminListado;
    expect(listado.data.some((item) => item.id === averia.id)).toBe(true);

    const fontanero = (await getFontanero(averia.id, tokenA).expect(200))
      .body as AveriaFontaneroDetail;
    expect(fontanero.estado).toBe(EstadoAveria.EN_ATENCION);
    expect(fontanero.fechaInicioAtencion).toBeTruthy();
  });

  it('Asignada → En atención dentro de horario y registra fecha', async () => {
    await definirHorarioJornadaCompleta(fontaneroA.idUsuario);
    const averia = await persistAveria({ codigoSeguimiento: 'AV-H36-ASG' });
    await patchAsignacion(averia.id, fontaneroA.idUsuario, adminToken).expect(
      200,
    );

    const persistidaAsignada = await averias.findOneBy({ id: averia.id });
    expect(persistidaAsignada?.estado).toBe(EstadoAveria.ASIGNADA);
    expect(persistidaAsignada?.fechaInicioAtencion).toBeNull();

    const before = Date.now();
    const body = (await patchIniciar(averia.id, tokenA).expect(200))
      .body as AveriaFontaneroDetail;
    expect(body.estado).toBe(EstadoAveria.EN_ATENCION);
    expect(
      new Date(body.fechaInicioAtencion as unknown as string).getTime(),
    ).toBeGreaterThanOrEqual(before - 1000);

    const persistida = await averias.findOneBy({ id: averia.id });
    expect(persistida?.estado).toBe(EstadoAveria.EN_ATENCION);
    expect(persistida?.fechaInicioAtencion).toBeInstanceOf(Date);
  });

  it('GET /fontanero/averias lista los casos operativos y el detalle distingue estados', async () => {
    const asignada = await persistAveria({
      codigoSeguimiento: 'AV-H36-LST-A',
      estado: EstadoAveria.ASIGNADA,
      idFontaneroAsignado: fontaneroA.idUsuario,
      fechaAsignacion: new Date('2026-09-13T08:00:00.000Z'),
    });
    const pendiente = await persistAveria({
      codigoSeguimiento: 'AV-H36-LST-P',
      estado: EstadoAveria.PENDIENTE,
      idFontaneroAsignado: fontaneroA.idUsuario,
      fechaAsignacion: new Date('2026-09-13T20:00:00.000Z'),
    });
    const enAtencion = await persistAveria({
      codigoSeguimiento: 'AV-H36-LST-E',
      estado: EstadoAveria.EN_ATENCION,
      idFontaneroAsignado: fontaneroA.idUsuario,
      fechaAsignacion: new Date('2026-09-13T09:00:00.000Z'),
      fechaInicioAtencion: new Date('2026-09-13T09:10:00.000Z'),
    });

    const listado = (
      await auth(
        request(app.getHttpServer()).get('/api/v1/fontanero/averias'),
        tokenA,
      ).expect(200)
    ).body as { data: Array<{ id: number; estado: string }> };
    expect(listado.data.map((item) => item.id).sort()).toEqual(
      [asignada.id, pendiente.id, enAtencion.id].sort(),
    );
    expect(listado.data.map((item) => item.estado).sort()).toEqual(
      [
        EstadoAveria.ASIGNADA,
        EstadoAveria.EN_ATENCION,
        EstadoAveria.PENDIENTE,
      ].sort(),
    );

    expect(
      (
        (await getFontanero(asignada.id, tokenA).expect(200))
          .body as AveriaFontaneroDetail
      ).estado,
    ).toBe(EstadoAveria.ASIGNADA);
    expect(
      (
        (await getFontanero(pendiente.id, tokenA).expect(200))
          .body as AveriaFontaneroDetail
      ).estado,
    ).toBe(EstadoAveria.PENDIENTE);
    expect(
      (
        (await getFontanero(enAtencion.id, tokenA).expect(200))
          .body as AveriaFontaneroDetail
      ).estado,
    ).toBe(EstadoAveria.EN_ATENCION);
  });
});
