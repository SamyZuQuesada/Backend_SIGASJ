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

const ADMIN_ENDPOINT = '/api/v1/usuarios';

const assertSafeClientBody = (body: unknown) => {
  const serialized = JSON.stringify(body ?? '');
  expect(serialized).not.toMatch(/at\s+\w+\s+\(/);
  expect(serialized).not.toContain('\\n    at ');
  expect(serialized).not.toContain('stack');
  expect(serialized).not.toContain('QueryFailedError');
  expect(serialized).not.toContain('JWT_SECRET');
  expect(serialized).not.toContain('super_secret_jwt');
  expect(serialized).not.toContain('password');
  expect(serialized).not.toMatch(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\./);
  expect(serialized).not.toMatch(/\bSELECT\b|\bINSERT\b/i);
};

describe('revisión técnica de errores — Backend (e2e)', () => {
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

  it('401/403/404 no exponen stack, SQL, secretos ni JWT al cliente', async () => {
    const abonadoToken = jwtService.sign({
      sub: 'abonado-id',
      email: 'abonado@asadasanjuan.cr',
      role: Role.ABONADO,
    });
    const expired = jwtService.sign(
      {
        sub: 'admin-id',
        email: 'admin@asadasanjuan.cr',
        role: Role.ADMINISTRADORA,
      },
      { expiresIn: 0 },
    );

    const cases = [
      await request(app.getHttpServer()).get(ADMIN_ENDPOINT),
      await request(app.getHttpServer())
        .get(ADMIN_ENDPOINT)
        .set('Authorization', 'Bearer not-a-jwt'),
      await request(app.getHttpServer())
        .get(ADMIN_ENDPOINT)
        .set('Authorization', `Bearer ${expired}`),
      await request(app.getHttpServer())
        .get(ADMIN_ENDPOINT)
        .set('Authorization', `Bearer ${abonadoToken}`),
      await request(app.getHttpServer())
        .get('/api/v1/abonados/me')
        .set('Authorization', `Bearer ${abonadoToken}`),
    ];

    expect(cases.map((item) => item.status)).toEqual([401, 401, 401, 403, 403]);

    for (const response of cases) {
      assertSafeClientBody(response.body);
    }
  });

  it('login no devuelve la contraseña ni imprime el secreto JWT en el cuerpo', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@asadasanjuan.cr',
        password: 'Password123!',
      });

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty('password');
    expect(JSON.stringify(response.body)).not.toContain('Password123!');
    expect(JSON.stringify(response.body)).not.toContain('JWT_SECRET');
    expect(JSON.stringify(response.body)).not.toContain('super_secret_jwt');
    expect(typeof response.body.accessToken).toBe('string');
  });
});
