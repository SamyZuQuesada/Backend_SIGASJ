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

const PERSONAL_ABONADO_ENDPOINTS = [
  '/api/v1/abonados/me',
  '/api/v1/abonados/mi-perfil',
] as const;

const looksLikePrivatePayload = (body: unknown) => {
  const serialized = JSON.stringify(body ?? '');
  return (
    serialized.includes('Listado base de usuarios') ||
    serialized.includes('accessToken') ||
    serialized.includes('demo-user-id')
  );
};

describe('autorización con JWT vencido (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let expiredToken: string;
  let validToken: string;

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

    const payload = {
      sub: 'demo-user-id',
      email: 'admin@asadasanjuan.cr',
      role: Role.ADMINISTRADORA,
    };

    validToken = jwtService.sign(payload);
    expiredToken = jwtService.sign(payload, {
      expiresIn: 0,
    });

    const decoded = jwtService.decode(expiredToken) as { exp?: number } | null;
    const now = Math.floor(Date.now() / 1000);
    expect(decoded?.exp).toBeDefined();
    expect(Number(decoded?.exp)).toBeLessThanOrEqual(now);
  });

  afterAll(async () => {
    await app.close();
  });

  it('control: un token vigente sí accede a un endpoint administrativo', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/usuarios')
      .set('Authorization', `Bearer ${validToken}`);

    expect(response.status).toBe(200);
  });

  it.each([...ADMIN_ENDPOINTS])(
    'token vencido es rechazado con 401 en %s',
    async (endpoint) => {
      const response = await request(app.getHttpServer())
        .get(endpoint)
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.status).not.toBe(200);
      expect(looksLikePrivatePayload(response.body)).toBe(false);
    },
  );

  it.each([...PERSONAL_ABONADO_ENDPOINTS])(
    'token vencido no obtiene datos en endpoint personal %s',
    async (endpoint) => {
      const response = await request(app.getHttpServer())
        .get(endpoint)
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).not.toBe(200);
      expect(looksLikePrivatePayload(response.body)).toBe(false);
      expect([401, 404]).toContain(response.status);
    },
  );
});
