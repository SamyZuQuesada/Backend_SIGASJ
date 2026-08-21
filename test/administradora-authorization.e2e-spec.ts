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

type AuthLoginBody = {
  accessToken: string;
  user: { id: string; email: string; role: string; name?: string };
};

const ADMIN_ENDPOINTS = [
  '/api/v1/usuarios',
  '/api/v1/admin/informacion',
  '/api/v1/admin/contacto',
  '/api/v1/admin/comunicados',
] as const;

describe('autorización Administradora (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

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

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@asadasanjuan.cr',
        password: 'Password123!',
      });

    expect(login.status).toBe(200);
    const body = login.body as AuthLoginBody;
    expect(body.accessToken).toBeTruthy();
    expect(body.user.role).toBe('ADMINISTRADORA');
    accessToken = body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([...ADMIN_ENDPOINTS])(
    'token de Administradora accede a %s sin 401 ni 403',
    async (endpoint) => {
      const response = await request(app.getHttpServer())
        .get(endpoint)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(403);
    },
  );

  it('módulo Abonados no expone endpoints administrativos (404, no 401/403)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/abonados')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(404);
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });
});
