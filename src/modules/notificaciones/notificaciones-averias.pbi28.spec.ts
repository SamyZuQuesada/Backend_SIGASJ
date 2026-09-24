import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { EstadoAveria } from '../../common/enums/estado-averia.enum';
import {
  EstadoEnvioSmsAveria,
  MotivoBloqueoSmsAveria,
} from '../../common/enums/estado-envio-sms-averia.enum';
import { Role } from '../../common/enums/role.enum';
import { TipoEventoSmsAveria } from '../../common/enums/tipo-evento-sms-averia.enum';
import { TipoNotificacionAveria } from '../../common/enums/tipo-notificacion-averia.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { partesLaboralesEnAsada } from '../../common/time/reloj-asada';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import {
  AVERIAS_TEST_ENTITIES,
  vaciarNotificacionesAveriaPrueba,
} from '../averias/averias.test-entities';
import { AveriasModule } from '../averias/averias.module';
import { TRANSICIONES_ESTADO_AVERIA } from '../averias/averias.estado-transiciones';
import { Averia } from '../averias/entities/averia.entity';
import { ObservacionAveria } from '../averias/entities/observacion-averia.entity';
import { HorarioLaboralFontanero } from '../usuarios/entities/horario-laboral-fontanero.entity';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  crearUsuarioPrueba,
  seedRolesBase,
} from '../usuarios/usuarios.test-helpers';
import { IntentoSmsAveria } from './entities/intento-sms-averia.entity';
import { NotificacionAveria } from './entities/notificacion-averia.entity';
import {
  NOTIFICACION_AJENA,
  type NotificacionesAveriaListado,
} from './notificaciones-averias.service';

const payloadMinimo = {
  nombreReportante: 'María Rodríguez',
  telefonoReportante: '8888-8888',
  ubicacion: 'Frente a la escuela, 50 m sur, casa verde',
  sectorComunidad: 'San Juan',
  descripcion: 'Se observa una fuga visible en la tubería de distribución',
};

describe('PBI 2.8 — notificaciones internas y preparación SMS', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let averias: Repository<Averia>;
  let observaciones: Repository<ObservacionAveria>;
  let usuarios: Repository<Usuario>;
  let horarios: Repository<HorarioLaboralFontanero>;
  let notificaciones: Repository<NotificacionAveria>;
  let intentosSms: Repository<IntentoSmsAveria>;
  let rolesMap: Record<Role, Rol>;
  let administradora: Usuario;
  let secretaria: Usuario;
  let fontanero: Usuario;
  let adminToken: string;
  let secretariaToken: string;
  let fontaneroToken: string;
  let seq = 0;

  const login = (email: string) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password123!' });

  const persistAveria = async (overrides: Partial<Averia> = {}) => {
    seq += 1;
    return averias.save(
      averias.create({
        codigoSeguimiento: overrides.codigoSeguimiento ?? `AV-N28-${seq}`,
        fechaReporte: new Date('2026-09-12T15:00:00.000Z'),
        nombreReportante: 'María Rodríguez',
        telefonoReportante: '8888-1111',
        ubicacion: 'Escuela',
        sectorComunidad: 'San Juan',
        descripcion: 'Fuga',
        estado: overrides.estado ?? EstadoAveria.EN_REVISION,
        idFontaneroAsignado: overrides.idFontaneroAsignado ?? null,
        fechaAsignacion: overrides.fechaAsignacion ?? null,
        fechaInicioAtencion: overrides.fechaInicioAtencion ?? null,
        fechaResolucion: overrides.fechaResolucion ?? null,
      }),
    );
  };

  const definirHorario = async (
    idFontanero: number,
    jornadaCompleta: boolean,
  ) => {
    const partes = partesLaboralesEnAsada(new Date());
    const ventana = jornadaCompleta
      ? { horaInicio: '00:00:00', horaFin: '23:59:59' }
      : partes.segundosDesdeMedianoche >= 3600
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

    dataSource = moduleFixture.get(DataSource);
    averias = dataSource.getRepository(Averia);
    observaciones = dataSource.getRepository(ObservacionAveria);
    usuarios = dataSource.getRepository(Usuario);
    horarios = dataSource.getRepository(HorarioLaboralFontanero);
    notificaciones = dataSource.getRepository(NotificacionAveria);
    intentosSms = dataSource.getRepository(IntentoSmsAveria);
    rolesMap = await seedRolesBase(dataSource.getRepository(Rol));

    administradora = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Administradora 2.8',
      correo: 'admin28@asadasanjuan.cr',
      role: Role.ADMINISTRADORA,
    });
    secretaria = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Secretaria 2.8',
      correo: 'secretaria28@asadasanjuan.cr',
      role: Role.SECRETARIA,
    });
    fontanero = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero 2.8',
      correo: 'fontanero28@asadasanjuan.cr',
      role: Role.FONTANERO,
    });

    const adminLogin = await login('admin28@asadasanjuan.cr');
    expect(adminLogin.status).toBe(200);
    adminToken = (adminLogin.body as { accessToken: string }).accessToken;

    const secretariaLogin = await login('secretaria28@asadasanjuan.cr');
    expect(secretariaLogin.status).toBe(200);
    secretariaToken = (secretariaLogin.body as { accessToken: string })
      .accessToken;

    const fontaneroLogin = await login('fontanero28@asadasanjuan.cr');
    expect(fontaneroLogin.status).toBe(200);
    fontaneroToken = (fontaneroLogin.body as { accessToken: string })
      .accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await vaciarNotificacionesAveriaPrueba(dataSource);
    await observaciones.clear();
    await horarios.clear();
    await averias.clear();
  });

  it('registra notificación interna a administradoras activas al confirmar el reporte público', async () => {
    const inactiva = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Admin inactiva',
      correo: `admin.inactiva.${Date.now()}@asadasanjuan.cr`,
      role: Role.ADMINISTRADORA,
      activo: false,
    });

    const response = await request(app.getHttpServer())
      .post('/api/v1/public/averias')
      .send(payloadMinimo)
      .expect(201);

    const codigo = (response.body as { data?: { codigoSeguimiento?: string } })
      .data?.codigoSeguimiento;
    const persistida = await averias.findOneBy({ codigoSeguimiento: codigo });
    expect(persistida).toBeDefined();

    const filas = await notificaciones.find();
    expect(filas).toHaveLength(1);
    expect(filas[0]?.idUsuarioDestinatario).toBe(administradora.idUsuario);
    expect(filas[0]?.idAveria).toBe(persistida?.id);
    expect(filas[0]?.tipo).toBe(
      TipoNotificacionAveria.AVERIA_REGISTRADA_ADMINISTRADORA,
    );
    expect(filas[0]?.leida).toBe(false);
    expect(JSON.stringify(filas[0])).not.toContain('8888-8888');
    expect(JSON.stringify(filas[0])).not.toContain('María Rodríguez');
    expect(
      filas.some((row) => row.idUsuarioDestinatario === inactiva.idUsuario),
    ).toBe(false);
    expect(
      filas.some((row) => row.idUsuarioDestinatario === secretaria.idUsuario),
    ).toBe(false);
  });

  it('prepara SMS de confirmación sin enviarlo ni marcarlo entregado', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/public/averias')
      .send(payloadMinimo)
      .expect(201);
    const codigo = (response.body as { data?: { codigoSeguimiento?: string } })
      .data?.codigoSeguimiento;
    const persistida = await averias.findOneBy({ codigoSeguimiento: codigo });

    const intentos = await intentosSms.find();
    expect(intentos).toHaveLength(1);
    expect(intentos[0]?.idAveria).toBe(persistida?.id);
    expect(intentos[0]?.tipoEvento).toBe(
      TipoEventoSmsAveria.CONFIRMACION_REGISTRO,
    );
    expect(intentos[0]?.estadoEnvio).toBe(EstadoEnvioSmsAveria.NO_ENVIADO);
    expect(intentos[0]?.motivoBloqueo).toBe(
      MotivoBloqueoSmsAveria.PROVEEDOR_NO_CONFIGURADO,
    );
    expect(intentos[0]?.destinatarioClase).toBe('reportante');
    expect(JSON.stringify(intentos[0])).not.toMatch(/ENTREGADA/);
    expect(JSON.stringify(intentos[0])).not.toContain('8888-8888');
  });

  it('no crea notificación ni SMS si el registro público falla', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/public/averias')
      .send({ nombreReportante: 'X' })
      .expect(400);

    expect(await notificaciones.count()).toBe(0);
    expect(await intentosSms.count()).toBe(0);
  });

  it('notifica al fontanero asignado y no duplica el mismo evento', async () => {
    await definirHorario(fontanero.idUsuario, true);
    const saved = await persistAveria({ codigoSeguimiento: 'AV-N28-ASG' });

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${saved.id}/asignacion`)
      .set('Authorization', `Bearer ${secretariaToken}`)
      .send({ fontaneroId: fontanero.idUsuario })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${saved.id}/asignacion`)
      .set('Authorization', `Bearer ${secretariaToken}`)
      .send({ fontaneroId: fontanero.idUsuario })
      .expect(400);

    const filas = await notificaciones.find({
      where: { tipo: TipoNotificacionAveria.AVERIA_ASIGNADA_FONTANERO },
    });
    expect(filas).toHaveLength(1);
    expect(filas[0]?.idUsuarioDestinatario).toBe(fontanero.idUsuario);
    expect(filas[0]?.idAveria).toBe(saved.id);
  });

  it('asignación fallida no genera notificación', async () => {
    const saved = await persistAveria({ codigoSeguimiento: 'AV-N28-FAIL' });
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${saved.id}/asignacion`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fontaneroId: 999999 })
      .expect(404);

    expect(await notificaciones.count()).toBe(0);
  });

  it('consulta solo las notificaciones del JWT y deniega marcar una ajena', async () => {
    await definirHorario(fontanero.idUsuario, true);
    const saved = await persistAveria({ codigoSeguimiento: 'AV-N28-OWN' });
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${saved.id}/asignacion`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fontaneroId: fontanero.idUsuario })
      .expect(200);

    const propiasFontanero = await request(app.getHttpServer())
      .get('/api/v1/notificaciones')
      .set('Authorization', `Bearer ${fontaneroToken}`)
      .expect(200);
    const bodyFontanero = propiasFontanero.body as NotificacionesAveriaListado;
    expect(bodyFontanero.data).toHaveLength(1);
    expect(bodyFontanero.noLeidas).toBe(1);
    expect(bodyFontanero.data[0]?.idAveria).toBe(saved.id);

    const propiasAdmin = await request(app.getHttpServer())
      .get('/api/v1/notificaciones')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const bodyAdmin = propiasAdmin.body as NotificacionesAveriaListado;
    expect(
      bodyAdmin.data.every((item) => item.id !== bodyFontanero.data[0]?.id),
    ).toBe(true);

    await request(app.getHttpServer())
      .patch(`/api/v1/notificaciones/${bodyFontanero.data[0]?.id}/lectura`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403)
      .expect((res) => {
        expect(JSON.stringify(res.body)).toContain(NOTIFICACION_AJENA);
      });

    const leida = await request(app.getHttpServer())
      .patch(`/api/v1/notificaciones/${bodyFontanero.data[0]?.id}/lectura`)
      .set('Authorization', `Bearer ${fontaneroToken}`)
      .expect(200);
    expect((leida.body as { leida: boolean }).leida).toBe(true);

    await request(app.getHttpServer())
      .get('/api/v1/notificaciones')
      .expect(401);
  });

  it('prepara SMS al pasar a PENDIENTE por horario, no al consultar', async () => {
    await definirHorario(fontanero.idUsuario, false);
    const saved = await persistAveria({ codigoSeguimiento: 'AV-N28-PEND' });
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${saved.id}/asignacion`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fontaneroId: fontanero.idUsuario })
      .expect(200);

    expect((await averias.findOneBy({ id: saved.id }))?.estado).toBe(
      EstadoAveria.PENDIENTE,
    );
    expect(await intentosSms.count()).toBe(1);
    const intento = await intentosSms.findOneBy({
      tipoEvento: TipoEventoSmsAveria.AVERIA_PENDIENTE,
    });
    expect(intento?.estadoEnvio).toBe(EstadoEnvioSmsAveria.NO_ENVIADO);
    expect(intento?.motivoBloqueo).toBe(
      MotivoBloqueoSmsAveria.PROVEEDOR_NO_CONFIGURADO,
    );
    expect(intento?.destinatarioClase).toBe('reportante');

    await request(app.getHttpServer())
      .get(`/api/v1/admin/averias/${saved.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(await intentosSms.count()).toBe(1);
  });

  it('prepara SMS al resolver y no lo marca entregado', async () => {
    const saved = await persistAveria({
      codigoSeguimiento: 'AV-N28-RES',
      estado: EstadoAveria.EN_ATENCION,
      idFontaneroAsignado: fontanero.idUsuario,
      fechaAsignacion: new Date(),
      fechaInicioAtencion: new Date(),
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${saved.id}/resolver`)
      .set('Authorization', `Bearer ${fontaneroToken}`)
      .send({ observacionFinal: 'Reparación concluida en sitio.' })
      .expect(200);

    const intentos = await intentosSms.find();
    expect(intentos).toHaveLength(1);
    expect(intentos[0]?.tipoEvento).toBe(TipoEventoSmsAveria.AVERIA_RESUELTA);
    expect(intentos[0]?.estadoEnvio).toBe(EstadoEnvioSmsAveria.NO_ENVIADO);
    expect(intentos[0]?.motivoBloqueo).toBe(
      MotivoBloqueoSmsAveria.PROVEEDOR_NO_CONFIGURADO,
    );
    expect(intentos[0]?.destinatarioClase).toBe('reportante');
    expect(JSON.stringify(intentos[0])).not.toMatch(
      /DESTINATARIO_NO_CONFIRMADO/,
    );
    expect(JSON.stringify(intentos[0])).not.toContain('8888-1111');

    await request(app.getHttpServer())
      .get(`/api/v1/admin/averias/${saved.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(await intentosSms.count()).toBe(1);
  });

  it('prepara SMS al pasar a RESUELTA por administración; destinatario reportante', async () => {
    const saved = await persistAveria({
      codigoSeguimiento: 'AV-N28-ADM-RES',
      estado: EstadoAveria.EN_ATENCION,
      idFontaneroAsignado: fontanero.idUsuario,
      fechaAsignacion: new Date(),
      fechaInicioAtencion: new Date(),
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/averias/${saved.id}/estado`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ estado: EstadoAveria.RESUELTA })
      .expect(200);

    const intentos = await intentosSms.find();
    expect(intentos).toHaveLength(1);
    expect(intentos[0]?.tipoEvento).toBe(TipoEventoSmsAveria.AVERIA_RESUELTA);
    expect(intentos[0]?.destinatarioClase).toBe('reportante');
    expect(intentos[0]?.motivoBloqueo).not.toBe(
      MotivoBloqueoSmsAveria.DESTINATARIO_NO_CONFIRMADO,
    );

    await request(app.getHttpServer())
      .patch(`/api/v1/fontanero/averias/${saved.id}/resolver`)
      .set('Authorization', `Bearer ${fontaneroToken}`)
      .send({ observacionFinal: 'Intento duplicado de resolución.' })
      .expect(400);
    expect(await intentosSms.count()).toBe(1);
  });

  it('no modifica el grafo de estados ni los roles de averías', () => {
    expect(TRANSICIONES_ESTADO_AVERIA[EstadoAveria.RECIBIDA]).toEqual([
      EstadoAveria.EN_REVISION,
    ]);
    expect(TRANSICIONES_ESTADO_AVERIA[EstadoAveria.RESUELTA]).toEqual([]);
    expect(TRANSICIONES_ESTADO_AVERIA[EstadoAveria.EN_ATENCION]).toEqual([
      EstadoAveria.RESUELTA,
      EstadoAveria.PENDIENTE,
    ]);
  });
});
