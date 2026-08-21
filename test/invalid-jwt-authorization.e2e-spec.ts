import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Role } from '../src/common/enums/role.enum';
import jwtConfig from '../src/config/jwt.config';
import { e2eTypeOrmModule } from './helpers/e2e-typeorm.module';
import { AuthModule } from '../src/modules/auth/auth.module';
import { ComunicadosModule } from '../src/modules/comunicados/comunicados.module';
import { ContenidoPublicoModule } from '../src/modules/contenido-publico/contenido-publico.module';
import { UsuariosModule } from '../src/modules/usuarios/usuarios.module';
import { AbonadosModule } from '../src/modules/abonados/abonados.module';

const ADMIN_ENDPOINTS = [
  '/api/v1/usuarios',
  '/api/v1/admin/informacion',
] as const;

const ABONADOS_ENDPOINTS = [
  '/api/v1/abonados',
  '/api/v1/abonados/me',
] as const;

const looksLikePrivatePayload = (body: unknown) => {
  const serialized = JSON.stringify(body ?? '');
  return (
    serialized.includes('Listado base de usuarios') ||
    serialized.includes('accessToken') ||
    serialized.includes('demo-user-id')
  );
};

const assertRejectedUnauthorized = (response: { status: number; body: unknown }) => {
  expect(response.status).toBe(401);
  expect(response.status).not.toBe(200);
  expect(looksLikePrivatePayload(response.body)).toBe(false);
};

describe('autorización con JWT inválido (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig],
        }),
        e2eTypeOrmModule,
        AuthModule,
        UsuariosModule,
        ContenidoPublicoModule,
        ComunicadosModule,
        AbonadosModule,
      ],
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
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  const requestWithBearer = (path: string, token: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`);

  const validShapeInvalidSignature = () => {
    const signed = jwtService.sign({
      sub: 'demo-user-id',
      email: 'admin@asadasanjuan.cr',
      role: Role.ADMINISTRADORA,
      name: 'Usuario Administrador',
    });
    const parts = signed.split('.');
    const last = parts[2] ?? 'sig';
    const flipped = last.endsWith('a') ? `${last.slice(0, -1)}b` : `${last.slice(0, -1)}a`;
    return `${parts[0]}.${parts[1]}.${flipped}`;
  };

  it.each([...ADMIN_ENDPOINTS])(
    'token malformado es rechazado en %s',
    async (endpoint) => {
      const response = await requestWithBearer(endpoint, 'not-a-jwt');
      assertRejectedUnauthorized(response);
    },
  );

  it.each([...ADMIN_ENDPOINTS])(
    'firma alterada es rechazada en %s',
    async (endpoint) => {
      const response = await requestWithBearer(
        endpoint,
        validShapeInvalidSignature(),
      );
      assertRejectedUnauthorized(response);
    },
  );

  it.each([...ADMIN_ENDPOINTS])(
    'token firmado con secreto incorrecto es rechazado en %s',
    async (endpoint) => {
      const forged = jwtService.sign(
        {
          sub: 'demo-user-id',
          email: 'admin@asadasanjuan.cr',
          role: Role.ADMINISTRADORA,
        },
        { secret: 'otro-secreto-no-configurado' },
      );
      const response = await requestWithBearer(endpoint, forged);
      assertRejectedUnauthorized(response);
    },
  );

  it.each([...ADMIN_ENDPOINTS])(
    'token expirado es rechazado en %s',
    async (endpoint) => {
      const expired = jwtService.sign(
        {
          sub: 'demo-user-id',
          email: 'admin@asadasanjuan.cr',
          role: Role.ADMINISTRADORA,
        },
        { expiresIn: -30 },
      );
      const response = await requestWithBearer(endpoint, expired);
      assertRejectedUnauthorized(response);
    },
  );

  it.each([...ABONADOS_ENDPOINTS])(
    'JWT inválido no obtiene datos en %s',
    async (endpoint) => {
      const response = await requestWithBearer(endpoint, 'not-a-jwt');
      expect(response.status).not.toBe(200);
      expect(looksLikePrivatePayload(response.body)).toBe(false);
      // Sin controlador de abonados Nest responde 404 antes del guard.
      expect([401, 404]).toContain(response.status);
    },
  );
});
