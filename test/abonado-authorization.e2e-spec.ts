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
  '/api/v1/admin/contacto',
  '/api/v1/admin/comunicados',
  '/api/v1/admin/transparencia',
] as const;


describe('autorización Abonado (e2e)', () => {
  let app: INestApplication;
  let abonadoToken: string;

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

    const jwtService = app.get(JwtService);
    abonadoToken = jwtService.sign({
      sub: 'abonado-user-id',
      email: 'abonado@asadasanjuan.cr',
      role: Role.ABONADO,
      name: 'Usuario Abonado',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('el login demo no emite token de Abonado', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'abonado@asadasanjuan.cr',
        password: 'Password123!',
      });

    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe(Role.ADMINISTRADORA);
    expect(login.body.user.role).not.toBe(Role.ABONADO);
  });

  it.each([...ADMIN_ENDPOINTS])(
    'token de Abonado no usa el endpoint administrativo %s',
    async (endpoint) => {
      const response = await request(app.getHttpServer())
        .get(endpoint)
        .set('Authorization', `Bearer ${abonadoToken}`);

      expect(response.status).toBe(403);
      expect(response.status).not.toBe(200);
      expect(response.body.message).toMatch(/Acceso denegado/i);
    },
  );

  it('GET /abonados/me no devuelve datos si el Abonado no tiene registro asociado', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/abonados/me')
      .set('Authorization', `Bearer ${abonadoToken}`);

    expect([403, 404]).toContain(response.status);
    expect(response.status).not.toBe(200);
  });

  it('GET /abonados/mi-perfil no es una ruta válida', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/abonados/mi-perfil')
      .set('Authorization', `Bearer ${abonadoToken}`);

    expect([400, 404]).toContain(response.status);
    expect(response.status).not.toBe(200);
  });

  it('GET /me no existe', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${abonadoToken}`);

    expect(response.status).toBe(404);
    expect(response.status).not.toBe(200);
  });
});
