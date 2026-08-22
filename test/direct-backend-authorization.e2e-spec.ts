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
 * Prueba directa HTTP (supertest). No usa React, Router ni menú.
 *
 * Códigos esperados = contrato actual del backend:
 * - Rutas con JwtAuthGuard: 200 / 403 / 401 según rol y token.
 * - GET /abonados/me: Abonado 403/404 si no hay registro; Administradora 403; sin token 401.
 * - GET /abonados (listado) no existe: 404.
 * - GET /abonados/:id: autenticado 403/404; sin token 401.
 */
type Actor =
  | 'Administradora'
  | 'Abonado'
  | 'sin token'
  | 'token inválido'
  | 'token vencido';

type MatrixRow = {
  endpoint: string;
  method: 'GET';
  role: Actor;
  expected: number;
  kind: 'administrativo' | 'personal' | 'abonados-sin-ruta';
};

const ADMIN_ENDPOINTS = [
  '/api/v1/usuarios',
  '/api/v1/admin/informacion',
  '/api/v1/admin/contacto',
  '/api/v1/admin/comunicados',
  '/api/v1/admin/transparencia',
] as const;

const PERSONAL_ENDPOINTS = ['/api/v1/abonados/me'] as const;

const MISSING_ABONADOS_ENDPOINTS = ['/api/v1/abonados'] as const;

const ABONADO_BY_ID_ENDPOINTS = ['/api/v1/abonados/11'] as const;

const ACTORS: Actor[] = [
  'Administradora',
  'Abonado',
  'sin token',
  'token inválido',
  'token vencido',
];

const expectedForAdmin = (role: Actor): number => {
  if (role === 'Administradora') {
    return 200;
  }
  if (role === 'Abonado') {
    return 403;
  }
  return 401;
};

const expectedForPersonal = (role: Actor): number => {
  if (role === 'Administradora') {
    return 403;
  }
  if (role === 'Abonado') {
    return 403;
  }
  return 401;
};

const expectedForAbonadoById = (role: Actor): number => {
  if (role === 'Administradora') {
    return 404;
  }
  if (role === 'Abonado') {
    return 403;
  }
  return 401;
};

const MATRIX: MatrixRow[] = [
  ...ADMIN_ENDPOINTS.flatMap((endpoint) =>
    ACTORS.map((role) => ({
      endpoint,
      method: 'GET' as const,
      role,
      expected: expectedForAdmin(role),
      kind: 'administrativo' as const,
    })),
  ),
  ...PERSONAL_ENDPOINTS.flatMap((endpoint) =>
    ACTORS.map((role) => ({
      endpoint,
      method: 'GET' as const,
      role,
      expected: expectedForPersonal(role),
      kind: 'personal' as const,
    })),
  ),
  ...MISSING_ABONADOS_ENDPOINTS.flatMap((endpoint) =>
    ACTORS.map((role) => ({
      endpoint,
      method: 'GET' as const,
      role,
      expected: 404,
      kind: 'abonados-sin-ruta' as const,
    })),
  ),
  ...ABONADO_BY_ID_ENDPOINTS.flatMap((endpoint) =>
    ACTORS.map((role) => ({
      endpoint,
      method: 'GET' as const,
      role,
      expected: expectedForAbonadoById(role),
      kind: 'personal' as const,
    })),
  ),
];

describe('autorización directa del Backend (sin Frontend)', () => {
  let app: INestApplication;
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
    administradoraToken = jwtService.sign({
      sub: 'admin-id',
      email: 'admin@asadasanjuan.cr',
      role: Role.ADMINISTRADORA,
      name: 'Usuario Administradora',
    });
    abonadoToken = jwtService.sign({
      sub: 'abonado-id',
      email: 'abonado@asadasanjuan.cr',
      role: Role.ABONADO,
      name: 'Usuario Abonado',
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

  const tokenFor = (role: Actor): string | null => {
    if (role === 'Administradora') {
      return administradoraToken;
    }
    if (role === 'Abonado') {
      return abonadoToken;
    }
    if (role === 'token inválido') {
      return 'not-a-jwt';
    }
    if (role === 'token vencido') {
      return expiredToken;
    }
    return null;
  };

  it('matriz HTTP: cada solicitud la autoriza el Backend, no la UI', async () => {
    const results: Array<MatrixRow & { obtained: number; match: boolean }> = [];

    for (const row of MATRIX) {
      const token = tokenFor(row.role);
      const req = request(app.getHttpServer()).get(row.endpoint);
      if (token) {
        req.set('Authorization', `Bearer ${token}`);
      }

      const response = await req;
      const obtained = response.status;
      results.push({
        ...row,
        obtained,
        match: obtained === row.expected,
      });
    }

    const table = [
      'endpoint | método | rol | esperado | obtenido | ok',
      ...results.map(
        (row) =>
          `${row.endpoint} | ${row.method} | ${row.role} | ${row.expected} | ${row.obtained} | ${row.match ? 'sí' : 'NO'}`,
      ),
    ].join('\n');

    // eslint-disable-next-line no-console
    console.log(`\n${table}\n`);

    const mismatches = results.filter((row) => !row.match);
    expect(mismatches).toEqual([]);
  });
});
