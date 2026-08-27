import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { EstadoProyecto } from '../../common/enums/estado-proyecto.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { ImagenProyecto } from './entities/imagen-proyecto.entity';
import { Proyecto } from './entities/proyecto.entity';
import { ProyectosModule } from './proyectos.module';

type AuthLoginBody = {
  accessToken: string;
};

const ORIGINAL = {
  nombre: 'Ampliación de Acueducto',
  descripcion: 'Ampliación de la red principal de la ASADA',
  encargadoRealizacion: 'Ing. María Rodríguez',
  duracion: '8 meses',
  estado: EstadoProyecto.EN_PROCESO,
  imagenPrincipal: 'https://ejemplo.com/tanque.jpg',
};

describe('PATCH /api/v1/admin/proyectos/:id — actualización parcial', () => {
  let app: INestApplication<App>;
  let proyectos: Repository<Proyecto>;
  let accessToken: string;

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  const postProyecto = (body: Record<string, unknown> = ORIGINAL) =>
    request(app.getHttpServer())
      .post('/api/v1/admin/proyectos')
      .set(auth())
      .send(body);

  const patchProyecto = (id: number, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .patch(`/api/v1/admin/proyectos/${id}`)
      .set(auth())
      .send(body);

  const crearProyecto = async () => {
    const created = await postProyecto().expect(201);
    const id = (created.body as { id: number }).id;
    const original = await proyectos.findOneByOrFail({ id });
    return { id, original };
  };

  const expectRegistroIgual = async (id: number, original: Proyecto) => {
    const persisted = await proyectos.findOneByOrFail({ id });
    expect(persisted.nombre).toBe(original.nombre);
    expect(persisted.descripcion).toBe(original.descripcion);
    expect(persisted.encargadoRealizacion).toBe(original.encargadoRealizacion);
    expect(persisted.duracion).toBe(original.duracion);
    expect(persisted.estado).toBe(original.estado);
    expect(persisted.activo).toBe(original.activo);
    expect(persisted.imagenPrincipal).toBe(original.imagenPrincipal);
    expect(persisted.id).toBe(original.id);
    expect(persisted.createdAt.getTime()).toBe(original.createdAt.getTime());
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

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@asadasanjuan.cr',
        password: 'Password123!',
      });

    expect(login.status).toBe(200);
    accessToken = (login.body as AuthLoginBody).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await proyectos.clear();
  });

  it('Prueba 1 — cambiar solamente el nombre deja el resto intacto', async () => {
    const { id, original } = await crearProyecto();

    const response = await patchProyecto(id, {
      nombre: 'Nombre actualizado',
    }).expect(200);

    expect(response.body).toMatchObject({
      id,
      nombre: 'Nombre actualizado',
      descripcion: ORIGINAL.descripcion,
      encargadoRealizacion: ORIGINAL.encargadoRealizacion,
      duracion: ORIGINAL.duracion,
      estado: ORIGINAL.estado,
      imagenPrincipal: ORIGINAL.imagenPrincipal,
      activo: false,
    });

    const persisted = await proyectos.findOneByOrFail({ id });
    expect(persisted.nombre).toBe('Nombre actualizado');
    expect(persisted.descripcion).toBe(original.descripcion);
    expect(persisted.encargadoRealizacion).toBe(original.encargadoRealizacion);
    expect(persisted.duracion).toBe(original.duracion);
    expect(persisted.estado).toBe(original.estado);
    expect(persisted.activo).toBe(original.activo);
    expect(persisted.imagenPrincipal).toBe(original.imagenPrincipal);
  });

  it('Prueba 2 — cambiar solamente la descripción deja el resto intacto', async () => {
    const { id, original } = await crearProyecto();

    const response = await patchProyecto(id, {
      descripcion: 'Nueva descripción del proyecto',
    }).expect(200);

    expect(response.body).toMatchObject({
      id,
      nombre: ORIGINAL.nombre,
      descripcion: 'Nueva descripción del proyecto',
      encargadoRealizacion: ORIGINAL.encargadoRealizacion,
      duracion: ORIGINAL.duracion,
    });

    const persisted = await proyectos.findOneByOrFail({ id });
    expect(persisted.descripcion).toBe('Nueva descripción del proyecto');
    expect(persisted.nombre).toBe(original.nombre);
    expect(persisted.encargadoRealizacion).toBe(original.encargadoRealizacion);
    expect(persisted.duracion).toBe(original.duracion);
    expect(persisted.estado).toBe(original.estado);
    expect(persisted.imagenPrincipal).toBe(original.imagenPrincipal);
  });

  it('Prueba 3 — cambiar solamente el encargado persiste el valor', async () => {
    const { id, original } = await crearProyecto();

    const response = await patchProyecto(id, {
      encargadoRealizacion: 'Ing. Carlos Méndez',
    }).expect(200);

    expect(response.body).toMatchObject({
      id,
      nombre: ORIGINAL.nombre,
      descripcion: ORIGINAL.descripcion,
      encargadoRealizacion: 'Ing. Carlos Méndez',
      duracion: ORIGINAL.duracion,
    });

    const persisted = await proyectos.findOneByOrFail({ id });
    expect(persisted.encargadoRealizacion).toBe('Ing. Carlos Méndez');
    expect(persisted.nombre).toBe(original.nombre);
    expect(persisted.descripcion).toBe(original.descripcion);
    expect(persisted.duracion).toBe(original.duracion);
  });

  it('Prueba 4 — cambiar solamente la duración persiste el valor', async () => {
    const { id, original } = await crearProyecto();

    const response = await patchProyecto(id, {
      duracion: '12 meses',
    }).expect(200);

    expect(response.body).toMatchObject({
      id,
      nombre: ORIGINAL.nombre,
      descripcion: ORIGINAL.descripcion,
      encargadoRealizacion: ORIGINAL.encargadoRealizacion,
      duracion: '12 meses',
    });

    const persisted = await proyectos.findOneByOrFail({ id });
    expect(persisted.duracion).toBe('12 meses');
    expect(persisted.nombre).toBe(original.nombre);
    expect(persisted.descripcion).toBe(original.descripcion);
    expect(persisted.encargadoRealizacion).toBe(original.encargadoRealizacion);
  });

  it('Prueba 5 — actualiza nombre, descripción, encargado y duración juntos', async () => {
    const { id, original } = await crearProyecto();

    const response = await patchProyecto(id, {
      nombre: 'Tanque de almacenamiento',
      descripcion: 'Capacidad de 500 m3',
      encargadoRealizacion: 'Ing. Ana Soto',
      duracion: '10 meses',
    }).expect(200);

    expect(response.body).toMatchObject({
      id,
      nombre: 'Tanque de almacenamiento',
      descripcion: 'Capacidad de 500 m3',
      encargadoRealizacion: 'Ing. Ana Soto',
      duracion: '10 meses',
      estado: original.estado,
      imagenPrincipal: original.imagenPrincipal,
      activo: false,
    });

    const persisted = await proyectos.findOneByOrFail({ id });
    expect(persisted.nombre).toBe('Tanque de almacenamiento');
    expect(persisted.descripcion).toBe('Capacidad de 500 m3');
    expect(persisted.encargadoRealizacion).toBe('Ing. Ana Soto');
    expect(persisted.duracion).toBe('10 meses');
    expect(persisted.estado).toBe(original.estado);
    expect(persisted.activo).toBe(original.activo);
    expect(persisted.imagenPrincipal).toBe(original.imagenPrincipal);
  });

  it('Prueba 6 — nombre vacío o solo espacios responde 400 y no guarda cambios', async () => {
    const { id, original } = await crearProyecto();

    const vacio = await patchProyecto(id, {
      nombre: '',
      descripcion: 'No debe persistir',
    }).expect(400);
    expect((vacio.body as { statusCode: number }).statusCode).toBe(400);
    await expectRegistroIgual(id, original);

    const espacios = await patchProyecto(id, {
      nombre: '   ',
      duracion: '99 meses',
    }).expect(400);
    expect((espacios.body as { statusCode: number }).statusCode).toBe(400);
    await expectRegistroIgual(id, original);
  });

  it('Prueba 7 — duración inválida responde 400 y no altera el registro', async () => {
    const { id, original } = await crearProyecto();

    const noTexto = await patchProyecto(id, {
      duracion: { meses: 8 },
      nombre: 'Tampoco debe persistir',
    }).expect(400);
    expect((noTexto.body as { statusCode: number }).statusCode).toBe(400);
    await expectRegistroIgual(id, original);

    const demasiadoLarga = await patchProyecto(id, {
      duracion: 'x'.repeat(101),
    }).expect(400);
    expect((demasiadoLarga.body as { statusCode: number }).statusCode).toBe(
      400,
    );
    await expectRegistroIgual(id, original);
  });

  it('Prueba 8 — campos no autorizados responden 400 y no se modifican', async () => {
    const { id, original } = await crearProyecto();

    const response = await patchProyecto(id, {
      nombre: 'No debe persistir',
      estado: EstadoProyecto.COMPLETADO,
      activo: true,
      id: 999,
      fechaCreacion: '2020-01-01T00:00:00.000Z',
      createdAt: '2020-01-01T00:00:00.000Z',
      imagenPrincipal: 'https://ejemplo.com/hack.jpg',
      usuarioCreador: 'usuario-ajeno',
      idUsuarioCreador: 'usuario-ajeno',
    }).expect(400);

    const errorBody = response.body as {
      statusCode: number;
      message: string | string[];
    };
    expect(errorBody.statusCode).toBe(400);
    expect(errorBody.message).toEqual(
      expect.arrayContaining([expect.stringMatching(/should not exist/i)]),
    );
    await expectRegistroIgual(id, original);
  });
});
