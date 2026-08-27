import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { EstadoProyecto } from '../../common/enums/estado-proyecto.enum';
import { Role } from '../../common/enums/role.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { ImagenProyecto } from './entities/imagen-proyecto.entity';
import { Proyecto } from './entities/proyecto.entity';
import { ProyectosModule } from './proyectos.module';

type ListadoBody = {
  data: Array<{
    id: number;
    nombre: string;
    estado: EstadoProyecto;
    activo: boolean;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

const SEEDS: Array<
  Pick<Proyecto, 'nombre' | 'estado' | 'activo'> &
    Partial<Pick<Proyecto, 'descripcion'>>
> = [
  {
    nombre: 'Red de agua potable',
    estado: EstadoProyecto.PENDIENTE,
    activo: true,
    descripcion: 'Red principal',
  },
  {
    nombre: 'Ampliación de Acueducto Norte',
    estado: EstadoProyecto.EN_PROCESO,
    activo: false,
  },
  {
    nombre: 'Tanque de almacenamiento',
    estado: EstadoProyecto.COMPLETADO,
    activo: true,
  },
  {
    nombre: 'Mejora de acueducto rural',
    estado: EstadoProyecto.EN_PROCESO,
    activo: true,
  },
  {
    nombre: 'Planta de tratamiento',
    estado: EstadoProyecto.PENDIENTE,
    activo: false,
  },
  {
    nombre: 'Estudio de acueducto comunitario',
    estado: EstadoProyecto.PENDIENTE,
    activo: true,
  },
];

describe('GET /api/v1/admin/proyectos — listado administrativo', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let proyectos: Repository<Proyecto>;
  let adminToken: string;

  const signAs = (role: Role, sub = '1') => {
    const payload: JwtPayload = {
      sub,
      email: 'usuario@asadasanjuan.cr',
      role,
      name: 'Usuario',
    };
    return jwtService.sign(payload);
  };

  const getProyectos = (
    query: Record<string, string | number | boolean> = {},
    token?: string | null,
  ) => {
    const req = request(app.getHttpServer()).get('/api/v1/admin/proyectos');
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.query(query);
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
          entities: [Proyecto, ImagenProyecto],
          synchronize: true,
        }),
        AuthModule,
        ProyectosModule,
      ],
      providers: [
        {
          provide: APP_FILTER,
          useClass: HttpExceptionFilter,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    proyectos = moduleFixture.get(getRepositoryToken(Proyecto));

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@asadasanjuan.cr',
        password: 'Password123!',
      });

    expect(login.status).toBe(200);
    adminToken = (login.body as { accessToken: string }).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await proyectos.clear();
    for (const seed of SEEDS) {
      await proyectos.save(
        proyectos.create({
          descripcion: seed.descripcion ?? null,
          encargadoRealizacion: null,
          duracion: null,
          imagenPrincipal: null,
          ...seed,
        }),
      );
    }
  });

  it('Prueba 1 — sin filtros devuelve proyectos activos e inactivos', async () => {
    const response = await getProyectos({}, adminToken).expect(200);
    const body = response.body as ListadoBody;

    expect(body.total).toBe(SEEDS.length);
    expect(body.data).toHaveLength(SEEDS.length);
    expect(body.data.some((item) => item.activo)).toBe(true);
    expect(body.data.some((item) => !item.activo)).toBe(true);
    expect(body.data.map((item) => item.nombre).sort()).toEqual(
      SEEDS.map((seed) => seed.nombre).sort(),
    );
    expect(body.page).toBe(1);
    expect(body.limit).toBe(10);
    expect(body.totalPages).toBe(1);
  });

  it('Prueba 2 — busca por parte del nombre y solo devuelve coincidencias', async () => {
    const response = await getProyectos(
      { nombre: 'acueducto' },
      adminToken,
    ).expect(200);
    const body = response.body as ListadoBody;

    expect(body.total).toBe(3);
    expect(body.data).toHaveLength(3);
    expect(body.data.map((item) => item.nombre).sort()).toEqual([
      'Ampliación de Acueducto Norte',
      'Estudio de acueducto comunitario',
      'Mejora de acueducto rural',
    ]);
    expect(
      body.data.every((item) =>
        item.nombre.toLowerCase().includes('acueducto'),
      ),
    ).toBe(true);
  });

  it('Prueba 3 — filtra por un estado válido', async () => {
    const response = await getProyectos(
      { estado: EstadoProyecto.EN_PROCESO },
      adminToken,
    ).expect(200);
    const body = response.body as ListadoBody;

    expect(body.total).toBe(2);
    expect(body.data).toHaveLength(2);
    expect(
      body.data.every((item) => item.estado === EstadoProyecto.EN_PROCESO),
    ).toBe(true);
    expect(body.data.map((item) => item.nombre).sort()).toEqual([
      'Ampliación de Acueducto Norte',
      'Mejora de acueducto rural',
    ]);
  });

  it('Prueba 4 — estado inexistente responde 400', async () => {
    const response = await getProyectos(
      { estado: 'EN_EJECUCION' },
      adminToken,
    ).expect(400);

    expect(response.body).toMatchObject({
      statusCode: 400,
    });
    const message = (response.body as { message: string | string[] }).message;
    const serialized = Array.isArray(message) ? message.join(' ') : message;
    expect(serialized).toMatch(/PENDIENTE|EN_PROCESO|COMPLETADO|estado/i);
  });

  it('Prueba 5 — activo=true solo devuelve proyectos activos', async () => {
    const response = await getProyectos({ activo: 'true' }, adminToken).expect(
      200,
    );
    const body = response.body as ListadoBody;

    expect(body.total).toBe(4);
    expect(body.data).toHaveLength(4);
    expect(body.data.every((item) => item.activo === true)).toBe(true);
  });

  it('Prueba 6 — activo=false solo devuelve proyectos inactivos', async () => {
    const response = await getProyectos({ activo: 'false' }, adminToken).expect(
      200,
    );
    const body = response.body as ListadoBody;

    expect(body.total).toBe(2);
    expect(body.data).toHaveLength(2);
    expect(body.data.every((item) => item.activo === false)).toBe(true);
    expect(body.data.map((item) => item.nombre).sort()).toEqual([
      'Ampliación de Acueducto Norte',
      'Planta de tratamiento',
    ]);
  });

  it('Prueba 7 — nombre + estado exige ambas condiciones', async () => {
    const response = await getProyectos(
      { nombre: 'acueducto', estado: EstadoProyecto.EN_PROCESO },
      adminToken,
    ).expect(200);
    const body = response.body as ListadoBody;

    expect(body.total).toBe(2);
    expect(body.data).toHaveLength(2);
    expect(
      body.data.every(
        (item) =>
          item.nombre.toLowerCase().includes('acueducto') &&
          item.estado === EstadoProyecto.EN_PROCESO,
      ),
    ).toBe(true);
    expect(body.data.map((item) => item.nombre).sort()).toEqual([
      'Ampliación de Acueducto Norte',
      'Mejora de acueducto rural',
    ]);
  });

  it('Prueba 8 — estado + activo exige ambas condiciones', async () => {
    const response = await getProyectos(
      { estado: EstadoProyecto.EN_PROCESO, activo: 'true' },
      adminToken,
    ).expect(200);
    const body = response.body as ListadoBody;

    expect(body.total).toBe(1);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      nombre: 'Mejora de acueducto rural',
      estado: EstadoProyecto.EN_PROCESO,
      activo: true,
    });
  });

  it('Prueba 9 — nombre + estado + activo exige las tres condiciones', async () => {
    const response = await getProyectos(
      {
        nombre: 'acueducto',
        estado: EstadoProyecto.EN_PROCESO,
        activo: 'false',
      },
      adminToken,
    ).expect(200);
    const body = response.body as ListadoBody;

    expect(body.total).toBe(1);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      nombre: 'Ampliación de Acueducto Norte',
      estado: EstadoProyecto.EN_PROCESO,
      activo: false,
    });
  });

  it('Prueba 10 — filtros sin coincidencias responden 200 con lista vacía', async () => {
    const response = await getProyectos(
      {
        nombre: 'obra-inexistente-xyz',
        estado: EstadoProyecto.COMPLETADO,
        activo: 'true',
      },
      adminToken,
    ).expect(200);
    const body = response.body as ListadoBody;

    expect(body).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
  });

  it('Prueba 11 — page=1 y page=2 no repiten registros y la metadata es correcta', async () => {
    const page1 = (
      await getProyectos({ page: 1, limit: 2 }, adminToken).expect(200)
    ).body as ListadoBody;
    const page2 = (
      await getProyectos({ page: 2, limit: 2 }, adminToken).expect(200)
    ).body as ListadoBody;

    expect(page1).toMatchObject({
      total: SEEDS.length,
      page: 1,
      limit: 2,
      totalPages: 3,
    });
    expect(page2).toMatchObject({
      total: SEEDS.length,
      page: 2,
      limit: 2,
      totalPages: 3,
    });
    expect(page1.data).toHaveLength(2);
    expect(page2.data).toHaveLength(2);

    const idsPage1 = page1.data.map((item) => item.id);
    const idsPage2 = page2.data.map((item) => item.id);
    expect(new Set(idsPage1).size).toBe(2);
    expect(new Set(idsPage2).size).toBe(2);
    expect(idsPage1.some((id) => idsPage2.includes(id))).toBe(false);

    const union = new Set([...idsPage1, ...idsPage2]);
    expect(union.size).toBe(4);
  });

  it('Prueba 12 — page y limit inválidos se rechazan con 400', async () => {
    await getProyectos({ page: 0 }, adminToken).expect(400);
    await getProyectos({ page: -1 }, adminToken).expect(400);
    await getProyectos({ limit: 0 }, adminToken).expect(400);
    await getProyectos({ limit: -1 }, adminToken).expect(400);
    await getProyectos({ limit: 'abc' }, adminToken).expect(400);
  });

  it('Seguridad — Administradora con token válido recibe 200', async () => {
    await getProyectos({}, adminToken).expect(200);
  });

  it('Seguridad — sin token responde 401', async () => {
    const response = await getProyectos({}).expect(401);
    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
  });

  it('Seguridad — token inválido responde 401', async () => {
    const response = await getProyectos({}, 'token-invalido').expect(401);
    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
  });

  it('Seguridad — usuario autenticado sin permiso responde 403', async () => {
    const response = await getProyectos(
      {},
      signAs(Role.SECRETARIA, '2'),
    ).expect(403);
    expect(response.body).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });
  });
});
