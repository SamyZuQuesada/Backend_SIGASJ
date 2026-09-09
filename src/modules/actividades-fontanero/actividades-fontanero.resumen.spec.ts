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
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActividadesFontaneroModule } from './actividades-fontanero.module';
import type { ResumenActividadesResponse } from './actividades-fontanero.service';
import { ActividadFontanero } from './entities/actividad-fontanero.entity';
import { DocumentoActividadFontanero } from './entities/documento-actividad-fontanero.entity';
import { TipoActividadFontanero } from './entities/tipo-actividad-fontanero.entity';
import { seedTiposActividadFontanero } from './testing/actividades-fontanero.test-helpers';

type ErrorBody = { statusCode: number; message: string | string[] };

const asResumen = (body: unknown): ResumenActividadesResponse =>
  body as ResumenActividadesResponse;

const asError = (body: unknown): ErrorBody => body as ErrorBody;

const assertSafeClientBody = (body: unknown) => {
  const serialized = JSON.stringify(body ?? '');
  expect(serialized).not.toMatch(/at\s+\w+\s+\(/);
  expect(serialized).not.toContain('stack');
  expect(serialized).not.toContain('JWT_SECRET');
  expect(serialized).not.toContain('passwordHash');
};

jest.setTimeout(30000);

describe('Resumen de actividades (dashboard 7.11)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let actividades: Repository<ActividadFontanero>;
  let tiposActividad: Repository<TipoActividadFontanero>;
  let tipos: TipoActividadFontanero[];

  const signAs = (
    role: Role | string,
    sub = 'admin-1',
    email = 'admin@asadasanjuan.cr',
  ) => {
    const payload: JwtPayload = {
      sub,
      email,
      role: role as Role,
      name: 'Usuario',
    };
    return jwtService.sign(payload);
  };

  const authGet = (path: string, token?: string | null) => {
    const req = request(app.getHttpServer()).get(`/api/v1${path}`);
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  };

  const adminToken = () => signAs(Role.ADMINISTRADORA, 'admin-1');
  const fontaneroToken = (sub = 'fontanero-1') =>
    signAs(Role.FONTANERO, sub, `${sub}@asadasanjuan.cr`);

  const seedActividad = async (input: {
    titulo: string;
    fontaneroId: string;
    fechaActividad: string;
    tipo: TipoActividadFontanero;
    estado?: EstadoActividadFontanero;
  }) =>
    actividades.save(
      actividades.create({
        titulo: input.titulo,
        descripcion: null,
        ubicacion: null,
        estado: input.estado ?? EstadoActividadFontanero.REPORTADA,
        fontaneroId: input.fontaneroId,
        fechaActividad: input.fechaActividad,
        tipoActividad: input.tipo,
        observacionCorreccion: null,
        revisadoPorId: null,
      }),
    );

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
          entities: [
            ActividadFontanero,
            TipoActividadFontanero,
            DocumentoActividadFontanero,
            Usuario,
          ],
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
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );
    await app.init();

    jwtService = moduleFixture.get(JwtService);
    actividades = moduleFixture.get(getRepositoryToken(ActividadFontanero));
    tiposActividad = moduleFixture.get(
      getRepositoryToken(TipoActividadFontanero),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await actividades.clear();
    await tiposActividad.clear();
    tipos = await seedTiposActividadFontanero(tiposActividad);
  });

  describe('GET /api/v1/admin/actividades/resumen', () => {
    it('devuelve total y agregados por estado sin filtros', async () => {
      await seedActividad({
        titulo: 'A1',
        fontaneroId: 'fontanero-1',
        fechaActividad: '2026-09-01',
        tipo: tipos[0],
        estado: EstadoActividadFontanero.REPORTADA,
      });
      await seedActividad({
        titulo: 'A2',
        fontaneroId: 'fontanero-2',
        fechaActividad: '2026-09-05',
        tipo: tipos[0],
        estado: EstadoActividadFontanero.REVISADA,
      });
      await seedActividad({
        titulo: 'A3',
        fontaneroId: 'fontanero-1',
        fechaActividad: '2026-09-10',
        tipo: tipos[1],
        estado: EstadoActividadFontanero.CORREGIDA,
      });

      const response = await authGet(
        '/admin/actividades/resumen',
        adminToken(),
      ).expect(200);
      const body = asResumen(response.body);

      expect(body.total).toBe(3);
      expect(body.porEstado.REPORTADA).toBe(1);
      expect(body.porEstado.REVISADA).toBe(1);
      expect(body.porEstado.CORREGIDA).toBe(1);
      assertSafeClientBody(body);
    });

    it('filtra por rango de fechas inclusive', async () => {
      await seedActividad({
        titulo: 'Fuera',
        fontaneroId: 'fontanero-1',
        fechaActividad: '2026-08-31',
        tipo: tipos[0],
      });
      await seedActividad({
        titulo: 'Dentro',
        fontaneroId: 'fontanero-1',
        fechaActividad: '2026-09-15',
        tipo: tipos[0],
      });

      const response = await authGet(
        '/admin/actividades/resumen?fechaInicio=2026-09-01&fechaFin=2026-09-30',
        adminToken(),
      ).expect(200);

      expect(asResumen(response.body).total).toBe(1);
    });

    it('rechaza rango de fechas inválido', async () => {
      const response = await authGet(
        '/admin/actividades/resumen?fechaInicio=2026-09-30&fechaFin=2026-09-01',
        adminToken(),
      ).expect(400);

      expect(asError(response.body).statusCode).toBe(400);
    });

    it('rechaza fechaInicio inválida', async () => {
      await authGet(
        '/admin/actividades/resumen?fechaInicio=hola',
        adminToken(),
      ).expect(400);
    });

    it('sin token responde 401', async () => {
      await authGet('/admin/actividades/resumen').expect(401);
    });

    it('Fontanero no puede consultar resumen administrativo', async () => {
      await authGet(
        '/admin/actividades/resumen',
        fontaneroToken(),
      ).expect(403);
    });
  });

  describe('GET /api/v1/fontanero/actividades/resumen', () => {
    it('devuelve solo actividades del fontanero autenticado', async () => {
      await seedActividad({
        titulo: 'Propia 1',
        fontaneroId: 'fontanero-1',
        fechaActividad: '2026-09-01',
        tipo: tipos[0],
        estado: EstadoActividadFontanero.REPORTADA,
      });
      await seedActividad({
        titulo: 'Propia 2',
        fontaneroId: 'fontanero-1',
        fechaActividad: '2026-09-02',
        tipo: tipos[0],
        estado: EstadoActividadFontanero.REQUIERE_CORRECCION,
      });
      await seedActividad({
        titulo: 'Ajena',
        fontaneroId: 'fontanero-2',
        fechaActividad: '2026-09-03',
        tipo: tipos[0],
      });

      const response = await authGet(
        '/fontanero/actividades/resumen',
        fontaneroToken('fontanero-1'),
      ).expect(200);
      const body = asResumen(response.body);

      expect(body.total).toBe(2);
      expect(body.porEstado.REPORTADA).toBe(1);
      expect(body.porEstado.REQUIERE_CORRECCION).toBe(1);
      assertSafeClientBody(body);
    });

    it('filtra por rango de fechas', async () => {
      await seedActividad({
        titulo: 'Antes',
        fontaneroId: 'fontanero-1',
        fechaActividad: '2026-08-01',
        tipo: tipos[0],
      });
      await seedActividad({
        titulo: 'Periodo',
        fontaneroId: 'fontanero-1',
        fechaActividad: '2026-09-15',
        tipo: tipos[0],
      });

      const response = await authGet(
        '/fontanero/actividades/resumen?fechaInicio=2026-09-01&fechaFin=2026-09-30',
        fontaneroToken(),
      ).expect(200);

      expect(asResumen(response.body).total).toBe(1);
    });

    it('Administradora no puede consultar resumen de fontanero', async () => {
      await authGet(
        '/fontanero/actividades/resumen',
        adminToken(),
      ).expect(403);
    });

    it('sin token responde 401', async () => {
      await authGet('/fontanero/actividades/resumen').expect(401);
    });
  });
});
