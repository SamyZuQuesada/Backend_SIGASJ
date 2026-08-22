import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
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
  '/api/v1/admin/transparencia',
] as const;

const PERSONAL_ABONADO_ENDPOINTS = [
  '/api/v1/abonados/me',
  '/api/v1/abonados/mi-perfil',
] as const;

const looksLikePrivatePayload = (body: unknown) => {
  const serialized = JSON.stringify(body ?? '');
  return (
    serialized.includes('Listado base de usuarios') ||
    serialized.includes('informacion institucional') ||
    serialized.includes('accessToken') ||
    serialized.includes('demo-user-id')
  );
}

describe('autorización sin token (e2e)', () => {
  let app: INestApplication;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([...ADMIN_ENDPOINTS])(
    'sin Authorization, %s responde 401 y no devuelve datos privados',
    async (endpoint) => {
      const response = await request(app.getHttpServer()).get(endpoint);

      expect(response.status).toBe(401);
      expect(response.status).not.toBe(200);
      expect(looksLikePrivatePayload(response.body)).toBe(false);
    },
  );

  it.each([...PERSONAL_ABONADO_ENDPOINTS])(
    'sin Authorization, %s no responde 200 ni datos privados',
    async (endpoint) => {
      const response = await request(app.getHttpServer()).get(endpoint);

      expect(response.status).not.toBe(200);
      expect(looksLikePrivatePayload(response.body)).toBe(false);
      // Hoy no hay controlador personal: Nest responde 404.
      // Cuando exista, JwtAuthGuard debe devolver 401.
      expect([401, 404]).toContain(response.status);
    },
  );

  it.each([
    ['post', '/api/v1/admin/comunicados'],
    ['patch', '/api/v1/admin/comunicados/1'],
    ['patch', '/api/v1/admin/comunicados/1/estado'],
    ['delete', '/api/v1/admin/comunicados/1'],
    ['put', '/api/v1/admin/contacto'],
    ['post', '/api/v1/admin/galeria'],
    ['patch', '/api/v1/admin/galeria/1'],
    ['patch', '/api/v1/admin/galeria/1/estado'],
    ['post', '/api/v1/admin/transparencia'],
    ['patch', '/api/v1/admin/transparencia/1'],
    ['patch', '/api/v1/admin/transparencia/1/estado'],
    ['delete', '/api/v1/admin/transparencia/1'],
    ['delete', '/api/v1/admin/galeria/1'],
  ] as const)(
    'sin Authorization, %s %s responde 401',
    async (method, endpoint) => {
      const response = await request(app.getHttpServer())[method](endpoint);

      expect(response.status).toBe(401);
    },
  );

  it('mantiene públicas las consultas de landing', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/public/comunicados')
      .expect(200);
    await request(app.getHttpServer()).get('/api/v1/public/galeria').expect(200);
    await request(app.getHttpServer()).get('/api/v1/public/contacto').expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/public/transparencia')
      .expect(200);
  });
});
