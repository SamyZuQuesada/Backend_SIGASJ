/**
 * Validación HTTP del login: DTO inválido → 400 y AuthService NO se ejecuta.
 */
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('POST /api/v1/auth/login — validación antes de AuthService', () => {
  let app: INestApplication<App>;
  let authService: { login: jest.Mock };

  beforeAll(async () => {
    authService = {
      login: jest.fn().mockResolvedValue({
        accessToken: 'token-sintetico',
        user: {
          id: 1,
          email: 'usuario.test@example.com',
          role: 'ADMINISTRADORA',
          name: 'Test',
        },
      }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
      ],
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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    authService.login.mockClear();
  });

  const postLogin = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send(body);

  it('body vacío → 400; AuthService no llamado', async () => {
    const res = await postLogin({}).expect(400);
    expect(authService.login).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|Secret/i);
  });

  it('sin email → 400; AuthService no llamado', async () => {
    await postLogin({ password: 'Secret1!' }).expect(400);
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('sin password → 400; AuthService no llamado', async () => {
    await postLogin({ email: 'usuario.test@example.com' }).expect(400);
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('email inválido → 400; AuthService no llamado', async () => {
    await postLogin({
      email: 'usuario@',
      password: 'Secret1!',
    }).expect(400);
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('password vacía / solo espacios → 400; AuthService no llamado', async () => {
    await postLogin({
      email: 'usuario.test@example.com',
      password: '',
    }).expect(400);
    await postLogin({
      email: 'usuario.test@example.com',
      password: '      ',
    }).expect(400);
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('tipos incorrectos → 400; AuthService no llamado', async () => {
    await postLogin({ email: 123, password: 'Secret1!' }).expect(400);
    await postLogin({
      email: 'usuario.test@example.com',
      password: 123456,
    }).expect(400);
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('campos extra (rol/activo/passwordHash) → 400 forbidNonWhitelisted', async () => {
    await postLogin({
      email: 'usuario.test@example.com',
      password: 'Secret1!',
      rol: 'Administradora',
    }).expect(400);
    await postLogin({
      email: 'usuario.test@example.com',
      password: 'Secret1!',
      activo: true,
      passwordHash: 'x',
    }).expect(400);
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('payload válido → AuthService.login una vez; response sin hash', async () => {
    const res = await postLogin({
      email: '  usuario.test@example.com ',
      password: 'Secret1!',
    }).expect(200);

    expect(authService.login).toHaveBeenCalledTimes(1);
    const calls = authService.login.mock.calls as unknown as Array<
      [Record<string, unknown>]
    >;
    const arg = calls[0]?.[0] ?? {};
    expect(arg.email).toBe('usuario.test@example.com');
    expect(arg.password).toBe('Secret1!');
    expect(arg).not.toHaveProperty('rol');
    expect(arg).not.toHaveProperty('passwordHash');
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/i);
  });
});
