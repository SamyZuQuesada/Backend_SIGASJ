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
import { HorarioLaboralFontanero } from '../usuarios/entities/horario-laboral-fontanero.entity';
import { Rol } from '../usuarios/entities/rol.entity';
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
import type { AveriasFontaneroListado } from './averias.service';
import { Averia } from './entities/averia.entity';
import { ObservacionAveria } from './entities/observacion-averia.entity';

describe('GET /api/v1/fontanero/averias — listado del Fontanero', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let averias: Repository<Averia>;
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

  const persist = async (overrides: Partial<Averia> = {}) => {
    seq += 1;
    return averias.save(
      averias.create({
        codigoSeguimiento: overrides.codigoSeguimiento ?? `AV-FL-${seq}`,
        fechaReporte: new Date('2026-09-12T15:00:00.000Z'),
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
            ? new Date('2026-09-13T08:00:00.000Z')
            : overrides.fechaAsignacion,
        fechaInicioAtencion: overrides.fechaInicioAtencion ?? null,
      }),
    );
  };

  const getListado = (token?: string | null) => {
    const req = request(app.getHttpServer()).get('/api/v1/fontanero/averias');
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
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

    jwtService = moduleFixture.get(JwtService);
    const dataSource = moduleFixture.get(DataSource);
    averias = dataSource.getRepository(Averia);
    const usuarios = dataSource.getRepository(Usuario);
    const rolesMap = await seedRolesBase(dataSource.getRepository(Rol));
    fontaneroA = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero A',
      correo: 'fontanero.a.list@asadasanjuan.cr',
      role: Role.FONTANERO,
    });
    fontaneroB = await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'Fontanero B',
      correo: 'fontanero.b.list@asadasanjuan.cr',
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
  });

  it('lista solo las averías asignadas al Fontanero en estados operativos', async () => {
    const asignada = await persist({
      codigoSeguimiento: 'AV-FL-ASG',
      estado: EstadoAveria.ASIGNADA,
    });
    const pendiente = await persist({
      codigoSeguimiento: 'AV-FL-PEN',
      estado: EstadoAveria.PENDIENTE,
    });
    const enAtencion = await persist({
      codigoSeguimiento: 'AV-FL-ATT',
      estado: EstadoAveria.EN_ATENCION,
      fechaInicioAtencion: new Date('2026-09-13T09:10:00.000Z'),
    });
    await persist({
      codigoSeguimiento: 'AV-FL-RES',
      estado: EstadoAveria.RESUELTA,
    });
    await persist({
      codigoSeguimiento: 'AV-FL-B',
      estado: EstadoAveria.ASIGNADA,
      idFontaneroAsignado: fontaneroB.idUsuario,
    });

    const body = (await getListado(tokenA).expect(200))
      .body as AveriasFontaneroListado;
    expect(body.data.map((item) => item.codigoSeguimiento).sort()).toEqual([
      'AV-FL-ASG',
      'AV-FL-ATT',
      'AV-FL-PEN',
    ]);
    expect(body.data.find((item) => item.id === pendiente.id)?.estado).toBe(
      EstadoAveria.PENDIENTE,
    );
    expect(
      body.data.find((item) => item.id === asignada.id)?.fechaInicioAtencion,
    ).toBeNull();
    expect(
      body.data.find((item) => item.id === enAtencion.id)?.fechaInicioAtencion,
    ).toBeTruthy();
    expect(JSON.stringify(body)).not.toMatch(
      /idFontaneroAsignado|password|telefonoReportante/,
    );
  });

  it('devuelve lista vacía si no hay trabajo operativo', async () => {
    await persist({
      codigoSeguimiento: 'AV-FL-DONE',
      estado: EstadoAveria.RESUELTA,
    });
    const body = (await getListado(tokenA).expect(200))
      .body as AveriasFontaneroListado;
    expect(body.data).toEqual([]);
  });

  it('sin sesión → 401, otro rol → 403 y Fontanero B no ve las de A', async () => {
    await persist({ codigoSeguimiento: 'AV-FL-SEC' });
    await getListado().expect(401);
    await getListado(adminToken).expect(403);

    const body = (await getListado(tokenB).expect(200))
      .body as AveriasFontaneroListado;
    expect(body.data).toEqual([]);
  });
});
