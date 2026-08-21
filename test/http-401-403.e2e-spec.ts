import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { Role } from '../src/common/enums/role.enum';
import jwtConfig from '../src/config/jwt.config';
import { AuthModule } from '../src/modules/auth/auth.module';
import { ComunicadosModule } from '../src/modules/comunicados/comunicados.module';
import { ContenidoPublicoModule } from '../src/modules/contenido-publico/contenido-publico.module';
import { UsuariosModule } from '../src/modules/usuarios/usuarios.module';
import { AbonadosModule } from '../src/modules/abonados/abonados.module';

const PRIVATE_ADMIN_ENDPOINT = '/api/v1/usuarios';

const assertNoSensitiveLeak = (body: unknown) => {
  const serialized = JSON.stringify(body ?? '');
  expect(serialized).not.toMatch(/at\s+\w+\s+\(/);
  expect(serialized).not.toContain('\\n    at ');
  expect(serialized).not.toMatch(/\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/i);
  expect(serialized).not.toContain('JWT_SECRET');
  expect(serialized).not.toContain('super_secret_jwt');
  expect(serialized).not.toContain('password');
  expect(serialized).not.toContain('stack');
  expect(serialized).not.toContain('QueryFailedError');
  expect(serialized).not.toContain('ECONNREFUSED');
};

describe('revisión HTTP 401 vs 403 (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let administradoraToken: string;
  let abonadoToken: string;
  let expiredToken: string;

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
    jwtService = app.get(JwtService);

    administradoraToken = jwtService.sign({
      sub: 'admin-id',
      email: 'admin@asadasanjuan.cr',
      role: Role.ADMINISTRADORA,
    });
    abonadoToken = jwtService.sign({
      sub: 'abonado-id',
      email: 'abonado@asadasanjuan.cr',
      role: Role.ABONADO,
    });
    expiredToken = jwtService.sign(
      {
        sub: 'admin-id',
        email: 'admin@asadasanjuan.cr',
        role: Role.ADMINISTRADORA,
      },
      { expiresIn: 0 },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('401 — sin token en endpoint privado', async () => {
    const response = await request(app.getHttpServer()).get(PRIVATE_ADMIN_ENDPOINT);

    expect(response.status).toBe(401);
    expect(response.status).not.toBe(403);
    expect(response.status).not.toBe(200);
    assertNoSensitiveLeak(response.body);
  });

  it('401 — token inválido en endpoint privado', async () => {
    const response = await request(app.getHttpServer())
      .get(PRIVATE_ADMIN_ENDPOINT)
      .set('Authorization', 'Bearer not-a-jwt');

    expect(response.status).toBe(401);
    expect(response.status).not.toBe(403);
    assertNoSensitiveLeak(response.body);
  });

  it('401 — token vencido en endpoint privado', async () => {
    const response = await request(app.getHttpServer())
      .get(PRIVATE_ADMIN_ENDPOINT)
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
    expect(response.status).not.toBe(403);
    assertNoSensitiveLeak(response.body);
  });

  it('403 — Abonado autenticado en endpoint exclusivo de Administradora', async () => {
    const response = await request(app.getHttpServer())
      .get(PRIVATE_ADMIN_ENDPOINT)
      .set('Authorization', `Bearer ${abonadoToken}`);

    expect(response.status).toBe(403);
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(200);
    expect(JSON.stringify(response.body)).toMatch(/Acceso denegado/i);
    assertNoSensitiveLeak(response.body);
  });

  it('control — Administradora autenticada recibe 200, no 401 ni 403', async () => {
    const response = await request(app.getHttpServer())
      .get(PRIVATE_ADMIN_ENDPOINT)
      .set('Authorization', `Bearer ${administradoraToken}`);

    expect(response.status).toBe(200);
  });

  it('módulo Abonados sin controlador no convierte la ausencia en 401 ni 403', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/abonados')
      .set('Authorization', `Bearer ${abonadoToken}`);

    expect(response.status).toBe(404);
    expect(response.status).not.toBe(200);
    assertNoSensitiveLeak(response.body);
  });
});
