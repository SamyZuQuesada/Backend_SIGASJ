import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import {
  EstadoProyecto,
  isEstadoProyectoValido,
} from '../../common/enums/estado-proyecto.enum';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { ImagenProyecto } from './entities/imagen-proyecto.entity';
import { Proyecto } from './entities/proyecto.entity';
import { ProyectosModule } from './proyectos.module';

type AuthLoginBody = {
  accessToken: string;
};

const VALID_PAYLOAD = {
  nombre: 'Ampliación de Acueducto',
  descripcion: 'Ampliación de la red principal de la ASADA',
  encargadoRealizacion: 'Ing. María Rodríguez',
  duracion: '8 meses',
  estado: EstadoProyecto.EN_PROCESO,
  imagenPrincipal: 'https://ejemplo.com/tanque.jpg',
};

describe('POST /api/v1/admin/proyectos — validación', () => {
  let app: INestApplication<App>;
  let proyectos: Repository<Proyecto>;
  let accessToken: string;

  const auth = () => ({ Authorization: `Bearer ${accessToken}` });

  const postProyecto = (body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/v1/admin/proyectos')
      .set(auth())
      .send(body);

  const countProyectos = () => proyectos.count();

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

  it('Prueba 1 — proyecto válido responde 201 y persiste el registro', async () => {
    const before = new Date();
    const response = await postProyecto(VALID_PAYLOAD).expect(201);

    expect(response.body).toMatchObject({
      nombre: VALID_PAYLOAD.nombre,
      descripcion: VALID_PAYLOAD.descripcion,
      encargadoRealizacion: VALID_PAYLOAD.encargadoRealizacion,
      duracion: VALID_PAYLOAD.duracion,
      estado: EstadoProyecto.EN_PROCESO,
      imagenPrincipal: VALID_PAYLOAD.imagenPrincipal,
      activo: false,
    });
    const created = response.body as { id: number };
    expect(created.id).toEqual(expect.any(Number));
    expect(response.body).not.toHaveProperty('createdBy');
    expect(response.body).not.toHaveProperty('idUsuarioCreador');

    expect(await countProyectos()).toBe(1);
    const stored = await proyectos.findOneBy({ id: created.id });
    expect(stored).toBeDefined();
    expect(stored?.id).toBe(created.id);
    expect(stored?.nombre).toBe(VALID_PAYLOAD.nombre);
    expect(stored?.descripcion).toBe(VALID_PAYLOAD.descripcion);
    expect(stored?.encargadoRealizacion).toBe(
      VALID_PAYLOAD.encargadoRealizacion,
    );
    expect(stored?.duracion).toBe(VALID_PAYLOAD.duracion);
    expect(stored?.estado).toBe(EstadoProyecto.EN_PROCESO);
    expect(isEstadoProyectoValido(stored!.estado)).toBe(true);
    expect(stored?.imagenPrincipal).toBe(VALID_PAYLOAD.imagenPrincipal);
    expect(Boolean(stored?.activo)).toBe(false);
    expect(stored?.createdAt).toBeInstanceOf(Date);
    expect(stored?.updatedAt).toBeInstanceOf(Date);
    expect(stored!.createdAt.getTime()).toBeGreaterThanOrEqual(
      before.getTime() - 5_000,
    );
    expect(stored!.updatedAt.getTime()).toBeGreaterThanOrEqual(
      stored!.createdAt.getTime() - 1_000,
    );
    expect(stored).not.toHaveProperty('createdBy');
    expect(stored).not.toHaveProperty('usuarioId');
  });

  it('Prueba 2 — sin nombre responde 400 y no crea registro', async () => {
    const withoutNombre: Record<string, unknown> = { ...VALID_PAYLOAD };
    delete withoutNombre.nombre;

    const response = await postProyecto(withoutNombre).expect(400);

    expect((response.body as { message: string[] }).message).toEqual(
      expect.arrayContaining([expect.stringMatching(/nombre/i)]),
    );
    expect(await countProyectos()).toBe(0);

    await postProyecto({ ...VALID_PAYLOAD, nombre: '' }).expect(400);
    expect(await countProyectos()).toBe(0);
  });

  it('Prueba 3 — nombre con solo espacios se rechaza y no crea registro', async () => {
    await postProyecto({ ...VALID_PAYLOAD, nombre: '   ' }).expect(400);

    expect(await countProyectos()).toBe(0);
  });

  it('Prueba 4 — descripción inválida (no string) se rechaza y no crea registro', async () => {
    await postProyecto({
      ...VALID_PAYLOAD,
      descripcion: { texto: 'no es un string' },
    }).expect(400);

    expect(await countProyectos()).toBe(0);
  });

  it('Prueba 5 — encargado inválido se rechaza y no crea registro', async () => {
    await postProyecto({
      ...VALID_PAYLOAD,
      encargadoRealizacion: { idUsuario: 12 },
    }).expect(400);
    expect(await countProyectos()).toBe(0);

    await postProyecto({
      ...VALID_PAYLOAD,
      encargadoRealizacion: 'x'.repeat(151),
    }).expect(400);
    expect(await countProyectos()).toBe(0);
  });

  it('Prueba 6 — duración inválida se rechaza y no crea registro', async () => {
    await postProyecto({
      ...VALID_PAYLOAD,
      duracion: { dias: 90 },
    }).expect(400);
    expect(await countProyectos()).toBe(0);

    await postProyecto({
      ...VALID_PAYLOAD,
      duracion: 'x'.repeat(101),
    }).expect(400);
    expect(await countProyectos()).toBe(0);
  });

  it('Prueba 7 — estado fuera de 9.1.4 responde 400 y no inserta', async () => {
    const response = await postProyecto({
      ...VALID_PAYLOAD,
      estado: 'Inactivo',
    }).expect(400);

    expect((response.body as { message: string[] }).message).toEqual(
      expect.arrayContaining([
        'El estado debe ser PENDIENTE, EN_PROCESO o COMPLETADO',
      ]),
    );
    expect(await countProyectos()).toBe(0);
  });

  it('Prueba 8 — campos internos se rechazan y no controlan el alta', async () => {
    const response = await postProyecto({
      ...VALID_PAYLOAD,
      id: 99,
      idProyecto: 99,
      activo: true,
      createdBy: 'intruso',
      idUsuarioCreador: 'intruso',
      fechaCreacion: '2020-01-01T00:00:00.000Z',
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
    }).expect(400);

    expect((response.body as { message: string[] }).message).toEqual(
      expect.arrayContaining([expect.stringMatching(/should not exist/i)]),
    );
    expect(await countProyectos()).toBe(0);
  });
});
