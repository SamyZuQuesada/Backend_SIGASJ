/**
 * POST /api/v1/auth/login — endpoint público (sin sesión / JWT previo).
 * Datos sintéticos; sqljs aislado.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import authConfig from '../../config/auth.config';
import jwtConfig from '../../config/jwt.config';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  PASSWORD_PRUEBA,
  crearUsuarioPrueba,
  seedRolesBase,
} from '../usuarios/usuarios.test-helpers';
import { AuthModule } from './auth.module';

describe('POST /api/v1/auth/login — endpoint público', () => {
  jest.setTimeout(45_000);

  let app: INestApplication<App>;
  let usuarios: Repository<Usuario>;
  let rolesMap: Record<Role, Rol>;
  const suffix = `publogin.${Date.now()}`;

  const email = (tag: string) => `${tag}.${suffix}@test.sigasj.local`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig, authConfig],
        }),
        TypeOrmModule.forRoot({
          type: 'sqljs',
          autoSave: false,
          dropSchema: true,
          entities: [Usuario, Rol],
          synchronize: true,
        }),
        AuthModule,
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

    const dataSource = moduleFixture.get(DataSource);
    usuarios = dataSource.getRepository(Usuario);
    rolesMap = await seedRolesBase(dataSource.getRepository(Rol));

    await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'TEST_PUB_ADMIN',
      correo: email('admin'),
      role: Role.ADMINISTRADORA,
    });
    await crearUsuarioPrueba(usuarios, rolesMap, {
      nombre: 'TEST_PUB_INACTIVE',
      correo: email('inactive'),
      role: Role.FONTANERO,
      activo: false,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const postLogin = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send(body);

  it('ruta exacta bajo api/v1; no /api/api/auth/login', async () => {
    await request(app.getHttpServer())
      .post('/api/api/auth/login')
      .send({ email: email('admin'), password: PASSWORD_PRUEBA })
      .expect(404);

    const ok = await postLogin({
      email: email('admin'),
      password: PASSWORD_PRUEBA,
    }).expect(200);
    expect(ok.body).toHaveProperty('accessToken');
  });

  it('GET no autentica', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/login').expect(404);
  });

  it('funciona sin Authorization y sin cookie de sesión', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: email('admin'), password: PASSWORD_PRUEBA })
      .expect(200);

    const body = res.body as {
      accessToken: string;
      user: Record<string, unknown>;
    };
    expect(body.user).toEqual(
      expect.objectContaining({
        email: email('admin'),
        role: Role.ADMINISTRADORA,
      }),
    );
    expect(body).not.toHaveProperty('password');
    expect(body).not.toHaveProperty('passwordHash');
    expect(body.user).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(body)).not.toMatch(/\$2[aby]\$/);
  });

  it('DTO inválido → 400 (no 401)', async () => {
    await postLogin({}).expect(400);
    await postLogin({ email: email('admin') }).expect(400);
    await postLogin({ password: PASSWORD_PRUEBA }).expect(400);
  });

  it('password incorrecta y usuario inexistente → mismo 401 (anti-enumeración)', async () => {
    const wrong = await postLogin({
      email: email('admin'),
      password: 'WrongPass1!',
    }).expect(401);
    const missing = await postLogin({
      email: email('missing'),
      password: PASSWORD_PRUEBA,
    }).expect(401);
    expect(wrong.body).toEqual(missing.body);
    expect(JSON.stringify(wrong.body)).toMatch(/Credenciales inválidas/i);
    expect(JSON.stringify(wrong.body)).not.toMatch(/passwordHash|\$2[aby]\$/i);
  });

  it('usuario inactivo → 401 sin hash', async () => {
    const res = await postLogin({
      email: email('inactive'),
      password: PASSWORD_PRUEBA,
    }).expect(401);
    expect(JSON.stringify(res.body)).toMatch(/inactivo/i);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/i);
  });

  it('Authorization Bearer basura no bloquea el login público', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Authorization', 'Bearer token-invalido')
      .send({ email: email('admin'), password: PASSWORD_PRUEBA })
      .expect(200);
    const body = res.body as { accessToken: string };
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.accessToken).not.toBe('token-invalido');
    expect(body.accessToken).not.toBe('test-token');
  });
});
