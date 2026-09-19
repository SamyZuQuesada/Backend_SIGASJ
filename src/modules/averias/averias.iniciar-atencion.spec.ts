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
import { partesLaboralesEnAsada } from '../../common/time/reloj-asada';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { HorarioLaboralFontanero } from '../usuarios/entities/horario-laboral-fontanero.entity';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  crearUsuarioPrueba,
  seedRolesBase,
} from '../usuarios/usuarios.test-helpers';
import { AVERIA_ADMIN_INVALID_ID } from './averia-admin-id.pipe';
import { AveriasModule } from './averias.module';
import { MENSAJE_INICIO_ATENCION_FUERA_DE_HORARIO } from './averias.inicio-atencion';
import { mensajeTransicionEstadoAveriaInvalida } from './averias.estado-transiciones';
import {
  AVERIA_ADMIN_NOT_FOUND,
  AVERIA_FONTANERO_FORBIDDEN,
  type AveriaAdminDetail,
  type AveriaFontaneroDetail,
} from './averias.service';
import { Averia } from './entities/averia.entity';
import { ObservacionAveria } from './entities/observacion-averia.entity';

describe('PATCH /api/v1/fontanero/averias/:id/iniciar-atencion', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let averias: Repository<Averia>;
  let horarios: Repository<HorarioLaboralFontanero>;
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

  const patchIniciar = (
    id: number | string,
    token?: string | null,
    body: Record<string, unknown> = {},
  ) => {
    const req = request(app.getHttpServer()).patch(
      `/api/v1/fontanero/averias/${id}/iniciar-atencion`,
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
          overrides.codigoSeguimiento ?? `AV-INI-${usuarioSeq}`,
        fechaReporte:
          overrides.fechaReporte ?? new Date('2026-09-12T15:00:00.000Z'),
        nombreReportante: 'María Rodríguez',
        telefonoReportante: '8888-1111',
        ubicacion: 'Frente a la escuela',
        sectorComunidad: 'San Juan',
        descripcion: 'Fuga visible',
        estado: overrides.estado ?? EstadoAveria.ASIGNADA,
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
      }),
    );
  };

  const definirHorarioJornadaCompleta = async (idFontanero: number) => {
    const partes = partesLaboralesEnAsada(new Date());
    await horarios.save(
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
    await horarios.save(
      horarios.create({
        idFontanero,
        diaSemana: partes.diaSemana,
        ...ventana,
        activo: true,
      }),
    );
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
            Averia,
            ObservacionAveria,
            Usuario,
            Rol,
            HorarioLaboralFontanero,
          ],
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
    const dataSource = moduleFixture.get(DataSource);
    averias = dataSource.getRepository(Averia);
    horarios = dataSource.getRepository(HorarioLaboralFontanero);
    usuarios = dataSource.getRepository(Usuario);
    rolesMap = await seedRolesBase(dataSource.getRepository(Rol));

    fontaneroA = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero A',
      correo: 'fontanero.a.ini@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    fontaneroB = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero B',
      correo: 'fontanero.b.ini@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    tokenA = signAs(Role.FONTANERO, String(fontaneroA.idUsuario), 'Fontanero A');
    tokenB = signAs(Role.FONTANERO, String(fontaneroB.idUsuario), 'Fontanero B');
    adminToken = signAs(Role.ADMINISTRADORA, '1', 'Administradora');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await averias.clear();
    await horarios.clear();
  });

  it('dentro de horario inicia atención y registra fecha del Backend', async () => {
    await definirHorarioJornadaCompleta(fontaneroA.idUsuario);
    const averia = await persistAveria({ codigoSeguimiento: 'AV-INI-OK' });
    const before = Date.now();

    const response = await patchIniciar(averia.id, tokenA).expect(200);
    const body = response.body as AveriaFontaneroDetail;
    expect(body.estado).toBe(EstadoAveria.EN_ATENCION);
    expect(body.fechaInicioAtencion).toBeTruthy();
    expect(
      new Date(body.fechaInicioAtencion as unknown as string).getTime(),
    ).toBeGreaterThanOrEqual(before - 1000);
    expect(body).not.toHaveProperty('fechaInicioAtencionCliente');

    const persistida = await averias.findOneBy({ id: averia.id });
    expect(persistida?.estado).toBe(EstadoAveria.EN_ATENCION);
    expect(persistida?.fechaInicioAtencion).toBeInstanceOf(Date);
  });

  it('también inicia desde PENDIENTE cuando hay jornada', async () => {
    await definirHorarioJornadaCompleta(fontaneroA.idUsuario);
    const averia = await persistAveria({
      codigoSeguimiento: 'AV-INI-PEN',
      estado: EstadoAveria.PENDIENTE,
    });
    await patchIniciar(averia.id, tokenA).expect(200);
    const persistida = await averias.findOneBy({ id: averia.id });
    expect(persistida?.estado).toBe(EstadoAveria.EN_ATENCION);
    expect(persistida?.fechaInicioAtencion).toBeInstanceOf(Date);
  });

  it('fuera de horario rechaza, deja PENDIENTE y no registra fecha', async () => {
    await definirHorarioFueraDeAhora(fontaneroA.idUsuario);
    const averia = await persistAveria({
      codigoSeguimiento: 'AV-INI-OUT',
      estado: EstadoAveria.PENDIENTE,
    });

    const response = await patchIniciar(averia.id, tokenA).expect(400);
    expect(response.body).toMatchObject({
      message: MENSAJE_INICIO_ATENCION_FUERA_DE_HORARIO,
    });

    const persistida = await averias.findOneBy({ id: averia.id });
    expect(persistida?.estado).toBe(EstadoAveria.PENDIENTE);
    expect(persistida?.fechaInicioAtencion).toBeNull();
    expect(persistida?.idFontaneroAsignado).toBe(fontaneroA.idUsuario);
  });

  it('sin horario no asume que puede iniciar', async () => {
    const averia = await persistAveria({
      codigoSeguimiento: 'AV-INI-NOH',
      estado: EstadoAveria.PENDIENTE,
    });
    const response = await patchIniciar(averia.id, tokenA).expect(400);
    expect(response.body).toMatchObject({
      message: MENSAJE_INICIO_ATENCION_FUERA_DE_HORARIO,
    });
    const persistida = await averias.findOneBy({ id: averia.id });
    expect(persistida?.estado).toBe(EstadoAveria.PENDIENTE);
    expect(persistida?.fechaInicioAtencion).toBeNull();
  });

  it('un PATCH administrativo tampoco omite la regla de horario', async () => {
    await definirHorarioFueraDeAhora(fontaneroA.idUsuario);
    const averia = await persistAveria({
      codigoSeguimiento: 'AV-INI-ADM',
      estado: EstadoAveria.PENDIENTE,
    });

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${averia.id}/estado`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: EstadoAveria.EN_ATENCION })
      .expect(400);
    expect(response.body).toMatchObject({
      message: MENSAJE_INICIO_ATENCION_FUERA_DE_HORARIO,
    });

    const persistida = await averias.findOneBy({ id: averia.id });
    expect(persistida?.estado).toBe(EstadoAveria.PENDIENTE);
    expect(persistida?.fechaInicioAtencion).toBeNull();
  });

  it('rechaza un body con fecha de inicio enviada por el cliente', async () => {
    await definirHorarioJornadaCompleta(fontaneroA.idUsuario);
    const averia = await persistAveria({ codigoSeguimiento: 'AV-INI-BODY' });
    await patchIniciar(averia.id, tokenA, {
      fechaInicioAtencion: '1999-01-01T00:00:00.000Z',
    }).expect(400);
    const persistida = await averias.findOneBy({ id: averia.id });
    expect(persistida?.estado).toBe(EstadoAveria.ASIGNADA);
    expect(persistida?.fechaInicioAtencion).toBeNull();
  });

  it('Fontanero B no puede iniciar la avería de A', async () => {
    await definirHorarioJornadaCompleta(fontaneroB.idUsuario);
    const averia = await persistAveria({ codigoSeguimiento: 'AV-INI-FORB' });
    const response = await patchIniciar(averia.id, tokenB).expect(403);
    expect(response.body).toMatchObject({
      message: AVERIA_FONTANERO_FORBIDDEN,
    });
    const persistida = await averias.findOneBy({ id: averia.id });
    expect(persistida?.estado).toBe(EstadoAveria.ASIGNADA);
    expect(persistida?.fechaInicioAtencion).toBeNull();
  });

  it('Administradora no puede usar el endpoint del Fontanero', async () => {
    const averia = await persistAveria({ codigoSeguimiento: 'AV-INI-ADM2' });
    await patchIniciar(averia.id, adminToken).expect(403);
  });

  it('rechaza transiciones incompatibles con 2.3', async () => {
    await definirHorarioJornadaCompleta(fontaneroA.idUsuario);
    const resuelta = await persistAveria({
      codigoSeguimiento: 'AV-INI-RES',
      estado: EstadoAveria.RESUELTA,
    });
    const response = await patchIniciar(resuelta.id, tokenA).expect(400);
    expect(response.body).toMatchObject({
      message: mensajeTransicionEstadoAveriaInvalida(
        EstadoAveria.RESUELTA,
        EstadoAveria.EN_ATENCION,
      ),
    });
  });

  it('avería inexistente → 404 e ID inválido → 400', async () => {
    await patchIniciar(9999, tokenA).expect(404).then((res) => {
      expect(res.body).toMatchObject({ message: AVERIA_ADMIN_NOT_FOUND });
    });
    const invalid = await patchIniciar('abc', tokenA).expect(400);
    expect(invalid.body).toMatchObject({ message: AVERIA_ADMIN_INVALID_ID });
  });

  it('dentro de horario, el PATCH admin también registra fecha de inicio', async () => {
    await definirHorarioJornadaCompleta(fontaneroA.idUsuario);
    const averia = await persistAveria({
      codigoSeguimiento: 'AV-INI-ADM-OK',
      estado: EstadoAveria.PENDIENTE,
    });
    const before = Date.now();
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${averia.id}/estado`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: EstadoAveria.EN_ATENCION })
      .expect(200);
    expect((response.body as AveriaAdminDetail).estado).toBe(
      EstadoAveria.EN_ATENCION,
    );
    const persistida = await averias.findOneBy({ id: averia.id });
    expect(persistida?.fechaInicioAtencion).toBeInstanceOf(Date);
    expect(persistida?.fechaInicioAtencion?.getTime()).toBeGreaterThanOrEqual(
      before - 1000,
    );
  });
});
