import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import { TipoAveria } from '../../common/enums/tipo-averia.enum';
import { TipoEventoAveria } from '../../common/enums/tipo-evento-averia.enum';
import { Role } from '../../common/enums/role.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { partesLaboralesEnAsada } from '../../common/time/reloj-asada';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { HorarioLaboralFontanero } from '../usuarios/entities/horario-laboral-fontanero.entity';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  crearUsuarioPrueba,
  PASSWORD_PRUEBA,
  seedRolesBase,
  seedStaffLoginUsers,
} from '../usuarios/usuarios.test-helpers';
import { AveriasModule } from './averias.module';
import {
  AVERIAS_TEST_ENTITIES,
  vaciarNotificacionesAveriaPrueba,
} from './averias.test-entities';
import {
  HISTORIAL_AVERIA_NO_ELIMINABLE,
  HISTORIAL_AVERIA_NO_MODIFICABLE,
  HistorialAveria,
} from './entities/historial-averia.entity';

const payloadPublico = {
  nombreReportante: 'María Rodríguez',
  telefonoReportante: '8888-8888',
  ubicacion: 'Frente a la escuela, 50 m sur, casa verde',
  sectorComunidad: 'San Juan',
  descripcion: 'Se observa una fuga visible en la tubería de distribución',
};

describe('Historial de eventos de una avería', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let historial: Repository<HistorialAveria>;
  let usuarios: Repository<Usuario>;
  let horarios: Repository<HorarioLaboralFontanero>;
  let rolesMap: Record<Role, Rol>;
  let adminToken: string;
  let administradora: Usuario;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

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

    dataSource = moduleFixture.get(DataSource);
    historial = dataSource.getRepository(HistorialAveria);
    usuarios = dataSource.getRepository(Usuario);
    horarios = dataSource.getRepository(HorarioLaboralFontanero);
    rolesMap = await seedRolesBase(dataSource.getRepository(Rol));
    await seedStaffLoginUsers(usuarios, rolesMap);
    administradora = (await usuarios.findOneBy({
      correo: 'admin@asadasanjuan.cr',
    })) as Usuario;

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@asadasanjuan.cr', password: PASSWORD_PRUEBA });
    adminToken = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await vaciarNotificacionesAveriaPrueba(dataSource);
    await dataSource.getRepository(HorarioLaboralFontanero).clear();
    await dataSource.getRepository('ObservacionAveria').clear();
    await dataSource.getRepository('Averia').clear();
  });

  it('registra el ciclo y conserva los eventos después de resolver', async () => {
    const antes = Date.now();
    const creada = await request(app.getHttpServer())
      .post('/api/v1/public/averias')
      .send(payloadPublico)
      .expect(201);
    const codigo = (creada.body as { data: { codigoSeguimiento: string } }).data
      .codigoSeguimiento;
    const averia = await dataSource.getRepository('Averia').findOneByOrFail({
      codigoSeguimiento: codigo,
    });
    const averiaId = (averia as { id: number }).id;

    const iniciales = await historial.find({
      where: { idAveria: averiaId },
      order: { id: 'ASC' },
    });
    const tiposIniciales = iniciales.map((evento) => evento.tipoEvento);
    expect(tiposIniciales).toEqual(
      expect.arrayContaining([
        TipoEventoAveria.REGISTRO,
        TipoEventoAveria.CODIGO_SEGUIMIENTO,
        TipoEventoAveria.NOTIFICACION,
      ]),
    );
    const registro = iniciales.find(
      (evento) => evento.tipoEvento === TipoEventoAveria.REGISTRO,
    );
    expect(registro?.idUsuario).toBeNull();
    expect(registro?.estadoNuevo).toBe(EstadoAveria.RECIBIDA);
    expect(registro?.fechaHora.getTime()).toBeGreaterThanOrEqual(antes - 1000);
    const codigoEvento = iniciales.find(
      (evento) => evento.tipoEvento === TipoEventoAveria.CODIGO_SEGUIMIENTO,
    );
    expect(codigoEvento?.descripcion).toContain(codigo);
    expect(
      iniciales.some((evento) => evento.descripcion.includes('8888-8888')),
    ).toBe(false);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${averiaId}/estado`)
      .set(auth(adminToken))
      .send({ estado: EstadoAveria.EN_REVISION })
      .expect(200);

    const fontanero = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero Traza',
      correo: 'fontanero.traza@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    const partes = partesLaboralesEnAsada(new Date());
    await horarios.save(
      horarios.create({
        idFontanero: fontanero.idUsuario,
        diaSemana: partes.diaSemana,
        horaInicio: '00:00:00',
        horaFin: '23:59:59',
        activo: true,
      }),
    );
    const loginFontanero = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'fontanero.traza@asadasanjuan.cr',
        password: PASSWORD_PRUEBA,
      })
      .expect(200);
    const fontaneroToken = (loginFontanero.body as { accessToken: string })
      .accessToken;

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${averiaId}/asignacion`)
      .set(auth(adminToken))
      .send({
        fontaneroId: fontanero.idUsuario,
        usuarioId: 999,
        fechaHora: '2020-01-01T00:00:00.000Z',
      })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${averiaId}/asignacion`)
      .set(auth(adminToken))
      .send({ fontaneroId: fontanero.idUsuario })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${averiaId}/prioridad`)
      .set(auth(fontaneroToken))
      .send({ prioridad: 'MEDIA' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${averiaId}/prioridad`)
      .set(auth(fontaneroToken))
      .send({ prioridad: 'ALTA' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${averiaId}/clasificacion`)
      .set(auth(fontaneroToken))
      .send({ clasificacion: TipoAveria.TUBO_MADRE })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${averiaId}/estado`)
      .set(auth(adminToken))
      .send({ estado: EstadoAveria.PENDIENTE })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${averiaId}/iniciar-atencion`)
      .set(auth(fontaneroToken))
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/fontanero/averias/${averiaId}/observaciones`)
      .set(auth(fontaneroToken))
      .send({ observacion: 'Se revisó la tubería y se aisló el tramo.' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${averiaId}/resolver`)
      .set(auth(fontaneroToken))
      .send({ observacionFinal: 'Se reemplazó el tramo dañado.' })
      .expect(200);

    const eventos = await historial.find({
      where: { idAveria: averiaId },
      order: { id: 'ASC' },
    });
    const tipos = eventos.map((evento) => evento.tipoEvento);
    expect(tipos).toEqual(
      expect.arrayContaining([
        TipoEventoAveria.REGISTRO,
        TipoEventoAveria.CODIGO_SEGUIMIENTO,
        TipoEventoAveria.ASIGNACION_FONTANERO,
        TipoEventoAveria.CAMBIO_ESTADO,
        TipoEventoAveria.CAMBIO_PRIORIDAD,
        TipoEventoAveria.CLASIFICACION_TIPO,
        TipoEventoAveria.INICIO_ATENCION,
        TipoEventoAveria.OBSERVACION,
        TipoEventoAveria.RESOLUCION,
        TipoEventoAveria.NOTIFICACION,
      ]),
    );

    const asignacion = eventos.find(
      (evento) => evento.tipoEvento === TipoEventoAveria.ASIGNACION_FONTANERO,
    );
    expect(asignacion?.idUsuario).toBe(administradora.idUsuario);
    expect(asignacion?.descripcion).toContain('Fontanero Traza');
    expect(asignacion?.fechaHora.getFullYear()).toBeGreaterThan(2020);

    const prioridad = eventos.filter(
      (evento) => evento.tipoEvento === TipoEventoAveria.CAMBIO_PRIORIDAD,
    );
    expect(
      prioridad.some(
        (evento) =>
          evento.descripcion === 'Prioridad modificada de Media a Alta',
      ),
    ).toBe(true);
    expect(
      eventos.some(
        (evento) =>
          evento.tipoEvento === TipoEventoAveria.CAMBIO_ESTADO &&
          evento.estadoNuevo === EstadoAveria.PENDIENTE &&
          evento.descripcion === 'Cambio a Pendiente de atención',
      ),
    ).toBe(true);
    expect(
      eventos.some(
        (evento) =>
          evento.tipoEvento === TipoEventoAveria.CLASIFICACION_TIPO &&
          evento.descripcion === 'Tipo de avería clasificado como Tubo madre',
      ),
    ).toBe(true);

    const resolucion = eventos.find(
      (evento) => evento.tipoEvento === TipoEventoAveria.RESOLUCION,
    );
    expect(resolucion?.estadoNuevo).toBe(EstadoAveria.RESUELTA);
    expect(resolucion?.idUsuario).toBe(fontanero.idUsuario);
    expect(eventos.filter((evento) => evento.id === registro?.id)).toHaveLength(
      1,
    );

    const mutable = eventos[0];
    const descripcionOriginal = mutable.descripcion;
    mutable.descripcion = 'Texto alterado por el cliente';
    await expect(historial.save(mutable)).rejects.toThrow(
      HISTORIAL_AVERIA_NO_MODIFICABLE,
    );
    await expect(historial.remove(mutable)).rejects.toThrow(
      HISTORIAL_AVERIA_NO_ELIMINABLE,
    );
    const vigente = await historial.findOneByOrFail({ id: mutable.id });
    expect(vigente.descripcion).toBe(descripcionOriginal);
    expect(await historial.count({ where: { idAveria: averiaId } })).toBe(
      eventos.length,
    );
  });

  it('no deja eventos de asignación si la operación falla', async () => {
    const creada = await request(app.getHttpServer())
      .post('/api/v1/public/averias')
      .send(payloadPublico)
      .expect(201);
    const codigo = (creada.body as { data: { codigoSeguimiento: string } }).data
      .codigoSeguimiento;
    const averia = await dataSource
      .getRepository('Averia')
      .findOneByOrFail({ codigoSeguimiento: codigo });
    const averiaId = (averia as { id: number }).id;
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${averiaId}/estado`)
      .set(auth(adminToken))
      .send({ estado: EstadoAveria.EN_REVISION })
      .expect(200);

    const antes = await historial.count({
      where: {
        idAveria: averiaId,
        tipoEvento: TipoEventoAveria.ASIGNACION_FONTANERO,
      },
    });
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${averiaId}/asignacion`)
      .set(auth(adminToken))
      .send({ fontaneroId: 999999 })
      .expect(404);
    const despues = await historial.count({
      where: {
        idAveria: averiaId,
        tipoEvento: TipoEventoAveria.ASIGNACION_FONTANERO,
      },
    });
    expect(despues).toBe(antes);
  });
});
