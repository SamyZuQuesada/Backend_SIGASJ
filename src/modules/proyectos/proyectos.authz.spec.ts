import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { EstadoProyecto } from '../../common/enums/estado-proyecto.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { ImagenProyecto } from './entities/imagen-proyecto.entity';
import { Proyecto } from './entities/proyecto.entity';
import { ProyectosModule } from './proyectos.module';

const VALID_PAYLOAD = {
  nombre: 'Ampliación de Acueducto',
  descripcion: 'Ampliación de la red principal de la ASADA',
  encargadoRealizacion: 'Ing. María Rodríguez',
  duracion: '8 meses',
  estado: EstadoProyecto.PENDIENTE,
  imagenPrincipal: 'https://ejemplo.com/tanque.jpg',
};

const assertSafeClientBody = (body: unknown) => {
  const serialized = JSON.stringify(body ?? '');
  expect(serialized).not.toMatch(/at\s+\w+\s+\(/);
  expect(serialized).not.toContain('\\n    at ');
  expect(serialized).not.toContain('stack');
  expect(serialized).not.toContain('QueryFailedError');
  expect(serialized).not.toContain('JWT_SECRET');
  expect(serialized).not.toContain('super_secret_jwt');
  expect(serialized).not.toContain('password');
  expect(serialized).not.toContain('Password123!');
  expect(serialized).not.toMatch(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\./);
  expect(serialized).not.toMatch(
    /\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/i,
  );
};

describe('POST/GET/PATCH /api/v1/admin/proyectos — autenticación y autorización', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let proyectos: Repository<Proyecto>;
  let imagenes: Repository<ImagenProyecto>;
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

  const postProyecto = (
    body: Record<string, unknown>,
    token?: string | null,
  ) => {
    const req = request(app.getHttpServer()).post('/api/v1/admin/proyectos');
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.send(body);
  };

  const patchProyecto = (
    id: string | number,
    body: Record<string, unknown>,
    token?: string | null,
  ) => {
    const req = request(app.getHttpServer()).patch(
      `/api/v1/admin/proyectos/${id}`,
    );
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.send(body);
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
    imagenes = moduleFixture.get(getRepositoryToken(ImagenProyecto));

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
    await imagenes.clear();
    await proyectos.clear();
  });

  it('Administradora con token válido y proyecto válido recibe 201', async () => {
    const response = await postProyecto(VALID_PAYLOAD, adminToken).expect(201);

    expect(response.body).toMatchObject({
      nombre: VALID_PAYLOAD.nombre,
      estado: EstadoProyecto.PENDIENTE,
      activo: false,
    });
    expect(response.body).not.toHaveProperty('createdBy');
    expect(response.body).not.toHaveProperty('idUsuarioCreador');
    expect(await proyectos.count()).toBe(1);
    assertSafeClientBody(response.body);
  });

  it('sin token responde 401 y no inserta', async () => {
    const response = await postProyecto(VALID_PAYLOAD).expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    expect(await proyectos.count()).toBe(0);
    assertSafeClientBody(response.body);
  });

  it('token inválido responde 401 y no inserta', async () => {
    const response = await postProyecto(VALID_PAYLOAD, 'token-invalido').expect(
      401,
    );

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    expect(await proyectos.count()).toBe(0);
    assertSafeClientBody(response.body);
  });

  it('token vencido responde 401 y no inserta', async () => {
    const expired = jwtService.sign(
      {
        sub: '1',
        email: 'admin@asadasanjuan.cr',
        role: Role.ADMINISTRADORA,
        name: 'Usuario',
      },
      { expiresIn: -1 },
    );

    const response = await postProyecto(VALID_PAYLOAD, expired).expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    expect(await proyectos.count()).toBe(0);
    assertSafeClientBody(response.body);
  });

  it('Secretaria autenticada recibe 403 y no inserta', async () => {
    const response = await postProyecto(
      VALID_PAYLOAD,
      signAs(Role.SECRETARIA, '2'),
    ).expect(403);

    expect(response.body).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });
    expect(await proyectos.count()).toBe(0);
    assertSafeClientBody(response.body);
  });

  it('Fontanero autenticado recibe 403 y no inserta', async () => {
    const response = await postProyecto(
      VALID_PAYLOAD,
      signAs(Role.FONTANERO, '3'),
    ).expect(403);

    expect(response.body).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });
    expect(await proyectos.count()).toBe(0);
    assertSafeClientBody(response.body);
  });

  it('identificador de creador en el body se rechaza y no se usa para actuar a nombre de otra persona', async () => {
    const response = await postProyecto(
      {
        ...VALID_PAYLOAD,
        createdBy: 'usuario-ajeno',
        idUsuarioCreador: 'usuario-ajeno',
        userId: 'usuario-ajeno',
        usuarioId: 99,
      },
      adminToken,
    ).expect(400);

    const errorBody = response.body as {
      statusCode: number;
      message: string | string[];
    };
    expect(errorBody.statusCode).toBe(400);
    expect(errorBody.message).toEqual(
      expect.arrayContaining([expect.stringMatching(/should not exist/i)]),
    );
    expect(await proyectos.count()).toBe(0);
    expect(JSON.stringify(response.body)).not.toContain('usuario-ajeno');
    assertSafeClientBody(response.body);
  });

  it('GET /api/v1/admin/proyectos sin resultados responde 200 con lista vacía', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/proyectos')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
  });

  it('GET /api/v1/admin/proyectos sin token responde 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/proyectos')
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    assertSafeClientBody(response.body);
  });

  it('GET /api/v1/admin/proyectos con token inválido responde 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/proyectos')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    assertSafeClientBody(response.body);
  });

  it('GET /api/v1/admin/proyectos con token vencido responde 401', async () => {
    const expired = jwtService.sign(
      {
        sub: '1',
        email: 'admin@asadasanjuan.cr',
        role: Role.ADMINISTRADORA,
        name: 'Usuario',
      },
      { expiresIn: -1 },
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/proyectos')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    assertSafeClientBody(response.body);
  });

  it('GET /api/v1/admin/proyectos con Secretaria responde 403', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/proyectos')
      .set('Authorization', `Bearer ${signAs(Role.SECRETARIA, '2')}`)
      .expect(403);

    expect(response.body).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });
    assertSafeClientBody(response.body);
  });

  it('GET /api/v1/admin/proyectos con Fontanero responde 403', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/proyectos')
      .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '3')}`)
      .expect(403);

    expect(response.body).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });
    assertSafeClientBody(response.body);
  });

  it('GET /api/v1/admin/proyectos con estado inválido responde 400', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/proyectos')
      .query({ estado: 'EN_EJECUCION' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });

  it('GET /api/v1/admin/proyectos/:id sin token responde 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/proyectos/1')
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    assertSafeClientBody(response.body);
  });

  it('GET /api/v1/admin/proyectos/:id con token inválido responde 401', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/proyectos/1')
      .set('Authorization', 'Bearer token-invalido')
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    assertSafeClientBody(response.body);
  });

  it('GET /api/v1/admin/proyectos/:id con token vencido responde 401', async () => {
    const expired = jwtService.sign(
      {
        sub: '1',
        email: 'admin@asadasanjuan.cr',
        role: Role.ADMINISTRADORA,
        name: 'Usuario',
      },
      { expiresIn: -1 },
    );

    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/proyectos/1')
      .set('Authorization', `Bearer ${expired}`)
      .expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    assertSafeClientBody(response.body);
  });

  it('GET /api/v1/admin/proyectos/:id con Secretaria responde 403', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/proyectos/1')
      .set('Authorization', `Bearer ${signAs(Role.SECRETARIA, '2')}`)
      .expect(403);

    expect(response.body).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });
    assertSafeClientBody(response.body);
  });

  it('GET /api/v1/admin/proyectos/:id con Fontanero responde 403', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/proyectos/1')
      .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '3')}`)
      .expect(403);

    expect(response.body).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });
    assertSafeClientBody(response.body);
  });

  it('GET /api/v1/admin/proyectos/abc rechaza el id inválido con 400', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/proyectos/abc')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    expect(response.body).toMatchObject({ statusCode: 400 });
    assertSafeClientBody(response.body);
  });

  it('GET /api/v1/admin/proyectos/:id con id numérico inexistente responde 404', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/admin/proyectos/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      message: 'Proyecto no encontrado',
    });
    assertSafeClientBody(response.body);
  });

  it('GET /api/v1/admin/proyectos/:id devuelve campos administrativos de un proyecto inactivo', async () => {
    const created = await postProyecto(VALID_PAYLOAD, adminToken).expect(201);
    const id = (created.body as { id: number }).id;

    const response = await request(app.getHttpServer())
      .get(`/api/v1/admin/proyectos/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id,
      nombre: VALID_PAYLOAD.nombre,
      descripcion: VALID_PAYLOAD.descripcion,
      encargadoRealizacion: VALID_PAYLOAD.encargadoRealizacion,
      duracion: VALID_PAYLOAD.duracion,
      estado: EstadoProyecto.PENDIENTE,
      imagenPrincipal: VALID_PAYLOAD.imagenPrincipal,
      activo: false,
      imagenes: [],
    });
    expect(response.body).toHaveProperty('createdAt');
    expect(response.body).toHaveProperty('updatedAt');
    assertSafeClientBody(response.body);
  });

  it('GET /api/v1/admin/proyectos/:id también devuelve un proyecto activo', async () => {
    const created = await postProyecto(VALID_PAYLOAD, adminToken).expect(201);
    const id = (created.body as { id: number }).id;
    await proyectos.update({ id }, { activo: true });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/admin/proyectos/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id,
      nombre: VALID_PAYLOAD.nombre,
      activo: true,
      imagenes: [],
    });
  });

  it('GET /api/v1/admin/proyectos/:id sin galería responde 200 con imagenes vacía', async () => {
    const created = await postProyecto(VALID_PAYLOAD, adminToken).expect(201);
    const id = (created.body as { id: number }).id;

    const response = await request(app.getHttpServer())
      .get(`/api/v1/admin/proyectos/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const body = response.body as { imagenes: unknown[] };
    expect(body.imagenes).toEqual([]);
  });

  it('GET /api/v1/admin/proyectos/:id incluye la galería ordenada por orden', async () => {
    const created = await postProyecto(VALID_PAYLOAD, adminToken).expect(201);
    const proyecto = await proyectos.findOneByOrFail({
      id: (created.body as { id: number }).id,
    });

    await imagenes.save([
      imagenes.create({
        url: 'https://ejemplo.com/segunda.jpg',
        descripcion: 'Segunda',
        orden: 2,
        proyecto,
      }),
      imagenes.create({
        url: 'https://ejemplo.com/primera.jpg',
        descripcion: 'Primera',
        orden: 1,
        proyecto,
      }),
    ]);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/admin/proyectos/${proyecto.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const body = response.body as {
      imagenes: Array<{
        id: number;
        url: string;
        descripcion: string | null;
        orden: number;
        createdAt: string;
      }>;
    };

    expect(body.imagenes).toHaveLength(2);
    expect(
      body.imagenes.map((img) => ({
        orden: img.orden,
        url: img.url,
      })),
    ).toEqual([
      { orden: 1, url: 'https://ejemplo.com/primera.jpg' },
      { orden: 2, url: 'https://ejemplo.com/segunda.jpg' },
    ]);
    expect(body.imagenes[0]).toMatchObject({
      url: 'https://ejemplo.com/primera.jpg',
      descripcion: 'Primera',
      orden: 1,
    });
    expect(Object.keys(body.imagenes[0]).sort()).toEqual(
      ['createdAt', 'descripcion', 'id', 'orden', 'url'].sort(),
    );
    expect(body.imagenes[0]).not.toHaveProperty('proyecto');
    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('createdBy');
    expect(JSON.stringify(response.body)).not.toContain('QueryFailedError');
    assertSafeClientBody(response.body);
  });

  it('PATCH /api/v1/admin/proyectos/:id sin token responde 401', async () => {
    const created = await postProyecto(VALID_PAYLOAD, adminToken).expect(201);
    const id = (created.body as { id: number }).id;

    const response = await patchProyecto(id, { nombre: 'Nuevo nombre' }).expect(
      401,
    );

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    const persisted = await proyectos.findOneByOrFail({ id });
    expect(persisted.nombre).toBe(VALID_PAYLOAD.nombre);
    assertSafeClientBody(response.body);
  });

  it('PATCH /api/v1/admin/proyectos/:id con token inválido responde 401', async () => {
    const created = await postProyecto(VALID_PAYLOAD, adminToken).expect(201);
    const id = (created.body as { id: number }).id;

    const response = await patchProyecto(
      id,
      { nombre: 'Nuevo nombre' },
      'token-invalido',
    ).expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    const persisted = await proyectos.findOneByOrFail({ id });
    expect(persisted.nombre).toBe(VALID_PAYLOAD.nombre);
    assertSafeClientBody(response.body);
  });

  it('PATCH /api/v1/admin/proyectos/:id con token vencido responde 401', async () => {
    const created = await postProyecto(VALID_PAYLOAD, adminToken).expect(201);
    const id = (created.body as { id: number }).id;
    const expired = jwtService.sign(
      {
        sub: '1',
        email: 'admin@asadasanjuan.cr',
        role: Role.ADMINISTRADORA,
        name: 'Usuario',
      },
      { expiresIn: -1 },
    );

    const response = await patchProyecto(
      id,
      { nombre: 'Nuevo nombre' },
      expired,
    ).expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    const persisted = await proyectos.findOneByOrFail({ id });
    expect(persisted.nombre).toBe(VALID_PAYLOAD.nombre);
    assertSafeClientBody(response.body);
  });

  it('PATCH /api/v1/admin/proyectos/:id con Secretaria responde 403', async () => {
    const created = await postProyecto(VALID_PAYLOAD, adminToken).expect(201);
    const id = (created.body as { id: number }).id;

    const response = await patchProyecto(
      id,
      { nombre: 'Nuevo nombre' },
      signAs(Role.SECRETARIA, '2'),
    ).expect(403);

    expect(response.body).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });
    const persisted = await proyectos.findOneByOrFail({ id });
    expect(persisted.nombre).toBe(VALID_PAYLOAD.nombre);
    assertSafeClientBody(response.body);
  });

  it('PATCH /api/v1/admin/proyectos/:id con Fontanero responde 403', async () => {
    const created = await postProyecto(VALID_PAYLOAD, adminToken).expect(201);
    const id = (created.body as { id: number }).id;

    const response = await patchProyecto(
      id,
      { nombre: 'Nuevo nombre' },
      signAs(Role.FONTANERO, '3'),
    ).expect(403);

    expect(response.body).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });
    const persisted = await proyectos.findOneByOrFail({ id });
    expect(persisted.nombre).toBe(VALID_PAYLOAD.nombre);
    assertSafeClientBody(response.body);
  });

  it('PATCH /api/v1/admin/proyectos/abc rechaza el id inválido con 400', async () => {
    const countBefore = await proyectos.count();
    const response = await patchProyecto(
      'abc',
      { nombre: 'Nuevo nombre' },
      adminToken,
    ).expect(400);

    expect(response.body).toMatchObject({ statusCode: 400 });
    expect(response.body).not.toMatchObject({
      message: 'Proyecto no encontrado',
    });
    expect(await proyectos.count()).toBe(countBefore);
    assertSafeClientBody(response.body);
  });

  it('PATCH /api/v1/admin/proyectos/:id con id numérico inexistente responde 404', async () => {
    const created = await postProyecto(VALID_PAYLOAD, adminToken).expect(201);
    const existingId = (created.body as { id: number }).id;
    const countBefore = await proyectos.count();

    const response = await patchProyecto(
      999999,
      { nombre: 'No debe persistir' },
      adminToken,
    ).expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      message: 'Proyecto no encontrado',
    });
    expect(await proyectos.count()).toBe(countBefore);
    const persisted = await proyectos.findOneByOrFail({ id: existingId });
    expect(persisted.nombre).toBe(VALID_PAYLOAD.nombre);
    expect(await proyectos.findOneBy({ id: 999999 })).toBeNull();
    assertSafeClientBody(response.body);
  });

  it('PATCH /api/v1/admin/proyectos/:id actualiza solo campos autorizados', async () => {
    const created = await postProyecto(VALID_PAYLOAD, adminToken).expect(201);
    const id = (created.body as { id: number }).id;
    const original = await proyectos.findOneByOrFail({ id });
    const createdAt = original.createdAt.getTime();
    const updatedAtBefore = original.updatedAt.getTime();

    await new Promise((resolve) => {
      setTimeout(resolve, 1100);
    });

    const response = await patchProyecto(
      id,
      { nombre: 'Nuevo nombre' },
      adminToken,
    ).expect(200);

    expect(response.body).toMatchObject({
      id,
      nombre: 'Nuevo nombre',
      descripcion: VALID_PAYLOAD.descripcion,
      encargadoRealizacion: VALID_PAYLOAD.encargadoRealizacion,
      duracion: VALID_PAYLOAD.duracion,
      estado: EstadoProyecto.PENDIENTE,
      imagenPrincipal: VALID_PAYLOAD.imagenPrincipal,
      activo: false,
    });
    const body = response.body as {
      createdAt: string;
      updatedAt: string;
    };
    expect(new Date(body.createdAt).getTime()).toBe(createdAt);
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThan(updatedAtBefore);
    expect(response.body).not.toHaveProperty('idUsuarioCreador');
    expect(response.body).not.toHaveProperty('idUsuarioModificador');
    expect(response.body).not.toHaveProperty('usuarioCreador');
    expect(response.body).not.toHaveProperty('usuarioModificador');
    assertSafeClientBody(response.body);

    const persisted = await proyectos.findOneByOrFail({ id });
    expect(persisted.nombre).toBe('Nuevo nombre');
    expect(persisted.estado).toBe(EstadoProyecto.PENDIENTE);
    expect(persisted.activo).toBe(false);
    expect(persisted.imagenPrincipal).toBe(VALID_PAYLOAD.imagenPrincipal);
    expect(persisted.createdAt.getTime()).toBe(createdAt);
    expect(persisted.updatedAt.getTime()).toBeGreaterThan(updatedAtBefore);
    expect(persisted).not.toHaveProperty('idUsuarioCreador');
    expect(persisted).not.toHaveProperty('idUsuarioModificador');
  });

  it('PATCH /api/v1/admin/proyectos/:id rechaza propiedades no autorizadas y no muta el registro', async () => {
    const created = await postProyecto(VALID_PAYLOAD, adminToken).expect(201);
    const id = (created.body as { id: number }).id;

    const response = await patchProyecto(
      id,
      {
        nombre: 'No debe persistir',
        estado: EstadoProyecto.COMPLETADO,
        activo: true,
        visible: true,
        publicado: true,
        imagenPrincipal: 'https://ejemplo.com/hack.jpg',
        imagenes: [{ url: 'https://ejemplo.com/galeria-hack.jpg' }],
        id: 999,
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
        fechaCreacion: '2020-01-01T00:00:00.000Z',
        fechaActualizacion: '2020-01-01T00:00:00.000Z',
        usuarioCreador: 'usuario-ajeno',
        usuarioModificador: 'usuario-ajeno',
        createdBy: 'usuario-ajeno',
      },
      adminToken,
    ).expect(400);

    const errorBody = response.body as {
      statusCode: number;
      message: string | string[];
    };
    expect(errorBody.statusCode).toBe(400);
    expect(errorBody.message).toEqual(
      expect.arrayContaining([expect.stringMatching(/should not exist/i)]),
    );
    assertSafeClientBody(response.body);

    const persisted = await proyectos.findOneByOrFail({ id });
    expect(persisted.nombre).toBe(VALID_PAYLOAD.nombre);
    expect(persisted.estado).toBe(EstadoProyecto.PENDIENTE);
    expect(persisted.activo).toBe(false);
    expect(persisted.imagenPrincipal).toBe(VALID_PAYLOAD.imagenPrincipal);
    expect(persisted.id).toBe(id);
  });
});
