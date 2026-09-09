import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { EstadoActividadFontanero } from '../../common/enums/estado-actividad-fontanero.enum';
import { Role } from '../../common/enums/role.enum';
import { TipoActividadFontaneroCodigo } from '../../common/enums/tipo-actividad-fontanero-codigo.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActividadesFontaneroModule } from './actividades-fontanero.module';
import type { ActividadFontaneroAdminResponse } from './actividades-fontanero.service';
import { ActividadFontanero } from './entities/actividad-fontanero.entity';
import { DocumentoActividadFontanero } from './entities/documento-actividad-fontanero.entity';
import { TipoActividadFontanero } from './entities/tipo-actividad-fontanero.entity';
import {
  buildValidCreateActividadPayload,
  seedTiposActividadFontanero,
} from './testing/actividades-fontanero.test-helpers';

type ErrorResponseBody = { statusCode: number; message: string | string[] };

const asDetail = (body: unknown): ActividadFontaneroAdminResponse =>
  body as ActividadFontaneroAdminResponse;

const asError = (body: unknown): ErrorResponseBody => body as ErrorResponseBody;

const assertSafeClientBody = (body: unknown) => {
  const serialized = JSON.stringify(body ?? '');
  expect(serialized).not.toMatch(/at\s+\w+\s+\(/);
  expect(serialized).not.toContain('\\n    at ');
  expect(serialized).not.toContain('stack');
  expect(serialized).not.toContain('QueryFailedError');
  expect(serialized).not.toContain('password');
  expect(serialized).not.toMatch(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\./);
  expect(serialized).not.toMatch(
    /\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/i,
  );
};

describe('PBI Detalle Completo de Actividad de Fontanero (GET /actividades-fontanero/:id)', () => {
  jest.setTimeout(60000);

  let app: INestApplication<App>;
  let jwtService: JwtService;
  let actividadRepo: Repository<ActividadFontanero>;
  let tiposRepo: Repository<TipoActividadFontanero>;
  let docRepo: Repository<DocumentoActividadFontanero>;
  let tipoControlFugasId: number;
  let tipoTomaPresionId: number;

  const signAs = (
    role: Role | string,
    sub = 'test-user',
    expiresIn?: string | number,
  ) => {
    const payload: JwtPayload = {
      sub,
      email: `${sub}@asadasanjuan.cr`,
      role: role as Role,
      name: `Usuario ${sub}`,
    };
    if (expiresIn !== undefined) {
      return jwtService.sign(payload, {
        expiresIn,
      } as unknown as JwtSignOptions);
    }
    return jwtService.sign(payload);
  };

  const toFullPath = (path: string) =>
    path.startsWith('/api/v1')
      ? path
      : `/api/v1${path.startsWith('/') ? '' : '/'}${path}`;

  const authGet = (path: string, token?: string) => {
    const req = request(app.getHttpServer()).get(toFullPath(path));
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req;
  };

  const authPost = (
    path: string,
    body: Record<string, unknown>,
    token?: string,
  ) => {
    const req = request(app.getHttpServer()).post(toFullPath(path));
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.send(body);
  };

  const authPatch = (
    path: string,
    body: Record<string, unknown>,
    token?: string,
  ) => {
    const req = request(app.getHttpServer()).patch(toFullPath(path));
    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }
    return req.send(body);
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
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

    app = moduleRef.createNestApplication();
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

    jwtService = moduleRef.get(JwtService);
    actividadRepo = moduleRef.get(getRepositoryToken(ActividadFontanero));
    tiposRepo = moduleRef.get(getRepositoryToken(TipoActividadFontanero));
    docRepo = moduleRef.get(getRepositoryToken(DocumentoActividadFontanero));

    await seedTiposActividadFontanero(tiposRepo);
    const tipos = await tiposRepo.find();
    tipoControlFugasId = tipos.find(
      (t) => t.codigo === TipoActividadFontaneroCodigo.CONTROL_FUGAS,
    )!.id;
    tipoTomaPresionId = tipos.find(
      (t) => t.codigo === TipoActividadFontaneroCodigo.TOMA_PRESION,
    )!.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await docRepo.clear();
    await actividadRepo.clear();
  });

  describe('1. Consulta por Fontanero responsable', () => {
    it('el fontanero consulta con éxito una actividad propia registrada', async () => {
      const tokenFontanero = signAs(Role.FONTANERO, 'fontanero-1');

      const created = await authPost(
        '/fontanero/actividades',
        buildValidCreateActividadPayload(tipoControlFugasId, {
          titulo: 'Reparación de fuga en calle principal',
          descripcion: 'Se cambió tramo de 2 metros de tubería',
          ubicacion: 'Frente a la iglesia',
          observaciones: 'Presión restablecida',
          ubicacionFuga: 'Acera este',
        }),
        tokenFontanero,
      ).expect(201);

      const actividadId = (created.body as { id: number }).id;

      const res = await authGet(
        `/actividades-fontanero/${actividadId}`,
        tokenFontanero,
      ).expect(200);

      const detail = asDetail(res.body);
      expect(detail.id).toBe(actividadId);
      expect(detail.titulo).toBe('Reparación de fuga en calle principal');
      expect(detail.descripcion).toBe('Se cambió tramo de 2 metros de tubería');
      expect(detail.ubicacion).toBe('Frente a la iglesia');
      expect(detail.observaciones).toBe('Presión restablecida');
      expect(detail.tipoActividadId).toBe(tipoControlFugasId);
      expect(detail.tipoActividadNombre).toBe('Control de Fugas');
      expect(detail.tipoActividadCodigo).toBe(
        TipoActividadFontaneroCodigo.CONTROL_FUGAS,
      );
      expect(detail.fontaneroId).toBe('fontanero-1');
      expect(detail.fechaActividad).toBeDefined();
      expect(detail.fechaRegistro).toBeDefined();
      expect(detail.estado).toBe(EstadoActividadFontanero.REPORTADA);
      expect(detail.estadoRevision).toBe('PENDIENTE');
      expect(detail.datosEspecificos).toMatchObject({
        ubicacionFuga: 'Acera este',
      });
      expect(Array.isArray(detail.documentos)).toBe(true);
      expect(detail.documentos).toHaveLength(0);

      assertSafeClientBody(res.body);
    });

    it('soporta la ruta alias /actividades/:id', async () => {
      const tokenFontanero = signAs(Role.FONTANERO, 'fontanero-alias');

      const created = await authPost(
        '/fontanero/actividades',
        buildValidCreateActividadPayload(tipoControlFugasId, {
          titulo: 'Actividad probando ruta alias',
        }),
        tokenFontanero,
      ).expect(201);

      const actividadId = (created.body as { id: number }).id;

      const res = await authGet(
        `/actividades/${actividadId}`,
        tokenFontanero,
      ).expect(200);

      const detail = asDetail(res.body);
      expect(detail.id).toBe(actividadId);
      expect(detail.titulo).toBe('Actividad probando ruta alias');
    });

    it('incluye documentos adjuntos cuando la actividad tiene archivos cargados', async () => {
      const tokenFontanero = signAs(Role.FONTANERO, 'fontanero-docs');

      const actividad = await actividadRepo.save(
        actividadRepo.create({
          titulo: 'Actividad con foto adjunta',
          fontaneroId: 'fontanero-docs',
          fechaActividad: '2026-08-23',
          estado: EstadoActividadFontanero.REPORTADA,
          tipoActividad: { id: tipoControlFugasId } as TipoActividadFontanero,
          datosEspecificos: { ubicacionFuga: 'Bajo el medidor' },
        }),
      );

      await docRepo.save(
        docRepo.create({
          actividad,
          nombreOriginal: 'evidencia-fuga.jpg',
          tipoArchivo: 'image/jpeg',
          rutaReferenciaArchivo: 'actividades/1/evidencia.jpg',
          tamanio: 2048,
        }),
      );

      const res = await authGet(
        `/actividades-fontanero/${actividad.id}`,
        tokenFontanero,
      ).expect(200);

      const detail = asDetail(res.body);
      expect(Array.isArray(detail.documentos)).toBe(true);
      expect(detail.documentos!).toHaveLength(1);
      expect(detail.documentos![0]).toMatchObject({
        nombreOriginal: 'evidencia-fuga.jpg',
        tipoArchivo: 'image/jpeg',
        tamanio: 2048,
      });
      assertSafeClientBody(res.body);
    });

    it('deniega acceso a un fontanero que intenta consultar la actividad de otro (403 Forbidden)', async () => {
      const fontaneroDueno = signAs(Role.FONTANERO, 'fontanero-dueno');
      const fontaneroIntruso = signAs(Role.FONTANERO, 'fontanero-intruso');

      const created = await authPost(
        '/fontanero/actividades',
        buildValidCreateActividadPayload(tipoControlFugasId, {
          titulo: 'Actividad confidencial de fontanero dueno',
        }),
        fontaneroDueno,
      ).expect(201);

      const actividadId = (created.body as { id: number }).id;

      const res = await authGet(
        `/actividades-fontanero/${actividadId}`,
        fontaneroIntruso,
      ).expect(403);

      expect(asError(res.body).message).toBe('Acceso denegado');
      assertSafeClientBody(res.body);
    });
  });

  describe('2. Consulta por Administradora', () => {
    it('la administradora puede consultar la actividad de cualquier fontanero', async () => {
      const tokenFontanero = signAs(Role.FONTANERO, 'fontanero-operario');
      const tokenAdmin = signAs(Role.ADMINISTRADORA, 'admin-general');

      const created = await authPost(
        '/fontanero/actividades',
        buildValidCreateActividadPayload(tipoTomaPresionId, {
          titulo: 'Medición de presión sector tanque',
          presionMedida: 45.5,
        }),
        tokenFontanero,
      ).expect(201);

      const actividadId = (created.body as { id: number }).id;

      const res = await authGet(
        `/actividades-fontanero/${actividadId}`,
        tokenAdmin,
      ).expect(200);

      const detail = asDetail(res.body);
      expect(detail.id).toBe(actividadId);
      expect(detail.fontaneroId).toBe('fontanero-operario');
      expect(detail.tipoActividadNombre).toBe('Toma de presión');
      expect(detail.estadoRevision).toBe('PENDIENTE');
      expect(detail.datosEspecificos).toMatchObject({ presionMedida: 45.5 });
    });

    it('muestra el estado de revisión REVISADA con fecha y auditor cuando fue revisada', async () => {
      const tokenFontanero = signAs(Role.FONTANERO, 'fontanero-rev');
      const tokenAdmin = signAs(Role.ADMINISTRADORA, 'admin-auditora');

      const created = await authPost(
        '/fontanero/actividades',
        buildValidCreateActividadPayload(tipoControlFugasId, {
          titulo: 'Actividad a revisar por la administradora',
        }),
        tokenFontanero,
      ).expect(201);

      const actividadId = (created.body as { id: number }).id;

      await authPatch(
        `/admin/actividades/${actividadId}/revisar`,
        { observacion: 'Revisión técnica conforme' },
        tokenAdmin,
      ).expect(200);

      const res = await authGet(
        `/actividades-fontanero/${actividadId}`,
        tokenAdmin,
      ).expect(200);

      const detail = asDetail(res.body);
      expect(detail.estado).toBe(EstadoActividadFontanero.REVISADA);
      expect(detail.estadoRevision).toBe('REVISADA');
      expect(detail.revisadoPorId).toBe('admin-auditora');
      expect(detail.fechaRevision).toBeDefined();
      expect(detail.observacionCorreccion).toBe('Revisión técnica conforme');
    });

    it('muestra la observación de corrección cuando la actividad requiere corrección', async () => {
      const tokenFontanero = signAs(Role.FONTANERO, 'fontanero-corr');
      const tokenAdmin = signAs(Role.ADMINISTRADORA, 'admin-revisora');

      const created = await authPost(
        '/fontanero/actividades',
        buildValidCreateActividadPayload(tipoControlFugasId, {
          titulo: 'Actividad con datos dudosos',
        }),
        tokenFontanero,
      ).expect(201);

      const actividadId = (created.body as { id: number }).id;

      await authPatch(
        `/admin/actividades/${actividadId}/solicitar-correccion`,
        { observacion: 'Favor verificar la dirección exacta' },
        tokenAdmin,
      ).expect(200);

      const res = await authGet(
        `/actividades-fontanero/${actividadId}`,
        tokenAdmin,
      ).expect(200);

      const detail = asDetail(res.body);
      expect(detail.estado).toBe(EstadoActividadFontanero.REQUIERE_CORRECCION);
      expect(detail.observacionCorreccion).toBe(
        'Favor verificar la dirección exacta',
      );
    });
  });

  describe('3. Validaciones, manejo de errores y seguridad', () => {
    it('devuelve 404 si la actividad no existe', async () => {
      const tokenAdmin = signAs(Role.ADMINISTRADORA, 'admin-1');

      const res = await authGet(
        '/actividades-fontanero/99999',
        tokenAdmin,
      ).expect(404);

      expect(asError(res.body).message).toContain('Actividad no encontrada');
      assertSafeClientBody(res.body);
    });

    it('devuelve 400 si el parámetro id no es numérico', async () => {
      const tokenAdmin = signAs(Role.ADMINISTRADORA, 'admin-1');

      const res = await authGet(
        '/actividades-fontanero/invalido-id',
        tokenAdmin,
      ).expect(400);

      assertSafeClientBody(res.body);
    });

    it('deniega el acceso a roles sin permiso como SECRETARIA (403 Forbidden)', async () => {
      const tokenSecretaria = signAs(Role.SECRETARIA, 'secretaria-1');

      const res = await authGet(
        '/actividades-fontanero/1',
        tokenSecretaria,
      ).expect(403);

      assertSafeClientBody(res.body);
    });

    it('deniega peticiones no autenticadas (401 Unauthorized)', async () => {
      const res = await authGet('/actividades-fontanero/1').expect(401);
      assertSafeClientBody(res.body);
    });

    it('deniega peticiones con token JWT inválido (401 Unauthorized)', async () => {
      const res = await authGet(
        '/actividades-fontanero/1',
        'token-invalido.malformado',
      ).expect(401);

      assertSafeClientBody(res.body);
    });

    it('deniega peticiones con token JWT vencido (401 Unauthorized)', async () => {
      const expiredToken = signAs(Role.ADMINISTRADORA, 'admin-exp', -10);

      const res = await authGet(
        '/actividades-fontanero/1',
        expiredToken,
      ).expect(401);

      assertSafeClientBody(res.body);
    });
  });

  describe('4. Idempotencia y conservación de registros', () => {
    it('consultar el detalle repetidamente no modifica la base de datos', async () => {
      const tokenFontanero = signAs(Role.FONTANERO, 'fontanero-read');

      const created = await authPost(
        '/fontanero/actividades',
        buildValidCreateActividadPayload(tipoControlFugasId, {
          titulo: 'Actividad para probar lectura pura',
        }),
        tokenFontanero,
      ).expect(201);

      const actividadId = (created.body as { id: number }).id;

      const snapshotAntes = await actividadRepo.findOneOrFail({
        where: { id: actividadId },
      });
      const countAntes = await actividadRepo.count();

      // Consultas múltiples consecutivas
      await authGet(
        `/actividades-fontanero/${actividadId}`,
        tokenFontanero,
      ).expect(200);
      await authGet(
        `/actividades-fontanero/${actividadId}`,
        tokenFontanero,
      ).expect(200);
      await authGet(`/actividades/${actividadId}`, tokenFontanero).expect(200);

      const snapshotDespues = await actividadRepo.findOneOrFail({
        where: { id: actividadId },
      });
      const countDespues = await actividadRepo.count();

      expect(countDespues).toBe(countAntes);
      expect(snapshotDespues.updatedAt.getTime()).toBe(
        snapshotAntes.updatedAt.getTime(),
      );
      expect(snapshotDespues.titulo).toBe(snapshotAntes.titulo);
      expect(snapshotDespues.estado).toBe(snapshotAntes.estado);
    });
  });
});
