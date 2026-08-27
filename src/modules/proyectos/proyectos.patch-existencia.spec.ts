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

const PAYLOAD = {
  nombre: 'Ampliación de Acueducto',
  descripcion: 'Ampliación de la red principal de la ASADA',
  encargadoRealizacion: 'Ing. María Rodríguez',
  duracion: '8 meses',
  estado: EstadoProyecto.EN_PROCESO,
  imagenPrincipal: 'https://ejemplo.com/tanque.jpg',
};

describe('PATCH /api/v1/admin/proyectos/:id — existencia, autorización y persistencia', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let proyectos: Repository<Proyecto>;
  let adminToken: string;

  const auth = () => ({ Authorization: `Bearer ${adminToken}` });

  const postProyecto = () =>
    request(app.getHttpServer())
      .post('/api/v1/admin/proyectos')
      .set(auth())
      .send(PAYLOAD);

  const patchProyecto = (
    id: number | string,
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

  const signAs = (role: Role, sub = '2') => {
    const payload: JwtPayload = {
      sub,
      email: 'usuario@asadasanjuan.cr',
      role,
      name: 'Usuario',
    };
    return jwtService.sign(payload);
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
    await proyectos.clear();
  });

  it('Prueba 1 — proyecto existente con Administradora responde 200 y persiste', async () => {
    const created = await postProyecto().expect(201);
    const id = (created.body as { id: number }).id;
    const original = await proyectos.findOneByOrFail({ id });

    await new Promise((resolve) => {
      setTimeout(resolve, 1100);
    });

    const response = await patchProyecto(
      id,
      { nombre: 'Nombre actualizado' },
      adminToken,
    ).expect(200);

    expect(response.body).toMatchObject({
      id,
      nombre: 'Nombre actualizado',
      descripcion: PAYLOAD.descripcion,
      encargadoRealizacion: PAYLOAD.encargadoRealizacion,
      duracion: PAYLOAD.duracion,
      estado: EstadoProyecto.EN_PROCESO,
      activo: false,
      imagenPrincipal: PAYLOAD.imagenPrincipal,
    });

    const persisted = await proyectos.findOneByOrFail({ id });
    expect(persisted.nombre).toBe('Nombre actualizado');
    expect(persisted.descripcion).toBe(original.descripcion);
    expect(persisted.encargadoRealizacion).toBe(original.encargadoRealizacion);
    expect(persisted.duracion).toBe(original.duracion);
    expect(persisted.estado).toBe(original.estado);
    expect(persisted.activo).toBe(original.activo);
    expect(persisted.imagenPrincipal).toBe(original.imagenPrincipal);
    expect(persisted.createdAt.getTime()).toBe(original.createdAt.getTime());
    expect(persisted.updatedAt.getTime()).toBeGreaterThan(
      original.updatedAt.getTime(),
    );
  });

  it('Prueba 2 — ID válido inexistente responde 404', async () => {
    const response = await patchProyecto(
      999999,
      { nombre: 'Nombre actualizado' },
      adminToken,
    ).expect(404);

    expect(response.body).toMatchObject({
      statusCode: 404,
      message: 'Proyecto no encontrado',
    });
    expect(await proyectos.findOneBy({ id: 999999 })).toBeNull();
  });

  it('Prueba 3 — ID inválido responde 400', async () => {
    const created = await postProyecto().expect(201);
    const id = (created.body as { id: number }).id;
    const original = await proyectos.findOneByOrFail({ id });

    const response = await patchProyecto(
      'abc',
      { nombre: 'Nombre actualizado' },
      adminToken,
    ).expect(400);

    expect(response.body).toMatchObject({ statusCode: 400 });
    const persisted = await proyectos.findOneByOrFail({ id });
    expect(persisted.nombre).toBe(original.nombre);
  });

  it('Prueba 4 — sin token responde 401', async () => {
    const created = await postProyecto().expect(201);
    const id = (created.body as { id: number }).id;

    const response = await patchProyecto(id, {
      nombre: 'Nombre actualizado',
    }).expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    const persisted = await proyectos.findOneByOrFail({ id });
    expect(persisted.nombre).toBe(PAYLOAD.nombre);
  });

  it('Prueba 5 — token inválido responde 401', async () => {
    const created = await postProyecto().expect(201);
    const id = (created.body as { id: number }).id;

    const response = await patchProyecto(
      id,
      { nombre: 'Nombre actualizado' },
      'token-invalido',
    ).expect(401);

    expect(response.body).toMatchObject({
      statusCode: 401,
      message: 'No autenticado',
    });
    const persisted = await proyectos.findOneByOrFail({ id });
    expect(persisted.nombre).toBe(PAYLOAD.nombre);
  });

  it('Prueba 6 — rol no autorizado responde 403', async () => {
    const created = await postProyecto().expect(201);
    const id = (created.body as { id: number }).id;

    const secretaria = await patchProyecto(
      id,
      { nombre: 'Nombre actualizado' },
      signAs(Role.SECRETARIA, '2'),
    ).expect(403);
    expect(secretaria.body).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });

    const fontanero = await patchProyecto(
      id,
      { nombre: 'Nombre actualizado' },
      signAs(Role.FONTANERO, '3'),
    ).expect(403);
    expect(fontanero.body).toMatchObject({
      statusCode: 403,
      message: 'Acceso denegado',
    });

    const persisted = await proyectos.findOneByOrFail({ id });
    expect(persisted.nombre).toBe(PAYLOAD.nombre);
    expect(persisted.estado).toBe(PAYLOAD.estado);
    expect(persisted.activo).toBe(false);
  });
});
