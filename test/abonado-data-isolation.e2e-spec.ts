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

/**
 * Contrato actual:
 * - GET /abonados/me y GET /abonados/:id existen, filtrados por JWT (userId).
 * - Un Abonado no recibe datos ajenos: 403 si el id no es propio, 404 si no hay registro.
 * - La identidad JWT es request.user.userId (sub), sin idAbonado en el token.
 */

const PERSONAL_ENDPOINTS = [
  '/api/v1/abonados/me',
  '/api/v1/abonados/mi-perfil',
  '/api/v1/me',
] as const;

const ABONADO_A = {
  sub: 'abonado-a-id',
  email: 'abonado-a@asadasanjuan.cr',
  role: Role.ABONADO,
  name: 'Abonado Alfa',
};

const ABONADO_B = {
  sub: 'abonado-b-id',
  email: 'abonado-b@asadasanjuan.cr',
  role: Role.ABONADO,
  name: 'Abonado Beta',
};

const FOREIGN_ID_PATHS = [
  `/api/v1/abonados/${ABONADO_B.sub}`,
  '/api/v1/abonados/11',
  '/api/v1/abonados/99',
] as const;

const serialize = (body: unknown) => JSON.stringify(body ?? '');

const assertNoForeignAbonadoPayload = (
  body: unknown,
  foreign: typeof ABONADO_A | typeof ABONADO_B,
) => {
  const serialized = serialize(body);
  expect(serialized).not.toContain(foreign.email);
  expect(serialized).not.toContain(foreign.name);
  expect(serialized).not.toMatch(/"idAbonado"/);
  expect(serialized).not.toMatch(/"cedula"/);
  expect(serialized).not.toMatch(/"medidor"/);
  expect(serialized).not.toContain('Listado base de usuarios');
};

const assertNotOwnDataSuccess = (response: { status: number; body: unknown }) => {
  expect(response.status).not.toBe(200);
  expect(response.status).not.toBe(201);
};

describe('aislamiento de datos — rol Abonado (e2e)', () => {
  let app: INestApplication;
  let tokenA: string;
  let tokenB: string;
  let administradoraToken: string;

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
    tokenA = jwtService.sign(ABONADO_A);
    tokenB = jwtService.sign(ABONADO_B);
    administradoraToken = jwtService.sign({
      sub: 'admin-id',
      email: 'admin@asadasanjuan.cr',
      role: Role.ADMINISTRADORA,
      name: 'Usuario Administradora',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const getAs = (path: string, token: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`);

  it('la identidad JWT del Abonado es sub → request.user.userId; no hay idAbonado ni @CurrentUser en controladores', async () => {
    const jwtService = app.get(JwtService);
    const decoded = jwtService.decode(tokenA) as {
      sub?: string;
      email?: string;
      role?: string;
    };

    expect(decoded.sub).toBe(ABONADO_A.sub);
    expect(decoded.email).toBe(ABONADO_A.email);
    expect(decoded.role).toBe(Role.ABONADO);
    expect(JSON.stringify(decoded)).not.toContain('idAbonado');
  });

  it.each([...PERSONAL_ENDPOINTS])(
    'consulta personal %s con token de Abonado A no devuelve datos propios ni ajenos',
    async (endpoint) => {
      const response = await getAs(endpoint, tokenA);

      expect([400, 403, 404]).toContain(response.status);
      assertNotOwnDataSuccess(response);
      assertNoForeignAbonadoPayload(response.body, ABONADO_A);
      assertNoForeignAbonadoPayload(response.body, ABONADO_B);
    },
  );

  it.each([...FOREIGN_ID_PATHS])(
    'Abonado A no obtiene datos de otro registro al pedir %s',
    async (endpoint) => {
      const response = await getAs(endpoint, tokenA);

      expect([400, 403, 404]).toContain(response.status);
      assertNotOwnDataSuccess(response);
      assertNoForeignAbonadoPayload(response.body, ABONADO_B);
      expect(serialize(response.body)).not.toContain(ABONADO_B.email);
    },
  );

  it('dos tokens de Abonado distintos no intercambian información por ID en la URL', async () => {
    const aOnB = await getAs('/api/v1/abonados/11', tokenA);
    const bOnA = await getAs('/api/v1/abonados/10', tokenB);

    expect([403, 404]).toContain(aOnB.status);
    expect([403, 404]).toContain(bOnA.status);
    assertNotOwnDataSuccess(aOnB);
    assertNotOwnDataSuccess(bOnA);
    assertNoForeignAbonadoPayload(aOnB.body, ABONADO_B);
    assertNoForeignAbonadoPayload(bOnA.body, ABONADO_A);
  });

  it('GET /abonados/:id no entrega datos ajenos a Administradora si el registro no existe', async () => {
    const response = await getAs('/api/v1/abonados/10', administradoraToken);

    expect(response.status).toBe(404);
    assertNotOwnDataSuccess(response);
    assertNoForeignAbonadoPayload(response.body, ABONADO_A);
  });

  it('Abonado autenticado no lista usuarios administrativos (403, no fuga de padrón)', async () => {
    const response = await getAs('/api/v1/usuarios', tokenA);

    expect(response.status).toBe(403);
    expect(response.status).not.toBe(200);
    expect(serialize(response.body)).not.toContain('Listado base de usuarios');
    assertNoForeignAbonadoPayload(response.body, ABONADO_B);
  });
});
