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
import { AveriasModule } from './averias.module';
import {
  AVERIA_ADMIN_NOT_FOUND,
  AVERIA_FONTANERO_FORBIDDEN,
  OBSERVACIONES_ATENCION_VACIAS,
  PRIORIDAD_AVERIA_SIN_ASIGNAR,
  TIPO_AVERIA_SIN_CLASIFICAR,
  type AveriaFontaneroDetail,
} from './averias.service';
import { Averia } from './entities/averia.entity';
import { ObservacionAveria } from './entities/observacion-averia.entity';

const LONG_DESCRIPTION = [
  'Fuga continua en la tubería de distribución frente a la escuela.',
  'El agua llega hasta el patio de tres viviendas y dificulta el paso peatonal.',
].join('\n');

const SENSITIVE =
  /password|passwordHash|refreshToken|"token"|sessions|credentials|idFontaneroAsignado|fontaneroAsignado|identificacionReportante|correoReportante|"idAbonado"|"abonado"|createdAt|updatedAt/i;

describe('GET /api/v1/fontanero/averias/:id — detalle asignado al Fontanero', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let averias: Repository<Averia>;
  let usuarios: Repository<Usuario>;
  let rolesMap: Record<Role, Rol>;
  let fontaneroA: Usuario;
  let fontaneroB: Usuario;
  let tokenA: string;
  let tokenB: string;
  let usuarioSeq = 0;

  const signAs = (role: Role, sub: string) => {
    const payload: JwtPayload = {
      sub,
      email: 'usuario@asadasanjuan.cr',
      role,
      name: 'Usuario',
    };
    return jwtService.sign(payload);
  };

  const getDetalle = (id: number | string, token?: string | null) => {
    const req = request(app.getHttpServer()).get(
      `/api/v1/fontanero/averias/${id}`,
    );
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  };

  const persist = async (overrides: Partial<Averia> = {}) => {
    usuarioSeq += 1;
    return averias.save(
      averias.create({
        codigoSeguimiento:
          overrides.codigoSeguimiento ?? `AV-FNT-${usuarioSeq}`,
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
        descripcion: overrides.descripcion ?? LONG_DESCRIPTION,
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
            ? null
            : overrides.observacionesAtencion,
      }),
    );
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
          entities: [Averia, ObservacionAveria, Usuario, Rol, HorarioLaboralFontanero],
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
    tokenA = signAs(Role.FONTANERO, String(fontaneroA.idUsuario));
    tokenB = signAs(Role.FONTANERO, String(fontaneroB.idUsuario));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await averias.clear();
  });

  it('Fontanero A consulta una avería asignada y recibe el detalle de atención', async () => {
    const saved = await persist({
      codigoSeguimiento: 'AV-FNT-OK',
      tipoAveria: 'TUBERIA_DANADA',
      prioridad: 'ALTA',
      fechaInicioAtencion: new Date('2026-09-13T09:00:00.000Z'),
      fechaResolucion: new Date('2026-09-13T15:45:00.000Z'),
      observacionesAtencion: 'Se reemplazó el tramo afectado.',
    });

    const response = await getDetalle(saved.id, tokenA).expect(200);
    const body = response.body as AveriaFontaneroDetail;

    expect(body.id).toBe(saved.id);
    expect(body.codigoSeguimiento).toBe('AV-FNT-OK');
    expect(new Date(body.fechaReporte).toISOString()).toBe(
      '2026-09-12T15:00:00.000Z',
    );
    expect(
      new Date(body.fechaAsignacion as unknown as string).toISOString(),
    ).toBe('2026-09-13T08:15:00.000Z');
    expect(body.estado).toBe(EstadoAveria.ASIGNADA);
    expect(body.sectorComunidad).toBe('San Juan');
    expect(body.ubicacion).toBe('Frente a la escuela, 50 m sur');
    expect(body.descripcion).toBe(LONG_DESCRIPTION);
    expect(body.nombreReportante).toBe('María Rodríguez');
    expect(body.telefonoReportante).toBe('8888-1111');
    expect(body.tipoAveria).toBe('TUBERIA_DANADA');
    expect(body.prioridad).toBe('ALTA');
    expect(
      new Date(body.fechaInicioAtencion as unknown as string).toISOString(),
    ).toBe('2026-09-13T09:00:00.000Z');
    expect(
      new Date(body.fechaResolucion as unknown as string).toISOString(),
    ).toBe('2026-09-13T15:45:00.000Z');
    expect(body.observacionesAtencion).toBe('Se reemplazó el tramo afectado.');
    expect(body.observaciones).toEqual([]);
    expect(JSON.stringify(body)).not.toMatch(SENSITIVE);
    expect(body).not.toHaveProperty('identificacionReportante');
    expect(body).not.toHaveProperty('correoReportante');
    expect(body).not.toHaveProperty('abonado');
    expect(body).not.toHaveProperty('passwordHash');
  });

  it('avería recién asignada maneja tipo, prioridad y atención pendientes', async () => {
    const saved = await persist({
      codigoSeguimiento: 'AV-FNT-PEND',
      estado: EstadoAveria.ASIGNADA,
      tipoAveria: null,
      prioridad: null,
      fechaInicioAtencion: null,
      fechaResolucion: null,
      observacionesAtencion: null,
    });

    const body = (await getDetalle(saved.id, tokenA).expect(200))
      .body as AveriaFontaneroDetail;
    expect(body.estado).toBe(EstadoAveria.ASIGNADA);
    expect(body.tipoAveria).toBe(TIPO_AVERIA_SIN_CLASIFICAR);
    expect(body.prioridad).toBe(PRIORIDAD_AVERIA_SIN_ASIGNAR);
    expect(body.fechaInicioAtencion).toBeNull();
    expect(body.fechaResolucion).toBeNull();
    expect(body.observacionesAtencion).toBe(OBSERVACIONES_ATENCION_VACIAS);
    expect(body.observaciones).toEqual([]);
  });

  it('avería inexistente responde 404 sin filtrar datos del caso', async () => {
    const response = await getDetalle(999999, tokenA).expect(404);
    expect(response.body).toEqual({
      statusCode: 404,
      message: AVERIA_ADMIN_NOT_FOUND,
    });
    expect(response.body).not.toHaveProperty('codigoSeguimiento');
    expect(response.body).not.toHaveProperty('nombreReportante');
  });

  it('Fontanero B no puede consultar la avería del Fontanero A', async () => {
    const saved = await persist({
      codigoSeguimiento: 'AV-FNT-A',
      idFontaneroAsignado: fontaneroA.idUsuario,
    });

    const response = await getDetalle(saved.id, tokenB).expect(403);
    expect(response.body).toEqual({
      statusCode: 403,
      message: AVERIA_FONTANERO_FORBIDDEN,
    });
    expect(response.body).not.toHaveProperty('codigoSeguimiento');
    expect(response.body).not.toHaveProperty('descripcion');
    expect(response.body).not.toHaveProperty('telefonoReportante');
  });

  it('avería sin Fontanero asignado también se rechaza con 403', async () => {
    const saved = await persist({
      codigoSeguimiento: 'AV-FNT-NA',
      estado: EstadoAveria.EN_REVISION,
      idFontaneroAsignado: null,
      fechaAsignacion: null,
    });
    const response = await getDetalle(saved.id, tokenA).expect(403);
    expect(response.body).toMatchObject({
      statusCode: 403,
      message: AVERIA_FONTANERO_FORBIDDEN,
    });
    expect(response.body).not.toHaveProperty('codigoSeguimiento');
  });

  it('sin sesión responde 401', async () => {
    const saved = await persist({ codigoSeguimiento: 'AV-FNT-401' });
    const response = await getDetalle(saved.id).expect(401);
    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    expect(response.body).not.toHaveProperty('codigoSeguimiento');
  });

  it.each([
    [Role.ADMINISTRADORA, '1'],
    [Role.SECRETARIA, '2'],
    [Role.ABONADO, '4'],
  ])('%s recibe 403 en la ruta del Fontanero', async (role, sub) => {
    const saved = await persist({ codigoSeguimiento: `AV-FNT-${role}` });
    const response = await getDetalle(saved.id, signAs(role, sub)).expect(403);
    expect(response.body).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });
    expect(response.body).not.toHaveProperty('codigoSeguimiento');
  });

  it('ID inválido responde 400 y no 404 ni 500', async () => {
    for (const id of ['abc', '0', '-1', '12.5']) {
      const response = await getDetalle(id, tokenA);
      expect(response.status).toBe(400);
      expect(response.status).not.toBe(404);
      expect(response.status).not.toBe(500);
      expect(response.body).toMatchObject({ statusCode: 400 });
      expect(response.body).not.toHaveProperty('codigoSeguimiento');
    }
  });
});
