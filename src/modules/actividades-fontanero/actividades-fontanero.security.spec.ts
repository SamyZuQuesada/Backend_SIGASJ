import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { EstadoActividadFontanero } from '../../common/enums/estado-actividad-fontanero.enum';
import { Role } from '../../common/enums/role.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { ActividadesFontaneroModule } from './actividades-fontanero.module';
import { ActividadFontanero } from './entities/actividad-fontanero.entity';
import { TipoActividadFontanero } from './entities/tipo-actividad-fontanero.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';

/**
 * Suite de aceptación de seguridad Backend (independiente del Frontend).
 * Criterios: 401 sin auth / token inválido / vencido; 403 sin rol; Fontanero OK.
 */
describe('Seguridad Backend — módulo actividades Fontanero', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let actividades: Repository<ActividadFontanero>;

  const FONTANERO_GET_PATHS = [
    '/fontanero/actividades',
    '/fontanero/actividades/historial',
    '/fontanero/actividades/correcciones',
  ] as const;

  const signAs = (role: Role | string, sub = 'fontanero-1') => {
    const payload: JwtPayload = {
      sub,
      email: 'usuario@asadasanjuan.cr',
      role: role as Role,
      name: 'Usuario',
    };
    return jwtService.sign(payload);
  };

  const expiredToken = (role: Role = Role.FONTANERO) =>
    jwtService.sign(
      {
        sub: 'fontanero-1',
        email: 'fontanero@asadasanjuan.cr',
        role,
        name: 'Fontanero',
      },
      { expiresIn: -1 },
    );

  const get = (path: string, token?: string | null) => {
    const req = request(app.getHttpServer()).get(`/api/v1${path}`);
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  };

  const post = (
    path: string,
    body: Record<string, unknown>,
    token?: string | null,
  ) => {
    const req = request(app.getHttpServer()).post(`/api/v1${path}`);
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.send(body);
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig],
        }),
        TypeOrmModule.forRoot({
          type: 'sqljs',
          autoSave: false,
          dropSchema: true,
          entities: [ActividadFontanero, TipoActividadFontanero, Usuario],
          synchronize: true,
        }),
        AuthModule,
        ActividadesFontaneroModule,
      ],
      providers: [
        {
          provide: APP_FILTER,
          useClass: HttpExceptionFilter,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    actividades = moduleFixture.get(getRepositoryToken(ActividadFontanero));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await actividades.clear();
  });

  describe('Fontanero autenticado puede usar el módulo', () => {
    it('registra y consulta endpoints operativos', async () => {
      const token = signAs(Role.FONTANERO, 'fontanero-1');

      const created = await post(
        '/fontanero/actividades',
        { titulo: 'Lectura de medidor sector norte' },
        token,
      ).expect(201);

      expect(created.body).toMatchObject({
        titulo: 'Lectura de medidor sector norte',
        estado: EstadoActividadFontanero.REPORTADA,
      });

      for (const path of FONTANERO_GET_PATHS) {
        const response = await get(path, token).expect(200);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('total');
        expect(response.body.statusCode).toBeUndefined();
      }

      const detail = await get(
        `/fontanero/actividades/${(created.body as { id: number }).id}`,
        token,
      ).expect(200);
      expect(detail.body).toMatchObject({
        id: (created.body as { id: number }).id,
      });
    });
  });

  describe('401 — sin autenticación válida', () => {
    it.each([...FONTANERO_GET_PATHS])(
      '%s sin token responde 401',
      async (path) => {
        const response = await get(path).expect(401);
        expect(response.body).toMatchObject({
          statusCode: 401,
          message: 'No autenticado',
        });
      },
    );

    it('POST registro sin token responde 401', async () => {
      const response = await post('/fontanero/actividades', {
        titulo: 'No debe persistir',
      }).expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'No autenticado',
      });
      expect(await actividades.count()).toBe(0);
    });

    it.each([...FONTANERO_GET_PATHS, '/fontanero/actividades'] as const)(
      '%s con token inválido responde 401',
      async (path) => {
        const response = await get(path, 'token-invalido').expect(401);
        expect(response.body).toMatchObject({
          statusCode: 401,
          message: 'No autenticado',
        });
      },
    );

    it('POST con token inválido responde 401', async () => {
      await post(
        '/fontanero/actividades',
        { titulo: 'Hack' },
        'no-es-un-jwt',
      ).expect(401);
      expect(await actividades.count()).toBe(0);
    });

    it.each([...FONTANERO_GET_PATHS])(
      '%s con token vencido responde 401',
      async (path) => {
        const response = await get(path, expiredToken()).expect(401);
        expect(response.body).toMatchObject({
          statusCode: 401,
          message: 'No autenticado',
        });
      },
    );

    it('POST con token vencido responde 401', async () => {
      await post(
        '/fontanero/actividades',
        { titulo: 'Vencido' },
        expiredToken(),
      ).expect(401);
      expect(await actividades.count()).toBe(0);
    });
  });

  describe('403 — autenticado sin rol Fontanero', () => {
    const unauthorizedRoles: Array<{ label: string; role: Role | string }> = [
      { label: 'Administradora', role: Role.ADMINISTRADORA },
      { label: 'Secretaria', role: Role.SECRETARIA },
      { label: 'Abonado', role: 'ABONADO' },
    ];

    it.each(unauthorizedRoles)(
      '$label no puede registrar actividad (403)',
      async ({ role }) => {
        const response = await post(
          '/fontanero/actividades',
          { titulo: 'Intento no autorizado' },
          signAs(role, 'otro-1'),
        ).expect(403);

        expect(response.body).toMatchObject({
          statusCode: 403,
          message: 'Acceso denegado',
        });
        expect(await actividades.count()).toBe(0);
      },
    );

    it.each(unauthorizedRoles)(
      '$label no puede listar / historial / correcciones (403)',
      async ({ role }) => {
        const token = signAs(role, 'otro-1');
        for (const path of FONTANERO_GET_PATHS) {
          const response = await get(path, token).expect(403);
          expect(response.body).toMatchObject({
            statusCode: 403,
            message: 'Acceso denegado',
          });
        }
      },
    );

    it('Administradora no obtiene detalle operativo de Fontanero (403)', async () => {
      const own = await actividades.save(
        actividades.create({
          titulo: 'Propia',
          descripcion: null,
          ubicacion: null,
          estado: EstadoActividadFontanero.REPORTADA,
          fontaneroId: 'fontanero-1',
          observacionCorreccion: null,
          revisadoPorId: null,
        }),
      );

      const response = await get(
        `/fontanero/actividades/${own.id}`,
        signAs(Role.ADMINISTRADORA, 'admin-1'),
      ).expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        message: 'Acceso denegado',
      });
    });
  });

  describe('llamada directa al Backend (evasión de Frontend)', () => {
    it('consumir endpoint restringido con Abonado sigue bloqueado aunque no pase por React', async () => {
      const response = await post(
        '/fontanero/actividades',
        { titulo: 'Evasión por curl' },
        signAs('ABONADO', 'abonado-99'),
      ).expect(403);

      expect(response.body.statusCode).toBe(403);
      expect(await actividades.count()).toBe(0);
    });

    it('URL/id ajeno: Fontanero no lee actividad de otro (403)', async () => {
      const ajena = await actividades.save(
        actividades.create({
          titulo: 'De otro',
          descripcion: null,
          ubicacion: null,
          estado: EstadoActividadFontanero.REPORTADA,
          fontaneroId: 'fontanero-2',
          observacionCorreccion: null,
          revisadoPorId: null,
        }),
      );

      const response = await get(
        `/fontanero/actividades/${ajena.id}`,
        signAs(Role.FONTANERO, 'fontanero-1'),
      ).expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        message: 'Acceso denegado',
      });
    });

    it('respuestas de error no exponen secretos ni stack', async () => {
      const response = await get(
        '/fontanero/actividades',
        'token-basura',
      ).expect(401);

      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain('stack');
      expect(serialized).not.toContain('JWT_SECRET');
      expect(serialized).not.toContain('password');
      expect(Object.keys(response.body as object).sort()).toEqual([
        'message',
        'statusCode',
      ]);
    });
  });
});
