import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import jwtConfig from '../src/config/jwt.config';
import { AuthModule } from '../src/modules/auth/auth.module';
import { ComunicadosModule } from '../src/modules/comunicados/comunicados.module';
import { ContenidoPublicoModule } from '../src/modules/contenido-publico/contenido-publico.module';
import { UsuariosModule } from '../src/modules/usuarios/usuarios.module';
import { AbonadosModule } from '../src/modules/abonados/abonados.module';

const ADMIN_ENDPOINTS = [
  '/api/v1/usuarios',
  '/api/v1/admin/informacion',
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
});
