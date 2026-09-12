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
import { Usuario } from '../usuarios/entities/usuario.entity';
import { AveriasModule } from './averias.module';
import {
  AVERIA_ADMIN_NOT_FOUND,
  type AveriaAdminDetail,
} from './averias.service';
import { Averia } from './entities/averia.entity';

const LONG_DESCRIPTION = [
  'Fuga continua en la tubería de distribución frente a la escuela.',
  'El agua llega hasta el patio de tres viviendas y dificulta el paso peatonal.',
  'Solicitan revisión urgente del tubo madre y verificación de presión.',
].join('\n');

const SENSITIVE =
  /password|passwordHash|refreshToken|"token"|sessions|credentials|idFontaneroAsignado|fontaneroAsignado|"idAbonado"|createdAt|updatedAt/i;

describe('GET /api/v1/admin/averias/:id — detalle administrativo', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let averias: Repository<Averia>;
  let usuarios: Repository<Usuario>;
  let adminToken: string;
  let secretariaToken: string;
  let fontaneroId: number;

  const signAs = (role: Role, sub = '1') => {
    const payload: JwtPayload = {
      sub,
      email: 'usuario@asadasanjuan.cr',
      role,
      name: 'Usuario',
    };
    return jwtService.sign(payload);
  };

  const getDetalle = (id: number | string, token?: string | null) => {
    const req = request(app.getHttpServer()).get(`/api/v1/admin/averias/${id}`);
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  };

  const persist = async (overrides: Partial<Averia> = {}) => {
    return averias.save(
      averias.create({
        codigoSeguimiento: overrides.codigoSeguimiento ?? 'AV-DET-0001',
        fechaReporte:
          overrides.fechaReporte ?? new Date('2026-09-12T15:00:00.000Z'),
        nombreReportante: overrides.nombreReportante ?? 'María Rodríguez',
        identificacionReportante:
          overrides.identificacionReportante === undefined
            ? null
            : overrides.identificacionReportante,
        telefonoReportante: overrides.telefonoReportante ?? '8888-1111',
        correoReportante:
          overrides.correoReportante === undefined
            ? null
            : overrides.correoReportante,
        idAbonado:
          overrides.idAbonado === undefined ? null : overrides.idAbonado,
        ubicacion: overrides.ubicacion ?? 'Frente a la escuela, 50 m sur',
        sectorComunidad: overrides.sectorComunidad ?? 'San Juan',
        descripcion: overrides.descripcion ?? 'Fuga visible en tubería',
        estado: overrides.estado ?? EstadoAveria.RECIBIDA,
        tipoAveria:
          overrides.tipoAveria === undefined ? null : overrides.tipoAveria,
        prioridad:
          overrides.prioridad === undefined ? null : overrides.prioridad,
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
          entities: [Averia, Usuario],
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
    const fontanero = await usuarios.save(usuarios.create({}));
    fontaneroId = fontanero.idUsuario;
  });

  it('Administradora recibe 200 con avería recién recibida y nulls administrativos', async () => {
    const saved = await persist({
      codigoSeguimiento: 'AV-DET-REC',
    });

    const response = await getDetalle(saved.id, adminToken).expect(200);
    const body = response.body as AveriaAdminDetail;

    expect(body.id).toBe(saved.id);
    expect(body.codigoSeguimiento).toBe('AV-DET-REC');
    expect(body.estado).toBe(EstadoAveria.RECIBIDA);
    expect(body.nombreReportante).toBe('María Rodríguez');
    expect(body.identificacionReportante).toBeNull();
    expect(body.telefonoReportante).toBe('8888-1111');
    expect(body.correoReportante).toBeNull();
    expect(body.abonado).toBeNull();
    expect(body.sectorComunidad).toBe('San Juan');
    expect(body.ubicacion).toBe('Frente a la escuela, 50 m sur');
    expect(body.descripcion).toBe('Fuga visible en tubería');
    expect(body.tipoAveria).toBeNull();
    expect(body.prioridad).toBeNull();
    expect(body.fontanero).toBeNull();
    expect(body.fechaAsignacion).toBeNull();
    expect(body.fechaInicioAtencion).toBeNull();
    expect(body.fechaResolucion).toBeNull();
    expect(body.observacionesAtencion).toBeNull();
    expect(JSON.stringify(body)).not.toMatch(SENSITIVE);
  });

  it('Secretaria autenticada recibe 200 (rol real SECRETARIA)', async () => {
    const saved = await persist({ codigoSeguimiento: 'AV-DET-SEC' });
    const response = await getDetalle(saved.id, secretariaToken).expect(200);
    expect((response.body as AveriaAdminDetail).id).toBe(saved.id);
  });

  it('devuelve el detalle completo sin serializar entidades ni secretos', async () => {
    const saved = await persist({
      codigoSeguimiento: 'AV-DET-FULL',
      identificacionReportante: '1-2345-6789',
      correoReportante: 'juan.perez@example.com',
      telefonoReportante: '8888-2222',
      nombreReportante: 'Juan Pérez',
      idAbonado: 14,
      sectorComunidad: 'Barrio El Carmen',
      ubicacion: '200 m este del tanque, costado norte',
      descripcion: LONG_DESCRIPTION,
      tipoAveria: 'TUBERIA',
      prioridad: 'ALTA',
      idFontaneroAsignado: fontaneroId,
      fechaAsignacion: new Date('2026-09-13T08:15:00.000Z'),
      fechaInicioAtencion: new Date('2026-09-13T09:00:00.000Z'),
      fechaResolucion: new Date('2026-09-13T15:45:00.000Z'),
      observacionesAtencion: 'Se reemplazó el tramo afectado.',
    });

    const response = await getDetalle(saved.id, adminToken).expect(200);
    const body = response.body as AveriaAdminDetail;

    expect(body).toMatchObject({
      id: saved.id,
      codigoSeguimiento: 'AV-DET-FULL',
      estado: EstadoAveria.RECIBIDA,
      nombreReportante: 'Juan Pérez',
      identificacionReportante: '1-2345-6789',
      telefonoReportante: '8888-2222',
      correoReportante: 'juan.perez@example.com',
      abonado: { id: 14 },
      sectorComunidad: 'Barrio El Carmen',
      ubicacion: '200 m este del tanque, costado norte',
      descripcion: LONG_DESCRIPTION,
      tipoAveria: 'TUBERIA',
      prioridad: 'ALTA',
      fontanero: { id: fontaneroId },
      observacionesAtencion: 'Se reemplazó el tramo afectado.',
    });
    expect(
      new Date(body.fechaAsignacion as unknown as string).toISOString(),
    ).toBe('2026-09-13T08:15:00.000Z');
    expect(
      new Date(body.fechaInicioAtencion as unknown as string).toISOString(),
    ).toBe('2026-09-13T09:00:00.000Z');
    expect(
      new Date(body.fechaResolucion as unknown as string).toISOString(),
    ).toBe('2026-09-13T15:45:00.000Z');
    expect(body.descripcion).toBe(LONG_DESCRIPTION);
    expect(body.descripcion.length).toBe(LONG_DESCRIPTION.length);
    expect(JSON.stringify(body)).not.toMatch(SENSITIVE);
    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('passwordHash');
    expect(body).not.toHaveProperty('refreshToken');
    expect(body.fontanero).toEqual({ id: fontaneroId });
    expect(body.abonado).toEqual({ id: 14 });
  });

  it('avería asignada incluye Fontanero y fechaAsignacion', async () => {
    const saved = await persist({
      codigoSeguimiento: 'AV-DET-ASIG',
      idFontaneroAsignado: fontaneroId,
      fechaAsignacion: new Date('2026-09-13T08:15:00.000Z'),
      tipoAveria: 'TUBERIA',
      prioridad: 'MEDIA',
    });
    const body = (await getDetalle(saved.id, adminToken).expect(200))
      .body as AveriaAdminDetail;
    expect(body.fontanero).toEqual({ id: fontaneroId });
    expect(body.fechaAsignacion).toBeTruthy();
    expect(body.fechaInicioAtencion).toBeNull();
    expect(body.fechaResolucion).toBeNull();
  });

  it('avería en atención incluye inicio y mantiene resolución null', async () => {
    const saved = await persist({
      codigoSeguimiento: 'AV-DET-ATE',
      idFontaneroAsignado: fontaneroId,
      tipoAveria: 'TUBERIA',
      prioridad: 'ALTA',
      fechaAsignacion: new Date('2026-09-04T10:30:00.000Z'),
      fechaInicioAtencion: new Date('2026-09-04T11:05:00.000Z'),
    });
    const body = (await getDetalle(saved.id, adminToken).expect(200))
      .body as AveriaAdminDetail;
    expect(body.fontanero).toEqual({ id: fontaneroId });
    expect(body.tipoAveria).toBe('TUBERIA');
    expect(body.prioridad).toBe('ALTA');
    expect(body.fechaInicioAtencion).toBeTruthy();
    expect(body.fechaResolucion).toBeNull();
    expect(body.observacionesAtencion).toBeNull();
  });

  it('avería resuelta devuelve fechas administrativas y observaciones', async () => {
    const saved = await persist({
      codigoSeguimiento: 'AV-DET-RES',
      idFontaneroAsignado: fontaneroId,
      tipoAveria: 'TUBERIA',
      prioridad: 'MEDIA',
      fechaAsignacion: new Date('2026-08-20T08:10:00.000Z'),
      fechaInicioAtencion: new Date('2026-08-20T09:00:00.000Z'),
      fechaResolucion: new Date('2026-08-20T15:45:00.000Z'),
      observacionesAtencion: 'Tramo reemplazado y presión normal.',
    });
    const body = (await getDetalle(saved.id, adminToken).expect(200))
      .body as AveriaAdminDetail;
    expect(body.fechaResolucion).toBeTruthy();
    expect(body.observacionesAtencion).toBe(
      'Tramo reemplazado y presión normal.',
    );
  });

  it('ID inexistente responde 404 con mensaje comprensible', async () => {
    const response = await getDetalle(999999, adminToken).expect(404);
    expect(response.body).toEqual({
      statusCode: 404,
      message: AVERIA_ADMIN_NOT_FOUND,
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /EntityNotFoundError|QueryFailedError|TypeORM|SQL Server/i,
    );
    expect(response.body).not.toHaveProperty('id');
    expect(response.body).not.toHaveProperty('codigoSeguimiento');
  });

  it('ID inválido responde 400 y no 404 ni 500', async () => {
    for (const id of ['abc', '0', '-1', '12.5']) {
      const response = await getDetalle(id, adminToken);
      expect(response.status).toBe(400);
      expect(response.status).not.toBe(404);
      expect(response.status).not.toBe(500);
      expect(response.body).toMatchObject({ statusCode: 400 });
      expect(response.body).not.toHaveProperty('codigoSeguimiento');
    }
  });

  it('sin token responde 401 y no devuelve la avería', async () => {
    const saved = await persist({ codigoSeguimiento: 'AV-DET-401' });
    const response = await getDetalle(saved.id).expect(401);
    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    expect(response.body).not.toHaveProperty('codigoSeguimiento');
  });

  it('Fontanero autenticado recibe 403 y no ve el detalle', async () => {
    const saved = await persist({
      codigoSeguimiento: 'AV-DET-403',
      idFontaneroAsignado: fontaneroId,
    });
    const response = await getDetalle(
      saved.id,
      signAs(Role.FONTANERO, '3'),
    ).expect(403);
    expect(response.body).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });
    expect(response.body).not.toHaveProperty('codigoSeguimiento');
    expect(response.body).not.toHaveProperty('fontanero');
  });

  it('no hay estados oficiales Asignada/En atención/Resuelta en EstadoAveria', () => {
    expect(Object.values(EstadoAveria)).toEqual([EstadoAveria.RECIBIDA]);
  });
});
