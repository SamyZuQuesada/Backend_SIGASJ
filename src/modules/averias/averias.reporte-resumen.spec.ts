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
  seedRolesBase,
  seedStaffLoginUsers,
} from '../usuarios/usuarios.test-helpers';
import { AveriasModule } from './averias.module';
import {
  AVERIAS_TEST_ENTITIES,
  vaciarNotificacionesAveriaPrueba,
} from './averias.test-entities';
import { Averia } from './entities/averia.entity';
import {
  buildAveriasReporteResumen,
  type AveriasReporteResumen,
} from './averias.service';

describe('buildAveriasReporteResumen', () => {
  it('suma los estados vigentes y deja fuera de catálogo en otros', () => {
    const resumen = buildAveriasReporteResumen(
      [
        { estado: EstadoAveria.RECIBIDA, cantidad: 3 },
        { estado: EstadoAveria.ASIGNADA, cantidad: '5' },
        { estado: EstadoAveria.PENDIENTE, cantidad: 4 },
        { estado: EstadoAveria.EN_ATENCION, cantidad: 6 },
        { estado: EstadoAveria.RESUELTA, cantidad: 24 },
        { estado: 'REPORTADA', cantidad: 2 },
        { estado: 'EN_PROCESO', cantidad: 1 },
      ],
      { fechaDesde: '2026-08-01', fechaHasta: '2026-08-31' },
    );

    expect(resumen.porEstado.RECIBIDA).toBe(3);
    expect(resumen.porEstado.ASIGNADA).toBe(5);
    expect(resumen.porEstado.PENDIENTE).toBe(4);
    expect(resumen.porEstado.EN_ATENCION).toBe(6);
    expect(resumen.porEstado.RESUELTA).toBe(24);
    expect(resumen.otros).toBe(3);
    expect(resumen.total).toBe(45);
    expect(resumen.total).toBe(
      Object.values(resumen.porEstado).reduce((sum, value) => sum + value, 0) +
        resumen.otros,
    );
    expect(JSON.stringify(resumen.porEstado)).not.toMatch(
      /REPORTADA|EN_PROCESO|En proceso/,
    );
  });
});

describe('GET /api/v1/admin/averias/reportes/resumen', () => {
  jest.setTimeout(30_000);
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let averias: Repository<Averia>;
  let adminToken: string;
  let secretariaToken: string;

  const signAs = (role: Role) => {
    const payload: JwtPayload = {
      sub: '9',
      email: 'usuario@asadasanjuan.cr',
      role,
      name: 'Usuario',
    };
    return jwtService.sign(payload);
  };

  const getResumen = (
    query: Record<string, string> = {},
    token?: string | null,
  ) => {
    const req = request(app.getHttpServer()).get(
      '/api/v1/admin/averias/reportes/resumen',
    );
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.query(query);
  };

  const persist = async (
    estado: string,
    fechaReporte: string,
    codigo: string,
  ) => {
    await averias.save(
      averias.create({
        codigoSeguimiento: codigo,
        fechaReporte: new Date(fechaReporte),
        nombreReportante: 'María Rodríguez',
        telefonoReportante: '8888-8888',
        ubicacion: '200 m este de la escuela',
        sectorComunidad: 'San Juan',
        descripcion: 'Fuga visible',
        estado: estado as EstadoAveria,
        identificacionReportante: '1-2345-6789',
        correoReportante: 'reportante@example.com',
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
    const rolesMap = await seedRolesBase(dataSource.getRepository(Rol));
    await seedStaffLoginUsers(dataSource.getRepository(Usuario), rolesMap);

    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@asadasanjuan.cr', password: 'Password123!' });
    adminToken = (adminLogin.body as { accessToken: string }).accessToken;

    const secretariaLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'secretaria@asadasanjuan.cr',
        password: 'Password123!',
      });
    secretariaToken = (secretariaLogin.body as { accessToken: string })
      .accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await vaciarNotificacionesAveriaPrueba(averias.manager.connection);
    await averias.clear();
    const agosto: Array<[string, string, string]> = [
      [EstadoAveria.RECIBIDA, '2026-08-10T15:00:00.000Z', 'AV-2026-0001'],
      [EstadoAveria.ASIGNADA, '2026-08-11T15:00:00.000Z', 'AV-2026-0002'],
      [EstadoAveria.PENDIENTE, '2026-08-12T15:00:00.000Z', 'AV-2026-0003'],
      [EstadoAveria.EN_ATENCION, '2026-08-13T15:00:00.000Z', 'AV-2026-0004'],
      [EstadoAveria.RESUELTA, '2026-08-14T15:00:00.000Z', 'AV-2026-0005'],
      [EstadoAveria.CANCELADA, '2026-08-15T15:00:00.000Z', 'AV-2026-0006'],
      [EstadoAveria.EN_REVISION, '2026-08-16T15:00:00.000Z', 'AV-2026-0007'],
      [EstadoAveria.RECIBIDA, '2026-08-31T23:30:00.000Z', 'AV-2026-0031'],
      [EstadoAveria.RECIBIDA, '2026-07-20T12:00:00.000Z', 'AV-2026-0701'],
      [EstadoAveria.RESUELTA, '2026-09-01T00:00:00.000Z', 'AV-2026-0901'],
    ];
    for (const [estado, fecha, codigo] of agosto) {
      await persist(estado, fecha, codigo);
    }
  });

  const sumaEstados = (body: AveriasReporteResumen) =>
    Object.values(body.porEstado).reduce((sum, value) => sum + value, 0) +
    body.otros;

  it('Administradora recibe los conteos del rango y el total coincide', async () => {
    const body = (
      await getResumen(
        { fechaDesde: '2026-08-01', fechaHasta: '2026-08-31' },
        adminToken,
      ).expect(200)
    ).body as AveriasReporteResumen;

    expect(body.fechaDesde).toBe('2026-08-01');
    expect(body.fechaHasta).toBe('2026-08-31');
    expect(body.porEstado).toMatchObject({
      RECIBIDA: 2,
      ASIGNADA: 1,
      PENDIENTE: 1,
      EN_ATENCION: 1,
      RESUELTA: 1,
      CANCELADA: 1,
      EN_REVISION: 1,
    });
    expect(body.total).toBe(8);
    expect(body.total).toBe(sumaEstados(body));
    expect(JSON.stringify(body)).not.toMatch(/EN_PROCESO|Reportada|En proceso/);
    expect(JSON.stringify(body)).not.toMatch(
      /telefonoReportante|correoReportante/,
    );
  });

  it('Secretaria consulta el resumen y sin fechas incluye todo el historial', async () => {
    const body = (await getResumen({}, secretariaToken).expect(200))
      .body as AveriasReporteResumen;
    expect(body.total).toBe(10);
    expect(body.fechaDesde).toBeNull();
    expect(body.fechaHasta).toBeNull();
    expect(body.total).toBe(sumaEstados(body));
  });

  it('un periodo sin averías responde 200 con ceros', async () => {
    const body = (
      await getResumen(
        { fechaDesde: '2026-01-01', fechaHasta: '2026-01-31' },
        adminToken,
      ).expect(200)
    ).body as AveriasReporteResumen;
    expect(body.total).toBe(0);
    expect(Object.values(body.porEstado).every((value) => value === 0)).toBe(
      true,
    );
  });

  it('sin token responde 401 y Fontanero responde 403', async () => {
    await getResumen({}).expect(401);
    const forbidden = await getResumen({}, signAs(Role.FONTANERO)).expect(403);
    expect(forbidden.body).not.toHaveProperty('total');
  });

  it('rechaza un rango inválido con 400', async () => {
    const cases = [
      { fechaDesde: '2026-08-31', fechaHasta: '2026-08-01' },
      { fechaDesde: '2026-02-30' },
      { fechaHasta: '31/08/2026' },
    ];
    for (const query of cases) {
      const response = await getResumen(query, adminToken);
      expect(response.status).toBe(400);
      expect(response.body).not.toHaveProperty('total');
    }
  });
});
