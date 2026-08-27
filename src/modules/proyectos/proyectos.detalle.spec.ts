import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
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

type ImagenBody = {
  id: number;
  url: string;
  descripcion: string | null;
  orden: number;
  createdAt: string;
};

type DetalleBody = {
  id: number;
  nombre: string;
  descripcion: string | null;
  encargadoRealizacion: string | null;
  duracion: string | null;
  estado: EstadoProyecto;
  imagenPrincipal: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  imagenes: ImagenBody[];
};

const PAYLOAD = {
  nombre: 'Ampliación de Acueducto',
  descripcion: 'Ampliación de la red principal de la ASADA',
  encargadoRealizacion: 'Ing. María Rodríguez',
  duracion: '8 meses',
  estado: EstadoProyecto.EN_PROCESO,
  imagenPrincipal: 'https://ejemplo.com/tanque.jpg',
};

describe('GET /api/v1/admin/proyectos/:id — detalle administrativo', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let proyectos: Repository<Proyecto>;
  let imagenes: Repository<ImagenProyecto>;
  let adminToken: string;
  let errorLogs: jest.SpiedFunction<Logger['error']>;

  const auth = () => ({ Authorization: `Bearer ${adminToken}` });

  const postProyecto = (body: Record<string, unknown> = PAYLOAD) =>
    request(app.getHttpServer())
      .post('/api/v1/admin/proyectos')
      .set(auth())
      .send(body);

  const getDetalle = (id: number | string, token?: string | null) => {
    const req = request(app.getHttpServer()).get(
      `/api/v1/admin/proyectos/${id}`,
    );
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  };

  const signAs = (role: Role, sub = '2') => {
    const payload: JwtPayload = {
      sub,
      email: 'usuario@asadasanjuan.cr',
      role,
      name: 'Usuario',
    };
    return jwtService.sign(payload);
  };

  const assertNoSensitiveData = (body: unknown) => {
    const serialized = JSON.stringify(body ?? '');
    expect(serialized).not.toMatch(/password/i);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('JWT_SECRET');
    expect(serialized).not.toContain('refreshToken');
    expect(serialized).not.toMatch(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\./);
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('QueryFailedError');
    expect(serialized).not.toMatch(
      /\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/i,
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

    proyectos = moduleFixture.get(getRepositoryToken(Proyecto));
    imagenes = moduleFixture.get(getRepositoryToken(ImagenProyecto));
    jwtService = moduleFixture.get(JwtService);

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
    errorLogs = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    expect(errorLogs).not.toHaveBeenCalled();
    errorLogs.mockRestore();
  });

  it('Prueba 1 — proyecto existente con galería responde 200 con ficha completa', async () => {
    const created = await postProyecto().expect(201);
    const proyecto = await proyectos.findOneByOrFail({
      id: (created.body as { id: number }).id,
    });
    const otro = await proyectos.save(
      proyectos.create({
        nombre: 'Otro proyecto',
        estado: EstadoProyecto.PENDIENTE,
        activo: false,
      }),
    );

    await imagenes.save([
      imagenes.create({
        url: 'https://ejemplo.com/propia-2.jpg',
        descripcion: 'Galería propia 2',
        orden: 2,
        proyecto,
      }),
      imagenes.create({
        url: 'https://ejemplo.com/propia-1.jpg',
        descripcion: 'Galería propia 1',
        orden: 1,
        proyecto,
      }),
      imagenes.create({
        url: 'https://ejemplo.com/ajena.jpg',
        descripcion: 'No debe aparecer',
        orden: 1,
        proyecto: otro,
      }),
    ]);

    const response = await getDetalle(proyecto.id, adminToken).expect(200);
    const body = response.body as DetalleBody;

    expect(body).toMatchObject({
      id: proyecto.id,
      nombre: PAYLOAD.nombre,
      descripcion: PAYLOAD.descripcion,
      encargadoRealizacion: PAYLOAD.encargadoRealizacion,
      duracion: PAYLOAD.duracion,
      estado: EstadoProyecto.EN_PROCESO,
      imagenPrincipal: PAYLOAD.imagenPrincipal,
      activo: false,
    });
    expect(body.createdAt).toEqual(expect.any(String));
    expect(body.updatedAt).toEqual(expect.any(String));
    expect(body.imagenes).toHaveLength(2);
    expect(body.imagenes.map((img) => img.url)).toEqual([
      'https://ejemplo.com/propia-1.jpg',
      'https://ejemplo.com/propia-2.jpg',
    ]);
    expect(body.imagenes.some((img) => img.url.includes('ajena'))).toBe(false);
    expect(body.imagenes[0]).toMatchObject({
      id: expect.any(Number) as number,
      url: 'https://ejemplo.com/propia-1.jpg',
      descripcion: 'Galería propia 1',
      orden: 1,
      createdAt: expect.any(String) as string,
    });
  });

  it('Prueba 2 — proyecto sin galería responde 200 con imagenes vacía', async () => {
    const created = await postProyecto().expect(201);
    const id = (created.body as { id: number }).id;

    const response = await getDetalle(id, adminToken).expect(200);
    const body = response.body as DetalleBody;

    expect(body.id).toBe(id);
    expect(body.nombre).toBe(PAYLOAD.nombre);
    expect(body.imagenes).toEqual([]);
    expect(response.status).not.toBe(404);
    expect(response.status).not.toBe(500);
  });

  it('Prueba 3 — proyecto inactivo es consultable por Administradora', async () => {
    const created = await postProyecto().expect(201);
    const id = (created.body as { id: number }).id;
    expect((created.body as { activo: boolean }).activo).toBe(false);

    const response = await getDetalle(id, adminToken).expect(200);
    const body = response.body as DetalleBody;

    expect(body).toMatchObject({
      id,
      nombre: PAYLOAD.nombre,
      activo: false,
    });
  });

  it('Prueba 1 — ID válido existente con Administradora responde 200', async () => {
    const created = await postProyecto().expect(201);
    const id = (created.body as { id: number }).id;

    const response = await getDetalle(id, adminToken).expect(200);
    expect((response.body as DetalleBody).id).toBe(id);
    assertNoSensitiveData(response.body);
  });

  it('Prueba 2 — ID válido inexistente responde 404', async () => {
    const response = await getDetalle(999999, adminToken).expect(404);
    expect(response.body).toMatchObject({
      statusCode: 404,
      message: 'Proyecto no encontrado',
    });
    assertNoSensitiveData(response.body);
  });

  it('Prueba 3 — ID inválido abc responde 400', async () => {
    const response = await getDetalle('abc', adminToken).expect(400);
    expect(response.body).toMatchObject({ statusCode: 400 });
    assertNoSensitiveData(response.body);
  });

  it('Prueba 4 — sin token responde 401', async () => {
    const response = await getDetalle(1).expect(401);
    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    assertNoSensitiveData(response.body);
  });

  it('Prueba 5 — token inválido responde 401', async () => {
    const response = await getDetalle(1, 'token-invalido').expect(401);
    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    assertNoSensitiveData(response.body);
  });

  it('Prueba 6 — rol no autorizado responde 403', async () => {
    const response = await getDetalle(1, signAs(Role.SECRETARIA)).expect(403);
    expect(response.body).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });
    assertNoSensitiveData(response.body);
  });

  it('Prueba 7 — proyecto inactivo con Administradora responde 200', async () => {
    const created = await postProyecto().expect(201);
    const id = (created.body as { id: number }).id;
    await proyectos.update({ id }, { activo: false });

    const response = await getDetalle(id, adminToken).expect(200);
    expect(response.body).toMatchObject({ id, activo: false });
    assertNoSensitiveData(response.body);
  });

  it('Prueba 8 — la respuesta no expone secretos ni datos internos', async () => {
    const created = await postProyecto().expect(201);
    const proyecto = await proyectos.findOneByOrFail({
      id: (created.body as { id: number }).id,
    });
    await imagenes.save(
      imagenes.create({
        url: 'https://ejemplo.com/foto.jpg',
        descripcion: 'Galería',
        orden: 1,
        proyecto,
      }),
    );

    const response = await getDetalle(proyecto.id, adminToken).expect(200);
    const body = response.body as DetalleBody;

    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('passwordHash');
    expect(body).not.toHaveProperty('refreshToken');
    expect(body).not.toHaveProperty('createdBy');
    expect(body.imagenes[0]).not.toHaveProperty('proyecto');
    assertNoSensitiveData(body);
  });
});
