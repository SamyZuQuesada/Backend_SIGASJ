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
import type { ListadoTiposActividadResponse } from './actividades-fontanero.service';
import { ActividadFontanero } from './entities/actividad-fontanero.entity';
import { TipoActividadFontanero } from './entities/tipo-actividad-fontanero.entity';
import { DocumentoActividadFontanero } from './entities/documento-actividad-fontanero.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import {
  buildValidCreateActividadPayload,
  seedTiposActividadFontanero,
} from './testing/actividades-fontanero.test-helpers';
import { TIPOS_ACTIVIDAD_FONTANERO_INICIALES } from './tipo-actividad-fontanero.catalogo';

const assertSafeClientBody = (body: unknown) => {
  const serialized = JSON.stringify(body ?? '');
  expect(serialized).not.toMatch(/at\s+\w+\s+\(/);
  expect(serialized).not.toContain('\\n    at ');
  expect(serialized).not.toContain('stack');
  expect(serialized).not.toContain('QueryFailedError');
  expect(serialized).not.toContain('JWT_SECRET');
  expect(serialized).not.toContain('super_secret_jwt');
  expect(serialized).not.toContain('password');
  expect(serialized).not.toContain('Password123!');
  expect(serialized).not.toMatch(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\./);
  expect(serialized).not.toMatch(
    /\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/i,
  );
};

jest.setTimeout(30000);

describe('Actividades Fontanero — autenticación y autorización', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let actividades: Repository<ActividadFontanero>;
  let tiposActividad: Repository<TipoActividadFontanero>;
  let validTipoActividadId: number;

  const validPayload = (overrides: Record<string, unknown> = {}) =>
    buildValidCreateActividadPayload(validTipoActividadId, overrides);

  const signAs = (
    role: Role | string,
    sub = 'fontanero-1',
    email = 'usuario@asadasanjuan.cr',
  ) => {
    const payload: JwtPayload = {
      sub,
      email,
      role: role as Role,
      name: 'Usuario',
    };
    return jwtService.sign(payload);
  };

  const expiredToken = (role: Role, sub = '1') =>
    jwtService.sign(
      {
        sub,
        email: 'usuario@asadasanjuan.cr',
        role,
        name: 'Usuario',
      },
      { expiresIn: -1 },
    );

  const authGet = (path: string, token?: string | null) => {
    const req = request(app.getHttpServer()).get(`/api/v1${path}`);
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  };

  const authPost = (
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

  const authPatch = (
    path: string,
    body: Record<string, unknown>,
    token?: string | null,
  ) => {
    const req = request(app.getHttpServer()).patch(`/api/v1${path}`);
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
    const tipos = await seedTiposActividadFontanero(tiposActividad);
    validTipoActividadId = tipos[0].id;
  });

  describe('POST /api/v1/fontanero/actividades', () => {
    it('Fontanero con token válido registra actividad y el dueño sale del JWT', async () => {
      const token = signAs(Role.FONTANERO, 'fontanero-1');
      const payload = validPayload();
      const response = await authPost(
        '/fontanero/actividades',
        payload,
        token,
      ).expect(201);

      expect(response.body).toMatchObject({
        titulo: payload.titulo,
        tipoActividadId: payload.tipoActividadId,
        fechaActividad: payload.fechaActividad,
        estado: EstadoActividadFontanero.REPORTADA,
      });
      expect(response.body).not.toHaveProperty('fontaneroId');
      expect(await actividades.count()).toBe(1);
      const saved = await actividades.findOne({
        where: { id: (response.body as { id: number }).id },
        relations: { tipoActividad: true },
      });
      expect(saved?.fontaneroId).toBe('fontanero-1');
      expect(saved?.tipoActividad?.id).toBe(payload.tipoActividadId);
      assertSafeClientBody(response.body);
    });

    it('sin token responde 401', async () => {
      const response = await authPost(
        '/fontanero/actividades',
        validPayload(),
      ).expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'No autenticado',
      });
      expect(await actividades.count()).toBe(0);
      assertSafeClientBody(response.body);
    });

    it('token inválido responde 401', async () => {
      const response = await authPost(
        '/fontanero/actividades',
        validPayload(),
        'token-invalido',
      ).expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'No autenticado',
      });
      expect(await actividades.count()).toBe(0);
      assertSafeClientBody(response.body);
    });

    it('token vencido responde 401', async () => {
      const response = await authPost(
        '/fontanero/actividades',
        validPayload(),
        expiredToken(Role.FONTANERO),
      ).expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'No autenticado',
      });
      expect(await actividades.count()).toBe(0);
      assertSafeClientBody(response.body);
    });

    it('Administradora autenticada recibe 403', async () => {
      const response = await authPost(
        '/fontanero/actividades',
        validPayload(),
        signAs(Role.ADMINISTRADORA, 'admin-1'),
      ).expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        message: 'Acceso denegado',
      });
      expect(await actividades.count()).toBe(0);
      assertSafeClientBody(response.body);
    });

    it('Secretaria autenticada recibe 403', async () => {
      const response = await authPost(
        '/fontanero/actividades',
        validPayload(),
        signAs(Role.SECRETARIA, 'sec-1'),
      ).expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        message: 'Acceso denegado',
      });
      expect(await actividades.count()).toBe(0);
      assertSafeClientBody(response.body);
    });

    it('rol Abonado (no autorizado) recibe 403', async () => {
      const response = await authPost(
        '/fontanero/actividades',
        validPayload(),
        signAs('ABONADO', 'abonado-1'),
      ).expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        message: 'Acceso denegado',
      });
      expect(await actividades.count()).toBe(0);
      assertSafeClientBody(response.body);
    });

    it('rechaza fontaneroId / identidad enviada desde el cliente', async () => {
      const response = await authPost(
        '/fontanero/actividades',
        {
          ...validPayload(),
          fontaneroId: 'fontanero-ajeno',
          userId: 'fontanero-ajeno',
          idUsuario: 99,
        },
        signAs(Role.FONTANERO, 'fontanero-1'),
      ).expect(400);

      expect(response.body).toMatchObject({ statusCode: 400 });
      expect(await actividades.count()).toBe(0);
      assertSafeClientBody(response.body);
    });

    it('rechaza un tipo de actividad inexistente', async () => {
      const response = await authPost(
        '/fontanero/actividades',
        buildValidCreateActividadPayload(9999),
        signAs(Role.FONTANERO, 'fontanero-1'),
      ).expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        message: 'Tipo de actividad no encontrado',
      });
      expect(await actividades.count()).toBe(0);
      assertSafeClientBody(response.body);
    });

    it('rechaza un tipo de actividad inactivo', async () => {
      await tiposActividad.update(
        { id: validTipoActividadId },
        { activo: false },
      );

      const response = await authPost(
        '/fontanero/actividades',
        validPayload(),
        signAs(Role.FONTANERO, 'fontanero-1'),
      ).expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        message: 'El tipo de actividad no está activo',
      });
      expect(await actividades.count()).toBe(0);
      assertSafeClientBody(response.body);
    });

    it('rechaza payload incompleto sin fecha de actividad', async () => {
      const { fechaActividad: _fecha, ...incomplete } = validPayload();
      const response = await authPost(
        '/fontanero/actividades',
        incomplete,
        signAs(Role.FONTANERO, 'fontanero-1'),
      ).expect(400);

      expect(response.body).toMatchObject({ statusCode: 400 });
      expect(await actividades.count()).toBe(0);
      assertSafeClientBody(response.body);
    });
  });

  describe('GET /api/v1/fontanero/actividades/tipos', () => {
    it('Fontanero consulta el catálogo activo', async () => {
      const response = await authGet(
        '/fontanero/actividades/tipos',
        signAs(Role.FONTANERO, 'fontanero-1'),
      ).expect(200);

      const body = response.body as ListadoTiposActividadResponse;
      expect(body.total).toBe(TIPOS_ACTIVIDAD_FONTANERO_INICIALES.length);
      expect(body.data).toHaveLength(
        TIPOS_ACTIVIDAD_FONTANERO_INICIALES.length,
      );
      expect(body.data[0]).toMatchObject({
        codigo: 'CONTROL_FUGAS',
        nombre: 'Control de Fugas',
        orden: 1,
      });
      expect(body.data[0]).not.toHaveProperty('activo');
      assertSafeClientBody(response.body);
    });

    it('Administradora consulta el mismo catálogo', async () => {
      const response = await authGet(
        '/fontanero/actividades/tipos',
        signAs(Role.ADMINISTRADORA, 'admin-1'),
      ).expect(200);

      const body = response.body as ListadoTiposActividadResponse;
      expect(body.total).toBe(TIPOS_ACTIVIDAD_FONTANERO_INICIALES.length);
      assertSafeClientBody(response.body);
    });

    it('sin token responde 401', async () => {
      const response = await authGet('/fontanero/actividades/tipos').expect(
        401,
      );
      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'No autenticado',
      });
      assertSafeClientBody(response.body);
    });

    it('token inválido responde 401', async () => {
      const response = await authGet(
        '/fontanero/actividades/tipos',
        'token-invalido',
      ).expect(401);
      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'No autenticado',
      });
      assertSafeClientBody(response.body);
    });

    it('token vencido responde 401', async () => {
      const response = await authGet(
        '/fontanero/actividades/tipos',
        expiredToken(Role.FONTANERO),
      ).expect(401);
      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'No autenticado',
      });
      assertSafeClientBody(response.body);
    });

    it('Secretaria autenticada recibe 403', async () => {
      const response = await authGet(
        '/fontanero/actividades/tipos',
        signAs(Role.SECRETARIA, 'sec-1'),
      ).expect(403);
      expect(response.body).toMatchObject({
        statusCode: 403,
        message: 'Acceso denegado',
      });
      assertSafeClientBody(response.body);
    });

    it('rol Abonado recibe 403', async () => {
      const response = await authGet(
        '/fontanero/actividades/tipos',
        signAs('ABONADO', 'abonado-1'),
      ).expect(403);
      expect(response.body).toMatchObject({
        statusCode: 403,
        message: 'Acceso denegado',
      });
      assertSafeClientBody(response.body);
    });
  });

  describe('GET /api/v1/fontanero/actividades — consultas propias', () => {
    it('Fontanero solo ve sus propias actividades', async () => {
      await actividades.save([
        actividades.create({
          titulo: 'Mía',
          descripcion: null,
          ubicacion: null,
          estado: EstadoActividadFontanero.REPORTADA,
          fontaneroId: 'fontanero-1',
          observacionCorreccion: null,
          revisadoPorId: null,
        }),
        actividades.create({
          titulo: 'Ajena',
          descripcion: null,
          ubicacion: null,
          estado: EstadoActividadFontanero.REPORTADA,
          fontaneroId: 'fontanero-2',
          observacionCorreccion: null,
          revisadoPorId: null,
        }),
      ]);

      const response = await authGet(
        '/fontanero/actividades',
        signAs(Role.FONTANERO, 'fontanero-1'),
      ).expect(200);

      expect(response.body).toMatchObject({ total: 1 });
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].titulo).toBe('Mía');
      expect(JSON.stringify(response.body)).not.toContain('Ajena');
      expect(JSON.stringify(response.body)).not.toContain('fontanero-2');
      assertSafeClientBody(response.body);
    });

    it('sin token responde 401', async () => {
      const response = await authGet('/fontanero/actividades').expect(401);
      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'No autenticado',
      });
      assertSafeClientBody(response.body);
    });

    it('Administradora recibe 403 en listado de fontanero', async () => {
      const response = await authGet(
        '/fontanero/actividades',
        signAs(Role.ADMINISTRADORA, 'admin-1'),
      ).expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        message: 'Acceso denegado',
      });
      assertSafeClientBody(response.body);
    });
  });

  describe('GET /api/v1/fontanero/actividades/historial y correcciones', () => {
    it('historial propio responde 200 para Fontanero', async () => {
      const response = await authGet(
        '/fontanero/actividades/historial',
        signAs(Role.FONTANERO, 'fontanero-1'),
      ).expect(200);

      expect(response.body).toMatchObject({ data: [], total: 0 });
      assertSafeClientBody(response.body);
    });

    it('correcciones pendientes responden 200 para Fontanero', async () => {
      const response = await authGet(
        '/fontanero/actividades/correcciones',
        signAs(Role.FONTANERO, 'fontanero-1'),
      ).expect(200);

      expect(response.body).toMatchObject({ data: [], total: 0 });
      assertSafeClientBody(response.body);
    });

    it('historial sin token responde 401', async () => {
      const response = await authGet('/fontanero/actividades/historial').expect(
        401,
      );
      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'No autenticado',
      });
      assertSafeClientBody(response.body);
    });

    it('correcciones con rol Abonado responde 403', async () => {
      const response = await authGet(
        '/fontanero/actividades/correcciones',
        signAs('ABONADO', 'abonado-1'),
      ).expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        message: 'Acceso denegado',
      });
      assertSafeClientBody(response.body);
    });
  });

  describe('GET/PATCH detalle y corrección — propiedad', () => {
    it('Fontanero puede ver el detalle de su propia actividad', async () => {
      const propia = await actividades.save(
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

      const response = await authGet(
        `/fontanero/actividades/${propia.id}`,
        signAs(Role.FONTANERO, 'fontanero-1'),
      ).expect(200);

      expect(response.body).toMatchObject({ id: propia.id, titulo: 'Propia' });
      assertSafeClientBody(response.body);
    });

    it('Fontanero no puede consultar actividad de otro Fontanero (403)', async () => {
      const ajena = await actividades.save(
        actividades.create({
          titulo: 'Ajena',
          descripcion: null,
          ubicacion: null,
          estado: EstadoActividadFontanero.REPORTADA,
          fontaneroId: 'fontanero-2',
          observacionCorreccion: null,
          revisadoPorId: null,
        }),
      );

      const response = await authGet(
        `/fontanero/actividades/${ajena.id}`,
        signAs(Role.FONTANERO, 'fontanero-1'),
      ).expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        message: 'Acceso denegado',
      });
      assertSafeClientBody(response.body);
    });

    it('Fontanero puede corregir y reenviar su propia actividad pendiente', async () => {
      const propia = await actividades.save(
        actividades.create({
          titulo: 'A corregir',
          descripcion: 'Original',
          ubicacion: null,
          estado: EstadoActividadFontanero.REQUIERE_CORRECCION,
          fontaneroId: 'fontanero-1',
          observacionCorreccion: 'Falta detalle',
          revisadoPorId: 'admin-1',
        }),
      );

      const response = await authPatch(
        `/fontanero/actividades/${propia.id}/corregir`,
        {
          titulo: 'Corregida',
          descripcion: 'Detalle ampliado',
        },
        signAs(Role.FONTANERO, 'fontanero-1'),
      ).expect(200);

      expect(response.body).toMatchObject({
        id: propia.id,
        titulo: 'Corregida',
        estado: EstadoActividadFontanero.CORREGIDA,
      });
      assertSafeClientBody(response.body);
    });

    it('Fontanero no puede corregir actividad de otro (403)', async () => {
      const ajena = await actividades.save(
        actividades.create({
          titulo: 'Ajena',
          descripcion: null,
          ubicacion: null,
          estado: EstadoActividadFontanero.REQUIERE_CORRECCION,
          fontaneroId: 'fontanero-2',
          observacionCorreccion: 'Falta detalle',
          revisadoPorId: 'admin-1',
        }),
      );

      const response = await authPatch(
        `/fontanero/actividades/${ajena.id}/corregir`,
        { titulo: 'Hack' },
        signAs(Role.FONTANERO, 'fontanero-1'),
      ).expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        message: 'Acceso denegado',
      });
      const persisted = await actividades.findOneByOrFail({ id: ajena.id });
      expect(persisted.titulo).toBe('Ajena');
      assertSafeClientBody(response.body);
    });

    it('detalle propio sin token responde 401', async () => {
      const response = await authGet('/fontanero/actividades/1').expect(401);
      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'No autenticado',
      });
      assertSafeClientBody(response.body);
    });
  });

  describe('GET/PATCH /api/v1/admin/actividades — Administradora', () => {
    it('Administradora lista actividades reportadas', async () => {
      await actividades.save(
        actividades.create({
          titulo: 'Reportada',
          descripcion: null,
          ubicacion: null,
          estado: EstadoActividadFontanero.REPORTADA,
          fontaneroId: 'fontanero-1',
          observacionCorreccion: null,
          revisadoPorId: null,
        }),
      );

      const response = await authGet(
        '/admin/actividades',
        signAs(Role.ADMINISTRADORA, 'admin-1'),
      ).expect(200);

      expect(response.body.total).toBe(1);
      expect(response.body.data[0]).toMatchObject({
        titulo: 'Reportada',
        fontaneroId: 'fontanero-1',
      });
      assertSafeClientBody(response.body);
    });

    it('Administradora consulta historial, reportes y detalle', async () => {
      const saved = await actividades.save(
        actividades.create({
          titulo: 'Para admin',
          descripcion: null,
          ubicacion: null,
          estado: EstadoActividadFontanero.REPORTADA,
          fontaneroId: 'fontanero-1',
          observacionCorreccion: null,
          revisadoPorId: null,
        }),
      );
      const token = signAs(Role.ADMINISTRADORA, 'admin-1');

      const historial = await authGet(
        '/admin/actividades/historial',
        token,
      ).expect(200);
      expect(historial.body.total).toBe(1);

      const reportes = await authGet(
        '/admin/actividades/reportes',
        token,
      ).expect(200);
      expect(reportes.body.total).toBe(1);
      expect(reportes.body.porEstado.REPORTADA).toBe(1);

      const detalle = await authGet(
        `/admin/actividades/${saved.id}`,
        token,
      ).expect(200);
      expect(detalle.body).toMatchObject({
        id: saved.id,
        fontaneroId: 'fontanero-1',
      });

      assertSafeClientBody(historial.body);
      assertSafeClientBody(reportes.body);
      assertSafeClientBody(detalle.body);
    });

    it('Administradora puede revisar y solicitar corrección', async () => {
      const saved = await actividades.save(
        actividades.create({
          titulo: 'A revisar',
          descripcion: null,
          ubicacion: null,
          estado: EstadoActividadFontanero.REPORTADA,
          fontaneroId: 'fontanero-1',
          observacionCorreccion: null,
          revisadoPorId: null,
        }),
      );
      const token = signAs(Role.ADMINISTRADORA, 'admin-1');

      const revisada = await authPatch(
        `/admin/actividades/${saved.id}/revisar`,
        { estado: EstadoActividadFontanero.EN_REVISION },
        token,
      ).expect(200);
      expect(revisada.body).toMatchObject({
        estado: EstadoActividadFontanero.EN_REVISION,
        revisadoPorId: 'admin-1',
      });

      const correccion = await authPatch(
        `/admin/actividades/${saved.id}/solicitar-correccion`,
        { observacion: 'Complete la ubicación exacta' },
        token,
      ).expect(200);
      expect(correccion.body).toMatchObject({
        estado: EstadoActividadFontanero.REQUIERE_CORRECCION,
        observacionCorreccion: 'Complete la ubicación exacta',
      });

      assertSafeClientBody(revisada.body);
      assertSafeClientBody(correccion.body);
    });

    it('admin listado sin token responde 401', async () => {
      const response = await authGet('/admin/actividades').expect(401);
      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'No autenticado',
      });
      assertSafeClientBody(response.body);
    });

    it('admin con token inválido responde 401', async () => {
      const response = await authGet(
        '/admin/actividades',
        'token-invalido',
      ).expect(401);
      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'No autenticado',
      });
      assertSafeClientBody(response.body);
    });

    it('admin con token vencido responde 401', async () => {
      const response = await authGet(
        '/admin/actividades',
        expiredToken(Role.ADMINISTRADORA),
      ).expect(401);
      expect(response.body).toMatchObject({
        statusCode: 401,
        message: 'No autenticado',
      });
      assertSafeClientBody(response.body);
    });

    it('Fontanero no accede a endpoints administrativos (403)', async () => {
      const token = signAs(Role.FONTANERO, 'fontanero-1');
      const paths = [
        '/admin/actividades',
        '/admin/actividades/historial',
        '/admin/actividades/reportes',
        '/admin/actividades/1',
      ];

      for (const path of paths) {
        const response = await authGet(path, token).expect(403);
        expect(response.body).toMatchObject({
          statusCode: 403,
          message: 'Acceso denegado',
        });
        assertSafeClientBody(response.body);
      }
    });

    it('Secretaria no accede a endpoints administrativos (403)', async () => {
      const response = await authGet(
        '/admin/actividades',
        signAs(Role.SECRETARIA, 'sec-1'),
      ).expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        message: 'Acceso denegado',
      });
      assertSafeClientBody(response.body);
    });

    it('Abonado no accede a información operativa administrativa (403)', async () => {
      const response = await authGet(
        '/admin/actividades/reportes',
        signAs('ABONADO', 'abonado-1'),
      ).expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        message: 'Acceso denegado',
      });
      assertSafeClientBody(response.body);
    });

    it('Fontanero no puede solicitar corrección administrativa (403)', async () => {
      const saved = await actividades.save(
        actividades.create({
          titulo: 'Reportada',
          descripcion: null,
          ubicacion: null,
          estado: EstadoActividadFontanero.REPORTADA,
          fontaneroId: 'fontanero-1',
          observacionCorreccion: null,
          revisadoPorId: null,
        }),
      );

      const response = await authPatch(
        `/admin/actividades/${saved.id}/solicitar-correccion`,
        { observacion: 'No debería poder' },
        signAs(Role.FONTANERO, 'fontanero-1'),
      ).expect(403);

      expect(response.body).toMatchObject({
        statusCode: 403,
        message: 'Acceso denegado',
      });
      const persisted = await actividades.findOneByOrFail({ id: saved.id });
      expect(persisted.estado).toBe(EstadoActividadFontanero.REPORTADA);
      assertSafeClientBody(response.body);
    });
  });
});
