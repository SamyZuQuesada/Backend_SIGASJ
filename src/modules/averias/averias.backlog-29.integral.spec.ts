import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import { Role } from '../../common/enums/role.enum';
import { TipoAveria } from '../../common/enums/tipo-averia.enum';
import { TipoEventoAveria } from '../../common/enums/tipo-evento-averia.enum';
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
import {
  AVERIAS_TEST_ENTITIES,
  vaciarNotificacionesAveriaPrueba,
} from './averias.test-entities';
import { AveriasModule } from './averias.module';
import {
  buildAveriasReporteResumen,
  toStartOfNextUtcDay,
  toStartOfUtcDay,
  type AveriaEventosHistorial,
  type AveriasHistorialListado,
  type AveriasReporteResumen,
} from './averias.service';
import { Averia } from './entities/averia.entity';
import { HistorialAveria } from './entities/historial-averia.entity';

const payloadPublico = {
  nombreReportante: 'María Rodríguez',
  telefonoReportante: '8888-4242',
  correoReportante: 'maria.reporte@example.com',
  identificacionReportante: '1-1111-1111',
  ubicacion: 'Frente a la escuela',
  sectorComunidad: 'San Juan Norte',
  descripcion: 'Fuga visible en la tubería de distribución',
};

describe('Backlog 2.9 — historial, reporte y trazabilidad', () => {
  jest.setTimeout(60_000);
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let historial: Repository<HistorialAveria>;
  let usuarios: Repository<Usuario>;
  let horarios: Repository<HorarioLaboralFontanero>;
  let rolesMap: Record<Role, Rol>;
  let adminToken: string;
  let secretariaToken: string;
  let fontaneroToken: string;
  let abonadoToken: string;
  let fontanero: Usuario;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const login = async (email: string) => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD_PRUEBA })
      .expect(200);
    return (response.body as { accessToken: string }).accessToken;
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

    dataSource = moduleFixture.get(DataSource);
    historial = dataSource.getRepository(HistorialAveria);
    usuarios = dataSource.getRepository(Usuario);
    horarios = dataSource.getRepository(HorarioLaboralFontanero);
    rolesMap = await seedRolesBase(dataSource.getRepository(Rol));
    await seedStaffLoginUsers(usuarios, rolesMap);
    fontanero = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Juan Pérez',
      correo: 'fontanero.b29@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Abonado Prueba',
      correo: 'abonado.b29@asadasanjuan.cr',
      role: Role.ABONADO,
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

    adminToken = await login('admin@asadasanjuan.cr');
    secretariaToken = await login('secretaria@asadasanjuan.cr');
    fontaneroToken = await login('fontanero.b29@asadasanjuan.cr');
    abonadoToken = await login('abonado.b29@asadasanjuan.cr');
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await vaciarNotificacionesAveriaPrueba(dataSource);
    await dataSource.getRepository('ObservacionAveria').clear();
    await dataSource.getRepository(Averia).clear();
  });

  const crearYAtender = async () => {
    const creada = await request(app.getHttpServer())
      .post('/api/v1/public/averias')
      .send(payloadPublico)
      .expect(201);
    const codigo = (creada.body as { data: { codigoSeguimiento: string } }).data
      .codigoSeguimiento;
    const averia = await dataSource.getRepository(Averia).findOneByOrFail({
      codigoSeguimiento: codigo,
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${averia.id}/estado`)
      .set(auth(adminToken))
      .send({ estado: EstadoAveria.EN_REVISION })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${averia.id}/asignacion`)
      .set(auth(adminToken))
      .send({ fontaneroId: fontanero.idUsuario })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${averia.id}/prioridad`)
      .set(auth(fontaneroToken))
      .send({ prioridad: 'ALTA' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${averia.id}/clasificacion`)
      .set(auth(fontaneroToken))
      .send({ clasificacion: TipoAveria.TUBO_MADRE })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${averia.id}/estado`)
      .set(auth(adminToken))
      .send({ estado: EstadoAveria.PENDIENTE })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${averia.id}/iniciar-atencion`)
      .set(auth(fontaneroToken))
      .send({})
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/fontanero/averias/${averia.id}/observaciones`)
      .set(auth(fontaneroToken))
      .send({ observacion: 'Se aisló el tramo afectado.' })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${averia.id}/resolver`)
      .set(auth(fontaneroToken))
      .send({ observacionFinal: 'Se reemplazó el tramo dañado.' })
      .expect(200);

    return dataSource.getRepository(Averia).findOneByOrFail({ id: averia.id });
  };

  it('cruza historial general, filtros, resumen y línea de tiempo con lo persistido', async () => {
    const averia = await crearYAtender();
    const dia = averia.fechaReporte.toISOString().slice(0, 10);

    const listado = (
      await request(app.getHttpServer())
        .get('/api/v1/admin/averias/historial')
        .set(auth(adminToken))
        .expect(200)
    ).body as AveriasHistorialListado;
    const fila = listado.data.find((item) => item.id === averia.id);
    expect(fila).toMatchObject({
      codigoSeguimiento: averia.codigoSeguimiento,
      sectorComunidad: 'San Juan Norte',
      estado: EstadoAveria.RESUELTA,
      tipoAveria: TipoAveria.TUBO_MADRE,
      prioridad: 'ALTA',
      fontanero: { id: fontanero.idUsuario, nombre: 'Juan Pérez' },
    });
    expect(fila?.fechaReporte).toBeTruthy();
    expect(fila?.fechaInicioAtencion).toBeTruthy();
    expect(fila?.fechaResolucion).toBeTruthy();
    expect(JSON.stringify(fila)).not.toMatch(/8888-4242|1-1111-1111|maria\.reporte/);

    const porEstado = (
      await request(app.getHttpServer())
        .get('/api/v1/admin/averias/historial')
        .query({ estado: 'Pendiente de atención' })
        .set(auth(adminToken))
        .expect(200)
    ).body as AveriasHistorialListado;
    expect(porEstado.total).toBe(0);

    const combinado = (
      await request(app.getHttpServer())
        .get('/api/v1/admin/averias/historial')
        .query({
          estado: EstadoAveria.RESUELTA,
          prioridad: 'Alta',
          tipo: 'Tubo madre',
          fontaneroId: fontanero.idUsuario,
          sector: 'san juan norte',
          codigoSeguimiento: averia.codigoSeguimiento.slice(-4),
          fechaDesde: dia,
          fechaHasta: dia,
          page: 1,
          limit: 1,
        })
        .set(auth(adminToken))
        .expect(200)
    ).body as AveriasHistorialListado;
    expect(combinado.total).toBe(1);
    expect(combinado.data).toHaveLength(1);
    expect(combinado.page).toBe(1);
    expect(combinado.totalPages).toBe(1);
    expect(combinado.data[0]?.id).toBe(averia.id);

    const sinResultados = (
      await request(app.getHttpServer())
        .get('/api/v1/admin/averias/historial')
        .query({ codigoSeguimiento: 'AV-NO-EXISTE' })
        .set(auth(adminToken))
        .expect(200)
    ).body as AveriasHistorialListado;
    expect(sinResultados).toMatchObject({ data: [], total: 0 });

    await request(app.getHttpServer())
      .get('/api/v1/admin/averias/historial')
      .query({ fechaDesde: '2026-09-20', fechaHasta: '2026-09-01' })
      .set(auth(adminToken))
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/admin/averias/historial')
      .query({ estado: 'EN_PROCESO' })
      .set(auth(adminToken))
      .expect(400);

    const resumen = (
      await request(app.getHttpServer())
        .get('/api/v1/admin/averias/reportes/resumen')
        .query({ fechaDesde: dia, fechaHasta: dia })
        .set(auth(adminToken))
        .expect(200)
    ).body as AveriasReporteResumen;
    const crudo = await dataSource
      .getRepository(Averia)
      .createQueryBuilder('averia')
      .select('averia.estado', 'estado')
      .addSelect('COUNT(averia.id)', 'cantidad')
      .where('averia.fechaReporte >= :desde', {
        desde: toStartOfUtcDay(dia),
      })
      .andWhere('averia.fechaReporte < :hasta', {
        hasta: toStartOfNextUtcDay(dia),
      })
      .groupBy('averia.estado')
      .getRawMany<{ estado: string; cantidad: number | string }>();
    const esperado = buildAveriasReporteResumen(crudo, {
      fechaDesde: dia,
      fechaHasta: dia,
    });
    expect(resumen.total).toBe(esperado.total);
    expect(resumen.porEstado).toEqual(esperado.porEstado);
    expect(resumen.porEstado.RESUELTA).toBeGreaterThanOrEqual(1);
    expect(resumen.total).toBe(
      resumen.porEstado.RECIBIDA +
        resumen.porEstado.ASIGNADA +
        resumen.porEstado.PENDIENTE +
        resumen.porEstado.EN_ATENCION +
        resumen.porEstado.RESUELTA +
        (resumen.porEstado.EN_REVISION ?? 0) +
        (resumen.porEstado.CANCELADA ?? 0) +
        resumen.otros,
    );
    expect(JSON.stringify(resumen)).not.toMatch(/En proceso/);

    const vacio = (
      await request(app.getHttpServer())
        .get('/api/v1/admin/averias/reportes/resumen')
        .query({ fechaDesde: '2099-01-01', fechaHasta: '2099-01-02' })
        .set(auth(adminToken))
        .expect(200)
    ).body as AveriasReporteResumen;
    expect(vacio.total).toBe(0);
    expect(vacio.porEstado.RESUELTA).toBe(0);

    const linea = (
      await request(app.getHttpServer())
        .get(`/api/v1/admin/averias/${averia.id}/historial`)
        .set(auth(secretariaToken))
        .expect(200)
    ).body as AveriaEventosHistorial;
    expect(linea.codigoSeguimiento).toBe(averia.codigoSeguimiento);
    const tipos = linea.data.map((evento) => evento.tipoEvento);
    expect(tipos).toEqual(
      expect.arrayContaining([
        TipoEventoAveria.REGISTRO,
        TipoEventoAveria.ASIGNACION_FONTANERO,
        TipoEventoAveria.CAMBIO_ESTADO,
        TipoEventoAveria.CAMBIO_PRIORIDAD,
        TipoEventoAveria.CLASIFICACION_TIPO,
        TipoEventoAveria.INICIO_ATENCION,
        TipoEventoAveria.OBSERVACION,
        TipoEventoAveria.RESOLUCION,
      ]),
    );
    const instantes = linea.data.map((evento) => ({
      id: evento.id,
      tiempo: new Date(evento.fechaHora).getTime(),
    }));
    for (let index = 1; index < instantes.length; index += 1) {
      const anterior = instantes[index - 1];
      const actual = instantes[index];
      expect(actual.tiempo).toBeGreaterThanOrEqual(anterior.tiempo);
      if (actual.tiempo === anterior.tiempo) {
        expect(actual.id).toBeGreaterThan(anterior.id);
      }
    }
    const registro = linea.data.find(
      (evento) => evento.tipoEvento === TipoEventoAveria.REGISTRO,
    );
    expect(registro?.usuario).toBeNull();
    expect(registro?.estadoNuevo).toBe(EstadoAveria.RECIBIDA);
    expect(registro?.descripcion).toBeTruthy();
    expect(registro?.fechaHora).toBeTruthy();
    const asignacion = linea.data.find(
      (evento) => evento.tipoEvento === TipoEventoAveria.ASIGNACION_FONTANERO,
    );
    expect(asignacion?.usuario).toMatchObject({ nombre: 'Administradora' });
    expect(asignacion?.descripcion).toContain('Juan Pérez');
    expect(
      linea.data.some(
        (evento) =>
          evento.tipoEvento === TipoEventoAveria.CAMBIO_ESTADO &&
          evento.estadoAnterior === EstadoAveria.ASIGNADA &&
          evento.estadoNuevo === EstadoAveria.PENDIENTE,
      ),
    ).toBe(true);
    const resolucion = linea.data.find(
      (evento) => evento.tipoEvento === TipoEventoAveria.RESOLUCION,
    );
    expect(resolucion?.estadoNuevo).toBe(EstadoAveria.RESUELTA);
    expect(resolucion?.usuario).toMatchObject({ nombre: 'Juan Pérez' });
    expect(JSON.stringify(linea)).not.toMatch(
      /8888-4242|1-1111-1111|maria\.reporte/,
    );

    const idsAntes = linea.data.map((evento) => evento.id);
    const descripcionRegistro = registro?.descripcion;
    const totalAntes = await historial.count({ where: { idAveria: averia.id } });
    expect(totalAntes).toBe(linea.data.length);
    expect(new Set(idsAntes).size).toBe(idsAntes.length);

    for (const metodo of ['patch', 'put', 'delete'] as const) {
      await request(app.getHttpServer())
        [metodo](`/api/v1/admin/averias/${averia.id}/historial`)
        .set(auth(adminToken))
        .send({ descripcion: 'Texto alterado' })
        .expect(404);
      await request(app.getHttpServer())
        [metodo](`/api/v1/admin/averias/${averia.id}/historial/${registro?.id}`)
        .set(auth(adminToken))
        .send({ descripcion: 'Texto alterado' })
        .expect(404);
      await request(app.getHttpServer())
        [metodo](`/api/v1/public/averias/${averia.id}/historial`)
        .send({ descripcion: 'Texto alterado' })
        .expect(404);
    }

    const despues = await historial.find({
      where: { idAveria: averia.id },
      order: { id: 'ASC' },
    });
    expect(despues).toHaveLength(totalAntes);
    expect(despues.map((evento) => evento.id)).toEqual(idsAntes);
    expect(
      despues.find((evento) => evento.tipoEvento === TipoEventoAveria.REGISTRO)
        ?.descripcion,
    ).toBe(descripcionRegistro);
    expect(despues.every((evento) => evento.idAveria === averia.id)).toBe(true);
  });

  it('aplica 401, 403 y 404 y deja leer a Administradora y Secretaria', async () => {
    const averia = await crearYAtender();
    const rutas = [
      '/api/v1/admin/averias/historial',
      '/api/v1/admin/averias/reportes/resumen',
      `/api/v1/admin/averias/${averia.id}/historial`,
    ];

    for (const ruta of rutas) {
      await request(app.getHttpServer()).get(ruta).expect(401);
      await request(app.getHttpServer())
        .get(ruta)
        .set(auth('token-vencido'))
        .expect(401);
      await request(app.getHttpServer())
        .get(ruta)
        .set(auth(fontaneroToken))
        .expect(403);
      await request(app.getHttpServer())
        .get(ruta)
        .set(auth(abonadoToken))
        .expect(403);
      await request(app.getHttpServer())
        .get(ruta)
        .set(auth(adminToken))
        .expect(200);
      await request(app.getHttpServer())
        .get(ruta)
        .set(auth(secretariaToken))
        .expect(200);
    }

    await request(app.getHttpServer())
      .get('/api/v1/admin/averias/999999/historial')
      .set(auth(adminToken))
      .expect(404);
    await request(app.getHttpServer())
      .get('/api/v1/admin/averias/abc/historial')
      .set(auth(adminToken))
      .expect(400);
    await request(app.getHttpServer())
      .get('/api/v1/admin/averias/reportes/resumen')
      .query({ fechaDesde: '2026-12-31', fechaHasta: '2026-01-01' })
      .set(auth(secretariaToken))
      .expect(400);
  });
});
