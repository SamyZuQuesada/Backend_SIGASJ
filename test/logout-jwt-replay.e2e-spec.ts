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

/**
 * Arquitectura real: JWT stateless. No hay POST /auth/logout ni lista de revocación.
 * Cerrar sesión en el cliente descarta el token en localStorage; el Backend sigue
 * aceptando el mismo JWT mientras no expire.
 */
const ADMIN_ENDPOINT = '/api/v1/usuarios';

describe('JWT tras cierre de sesión en cliente (e2e, sin invalidación server-side)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('no existe endpoint de logout que invalide el JWT', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/auth/logout');

    expect(response.status).toBe(404);
  });

  it('Administradora: token conservado tras “logout” de cliente sigue autorizado hasta exp', async () => {
    const token = jwtService.sign({
      sub: 'admin-id',
      email: 'admin@asadasanjuan.cr',
      role: Role.ADMINISTRADORA,
    });

    const beforeLogout = await request(app.getHttpServer())
      .get(ADMIN_ENDPOINT)
      .set('Authorization', `Bearer ${token}`);

    expect(beforeLogout.status).toBe(200);

    // Simula cierre de sesión en el cliente: el token se deja de enviar.
    const withoutToken = await request(app.getHttpServer()).get(ADMIN_ENDPOINT);
    expect(withoutToken.status).toBe(401);

    // El mismo JWT, si se reutiliza, sigue siendo válido. No hay revocación.
    const replay = await request(app.getHttpServer())
      .get(ADMIN_ENDPOINT)
      .set('Authorization', `Bearer ${token}`);

    expect(replay.status).toBe(200);
    expect(replay.status).not.toBe(401);
  });

  it('Abonado: el JWT reutilizado sigue siendo un token válido; el rol sigue denegado (403, no 401)', async () => {
    const token = jwtService.sign({
      sub: 'abonado-id',
      email: 'abonado@asadasanjuan.cr',
      role: Role.ABONADO,
    });

    const first = await request(app.getHttpServer())
      .get(ADMIN_ENDPOINT)
      .set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(403);

    const withoutToken = await request(app.getHttpServer()).get(ADMIN_ENDPOINT);
    expect(withoutToken.status).toBe(401);

    const replay = await request(app.getHttpServer())
      .get(ADMIN_ENDPOINT)
      .set('Authorization', `Bearer ${token}`);
    expect(replay.status).toBe(403);
    expect(replay.status).not.toBe(401);
  });
});
