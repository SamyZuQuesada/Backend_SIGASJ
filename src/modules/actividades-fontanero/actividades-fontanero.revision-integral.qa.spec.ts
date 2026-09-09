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
import { TipoActividadFontaneroCodigo } from '../../common/enums/tipo-actividad-fontanero-codigo.enum';
import { Role } from '../../common/enums/role.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ActividadesFontaneroModule } from './actividades-fontanero.module';
import type {
  ActividadFontaneroAdminResponse,
  ListadoActividadesAdminResponse,
} from './actividades-fontanero.service';
import { ActividadFontanero } from './entities/actividad-fontanero.entity';
import { TipoActividadFontanero } from './entities/tipo-actividad-fontanero.entity';
import { DocumentoActividadFontanero } from './entities/documento-actividad-fontanero.entity';
import { seedTiposActividadFontanero } from './testing/actividades-fontanero.test-helpers';

type ErrorResponseBody = { statusCode: number; message: string | string[] };

const asAdminList = (body: unknown): ListadoActividadesAdminResponse =>
  body as ListadoActividadesAdminResponse;

const asAdminDetail = (body: unknown): ActividadFontaneroAdminResponse =>
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

describe('QA Backlog 7.8 — Flujo Integral de Revisión Administrativa de Actividades', () => {
  jest.setTimeout(60000);

  let app: INestApplication<App>;
  let jwtService: JwtService;
  let actividadRepo: Repository<ActividadFontanero>;
  let tiposRepo: Repository<TipoActividadFontanero>;
  let docRepo: Repository<DocumentoActividadFontanero>;

  let tipoFugas: TipoActividadFontanero;
  let tipoPresion: TipoActividadFontanero;
  let tipoCampo: TipoActividadFontanero;
  let tipoCloros: TipoActividadFontanero;

  const signAs = (role: Role | string, sub = 'admin-1', expiresIn?: string) => {
    const payload: JwtPayload = {
      sub,
      email: `${sub}@asadasanjuan.cr`,
      role: role as Role,
      name: `Usuario ${role}`,
    };
    return jwtService.sign(
      payload,
      expiresIn ? ({ expiresIn } as Record<string, unknown>) : undefined,
    );
  };

  const authGet = (path: string, token?: string) => {
    const req = request(app.getHttpServer()).get(`/api/v1${path}`);
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req;
  };

  const authPatch = (
    path: string,
    body: Record<string, unknown>,
    token?: string,
  ) => {
    const req = request(app.getHttpServer()).patch(`/api/v1${path}`);
    if (token) req.set('Authorization', `Bearer ${token}`);
    return req.send(body);
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
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
      providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
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
    actividadRepo = moduleFixture.get(getRepositoryToken(ActividadFontanero));
    tiposRepo = moduleFixture.get(getRepositoryToken(TipoActividadFontanero));
    docRepo = moduleFixture.get(
      getRepositoryToken(DocumentoActividadFontanero),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await docRepo.clear();
    await actividadRepo.clear();
    await tiposRepo.clear();

    const catalogo = await seedTiposActividadFontanero(tiposRepo);
    tipoFugas = catalogo.find(
      (t) => t.codigo === TipoActividadFontaneroCodigo.CONTROL_FUGAS,
    )!;
    tipoPresion = catalogo.find(
      (t) => t.codigo === TipoActividadFontaneroCodigo.TOMA_PRESION,
    )!;
    tipoCampo = catalogo.find(
      (t) => t.codigo === TipoActividadFontaneroCodigo.VISITA_CAMPO,
    )!;
    tipoCloros = catalogo.find(
      (t) => t.codigo === TipoActividadFontaneroCodigo.CONTROL_CLOROS,
    )!;
  });

  describe('1. Listado de actividades y filtros', () => {
    beforeEach(async () => {
      await actividadRepo.save([
        actividadRepo.create({
          titulo: 'Control de Fugas San Juan',
          fontaneroId: 'fontanero-1',
          tipoActividad: tipoFugas,
          fechaActividad: '2026-08-20',
          estado: EstadoActividadFontanero.REPORTADA,
          observaciones: 'Fuga leve reparada',
          datosEspecificos: { ubicacionFuga: 'Sector A' },
        }),
        actividadRepo.create({
          titulo: 'Toma de presión tanque 1',
          fontaneroId: 'fontanero-2',
          tipoActividad: tipoPresion,
          fechaActividad: '2026-08-22',
          estado: EstadoActividadFontanero.REPORTADA,
          observaciones: 'Presión normal',
          datosEspecificos: { presionMedida: 45 },
        }),
        actividadRepo.create({
          titulo: 'Visita de Campo sector norte',
          fontaneroId: 'fontanero-1',
          tipoActividad: tipoCampo,
          fechaActividad: '2026-08-25',
          estado: EstadoActividadFontanero.REPORTADA,
          observaciones: 'Inspección rutinaria',
          datosEspecificos: { resultadoVisita: 'Conforme' },
        }),
        actividadRepo.create({
          titulo: 'Control de Cloros planta central',
          fontaneroId: 'fontanero-3',
          tipoActividad: tipoCloros,
          fechaActividad: '2026-08-28',
          estado: EstadoActividadFontanero.REVISADA,
          revisadoPorId: 'admin-auditor',
          fechaRevision: new Date('2026-08-29T10:00:00Z'),
          observaciones: 'Nivel óptimo',
          datosEspecificos: { cantidadCloro: 1.5 },
        }),
      ]);
    });

    it('la Administradora consulta el listado con fechas, fontaneros, tipos y estado', async () => {
      const token = signAs(Role.ADMINISTRADORA, 'admin-1');

      const res = await authGet('/admin/actividades', token).expect(200);
      const body = asAdminList(res.body);

      expect(body.total).toBe(4);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data).toHaveLength(4);

      const item = body.data[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('fechaActividad');
      expect(item).toHaveProperty('fontaneroId');
      expect(item).toHaveProperty('tipoActividadNombre');
      expect(item).toHaveProperty('estado');

      assertSafeClientBody(body);
    });

    it('filtra correctamente por fontanero responsable', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const res = await authGet(
        '/admin/actividades?fontaneroId=fontanero-1',
        token,
      ).expect(200);
      const body = asAdminList(res.body);

      expect(body.total).toBe(2);
      expect(body.data.every((a) => a.fontaneroId === 'fontanero-1')).toBe(
        true,
      );
    });

    it('filtra correctamente por tipo de actividad', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const res = await authGet(
        `/admin/actividades?tipoActividadId=${tipoPresion.id}`,
        token,
      ).expect(200);
      const body = asAdminList(res.body);

      expect(body.total).toBe(1);
      expect(body.data[0].tipoActividadNombre).toBe('Toma de presión');
    });

    it('filtra correctamente por fecha inicial, final y rango', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const resInicio = await authGet(
        '/admin/actividades?fechaInicio=2026-08-25',
        token,
      ).expect(200);
      expect(asAdminList(resInicio.body).total).toBe(2);

      const resFin = await authGet(
        '/admin/actividades?fechaFin=2026-08-22',
        token,
      ).expect(200);
      expect(asAdminList(resFin.body).total).toBe(2);

      const resRango = await authGet(
        '/admin/actividades?fechaInicio=2026-08-22&fechaFin=2026-08-25',
        token,
      ).expect(200);
      expect(asAdminList(resRango.body).total).toBe(2);
    });

    it('filtra correctamente por estado de revisión (REPORTADA y REVISADA)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const resPendientes = await authGet(
        '/admin/actividades?estado=REPORTADA',
        token,
      ).expect(200);
      const bodyPendientes = asAdminList(resPendientes.body);
      expect(bodyPendientes.total).toBe(3);
      expect(
        bodyPendientes.data.every(
          (a) => a.estado === EstadoActividadFontanero.REPORTADA,
        ),
      ).toBe(true);

      const resRevisadas = await authGet(
        '/admin/actividades?estado=REVISADA',
        token,
      ).expect(200);
      const bodyRevisadas = asAdminList(resRevisadas.body);
      expect(bodyRevisadas.total).toBe(1);
      expect(bodyRevisadas.data[0].estado).toBe(
        EstadoActividadFontanero.REVISADA,
      );
    });

    it('combina múltiples filtros con operador AND', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const query = `fontaneroId=fontanero-1&tipoActividadId=${tipoCampo.id}&fechaInicio=2026-08-20&fechaFin=2026-08-30&estado=REPORTADA`;
      const res = await authGet(`/admin/actividades?${query}`, token).expect(
        200,
      );
      const body = asAdminList(res.body);

      expect(body.total).toBe(1);
      expect(body.data[0].titulo).toBe('Visita de Campo sector norte');
    });

    it('limpiar filtros devuelve la totalidad de los registros', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const resFiltrada = await authGet(
        '/admin/actividades?fontaneroId=fontanero-3',
        token,
      ).expect(200);
      expect(asAdminList(resFiltrada.body).total).toBe(1);

      const resLimpia = await authGet('/admin/actividades', token).expect(200);
      expect(asAdminList(resLimpia.body).total).toBe(4);
    });

    it('maneja adecuadamente consultas sin resultados coincidentes', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const res = await authGet(
        '/admin/actividades?fontaneroId=fontanero-inexistente',
        token,
      ).expect(200);
      const body = asAdminList(res.body);

      expect(body).toMatchObject({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });
  });

  describe('2. Paginación masiva y persistencia de filtros', () => {
    beforeEach(async () => {
      const registros: Partial<ActividadFontanero>[] = [];
      for (let i = 1; i <= 25; i++) {
        registros.push({
          titulo: `Actividad Paginada #${i}`,
          fontaneroId: i <= 15 ? 'fontanero-lote-A' : 'fontanero-lote-B',
          tipoActividad: i % 2 === 0 ? tipoFugas : tipoPresion,
          fechaActividad: `2026-08-${String(i).padStart(2, '0')}`,
          estado: EstadoActividadFontanero.REPORTADA,
        });
      }
      await actividadRepo.save(registros.map((r) => actividadRepo.create(r)));
    });

    it('navega entre páginas y valida metadatos de paginación', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const p1 = await authGet(
        '/admin/actividades?page=1&limit=10',
        token,
      ).expect(200);
      const body1 = asAdminList(p1.body);
      expect(body1.total).toBe(25);
      expect(body1.totalPages).toBe(3);
      expect(body1.page).toBe(1);
      expect(body1.limit).toBe(10);
      expect(body1.data).toHaveLength(10);

      const p2 = await authGet(
        '/admin/actividades?page=2&limit=10',
        token,
      ).expect(200);
      const body2 = asAdminList(p2.body);
      expect(body2.page).toBe(2);
      expect(body2.data).toHaveLength(10);

      const p3 = await authGet(
        '/admin/actividades?page=3&limit=10',
        token,
      ).expect(200);
      const body3 = asAdminList(p3.body);
      expect(body3.page).toBe(3);
      expect(body3.data).toHaveLength(5);
    });

    it('los filtros permanecen activos al cambiar de página', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const p1 = await authGet(
        '/admin/actividades?fontaneroId=fontanero-lote-A&page=1&limit=10',
        token,
      ).expect(200);
      const body1 = asAdminList(p1.body);
      expect(body1.total).toBe(15);
      expect(body1.totalPages).toBe(2);
      expect(body1.data).toHaveLength(10);
      expect(
        body1.data.every((a) => a.fontaneroId === 'fontanero-lote-A'),
      ).toBe(true);

      const p2 = await authGet(
        '/admin/actividades?fontaneroId=fontanero-lote-A&page=2&limit=10',
        token,
      ).expect(200);
      const body2 = asAdminList(p2.body);
      expect(body2.total).toBe(15);
      expect(body2.page).toBe(2);
      expect(body2.data).toHaveLength(5);
      expect(
        body2.data.every((a) => a.fontaneroId === 'fontanero-lote-A'),
      ).toBe(true);
    });
  });

  describe('3. Detalle, revisión administrativa e integridad técnica', () => {
    let actividadTestId: number;
    const datosOriginales = {
      titulo: 'Control de Fugas Red Matriz',
      descripcion: 'Sustitución de válvula dañada',
      ubicacion: 'Calle Real 200m Sur',
      observaciones: 'Presión estabilizada tras reparación',
      fontaneroId: 'fontanero-especialista',
      fechaActividad: '2026-08-23',
      datosEspecificos: {
        ubicacionFuga: 'Cruce principal',
        materialUtilizado: 'Tubo PVC 2 pulg',
      },
    };

    beforeEach(async () => {
      const actividad = actividadRepo.create({
        ...datosOriginales,
        tipoActividad: tipoFugas,
        estado: EstadoActividadFontanero.REPORTADA,
      });
      const saved = await actividadRepo.save(actividad);
      actividadTestId = saved.id;

      await docRepo.save(
        docRepo.create({
          actividad: saved,
          nombreOriginal: 'orden-trabajo.pdf',
          tipoArchivo: 'application/pdf',
          rutaReferenciaArchivo: `uploads/actividades/${saved.id}/orden-trabajo.pdf`,
          tamanio: 2048,
        }),
      );
    });

    it('abre el detalle mostrando fontanero, tipo, fecha, observaciones, datos específicos y documentos', async () => {
      const token = signAs(Role.ADMINISTRADORA, 'admin-1');

      const res = await authGet(
        `/admin/actividades-fontanero/${actividadTestId}`,
        token,
      ).expect(200);
      const body = asAdminDetail(res.body);

      expect(body).toMatchObject({
        id: actividadTestId,
        titulo: datosOriginales.titulo,
        descripcion: datosOriginales.descripcion,
        ubicacion: datosOriginales.ubicacion,
        observaciones: datosOriginales.observaciones,
        fontaneroId: datosOriginales.fontaneroId,
        fechaActividad: datosOriginales.fechaActividad,
        tipoActividadId: tipoFugas.id,
        tipoActividadNombre: tipoFugas.nombre,
        estado: EstadoActividadFontanero.REPORTADA,
        datosEspecificos: datosOriginales.datosEspecificos,
      });

      expect(body.documentos).toHaveLength(1);
      expect(body.documentos?.[0].nombreOriginal).toBe('orden-trabajo.pdf');
    });

    it('consultar ID inexistente devuelve 404', async () => {
      const token = signAs(Role.ADMINISTRADORA);
      const res = await authGet(
        '/admin/actividades-fontanero/99999',
        token,
      ).expect(404);
      const err = asError(res.body);
      expect(err.message).toContain('Actividad no encontrada');
    });

    it('flujo de revisión: marca como REVISADA, registra fecha/usuario y preserva intactos los datos originales', async () => {
      const adminToken = signAs(Role.ADMINISTRADORA, 'admin-supervisora');

      // 1. Snapshot antes de revisar
      const antesDeRevisar = await authGet(
        `/admin/actividades-fontanero/${actividadTestId}`,
        adminToken,
      ).expect(200);
      const bodyAntes = asAdminDetail(antesDeRevisar.body);
      expect(bodyAntes.estado).toBe(EstadoActividadFontanero.REPORTADA);
      expect(bodyAntes.fechaRevision).toBeNull();
      expect(bodyAntes.revisadoPorId).toBeNull();

      // 2. Ejecutar revisión
      const revisionRes = await authPatch(
        `/admin/actividades-fontanero/${actividadTestId}/revisar`,
        { observacion: 'Revisión técnica conforme' },
        adminToken,
      ).expect(200);
      const bodyRevision = asAdminDetail(revisionRes.body);

      expect(bodyRevision.estado).toBe(EstadoActividadFontanero.REVISADA);
      expect(bodyRevision.revisadoPorId).toBe('admin-supervisora');
      expect(bodyRevision.fechaRevision).toBeDefined();
      expect(bodyRevision.observacionCorreccion).toBe(
        'Revisión técnica conforme',
      );

      // 3. Volver a consultar el detalle y comprobar persistencia
      const despuesDeRevisar = await authGet(
        `/admin/actividades-fontanero/${actividadTestId}`,
        adminToken,
      ).expect(200);
      const bodyDespues = asAdminDetail(despuesDeRevisar.body);

      expect(bodyDespues.estado).toBe(EstadoActividadFontanero.REVISADA);
      expect(bodyDespues.revisadoPorId).toBe('admin-supervisora');
      expect(bodyDespues.fechaRevision).toBe(bodyRevision.fechaRevision);

      // Comprobar que los datos técnicos originales XYZ permanecen 100% IDÉNTICOS
      expect(bodyDespues.titulo).toBe(bodyAntes.titulo);
      expect(bodyDespues.descripcion).toBe(bodyAntes.descripcion);
      expect(bodyDespues.ubicacion).toBe(bodyAntes.ubicacion);
      expect(bodyDespues.observaciones).toBe(bodyAntes.observaciones);
      expect(bodyDespues.fontaneroId).toBe(bodyAntes.fontaneroId);
      expect(bodyDespues.tipoActividadId).toBe(bodyAntes.tipoActividadId);
      expect(bodyDespues.fechaActividad).toBe(bodyAntes.fechaActividad);
      expect(bodyDespues.datosEspecificos).toEqual(bodyAntes.datosEspecificos);
      expect(bodyDespues.documentos).toEqual(bodyAntes.documentos);

      // Comprobar que no se asignó estado APROBADA ni RECHAZADA
      expect(bodyDespues.estado).not.toBe(EstadoActividadFontanero.APROBADA);
      expect(bodyDespues.estado).not.toBe(EstadoActividadFontanero.RECHAZADA);
    });

    it('rechaza con 400 Bad Request si se intenta revisar una actividad que ya fue revisada', async () => {
      const adminToken = signAs(Role.ADMINISTRADORA, 'admin-1');

      await authPatch(
        `/admin/actividades-fontanero/${actividadTestId}/revisar`,
        {},
        adminToken,
      ).expect(200);

      const repeticion = await authPatch(
        `/admin/actividades-fontanero/${actividadTestId}/revisar`,
        {},
        adminToken,
      ).expect(400);

      const err = asError(repeticion.body);
      expect(String(err.message)).toMatch(/ya (fue|ha sido) revisada/i);
    });
  });

  describe('4. Matriz de Seguridad y Control de Acceso', () => {
    let actividadId: number;

    beforeEach(async () => {
      const actividad = await actividadRepo.save(
        actividadRepo.create({
          titulo: 'Actividad para pruebas de seguridad',
          fontaneroId: 'fontanero-1',
          tipoActividad: tipoFugas,
          estado: EstadoActividadFontanero.REPORTADA,
        }),
      );
      actividadId = actividad.id;
    });

    it('deniega acceso a Fontanero en listado, detalle y revisión (403 Forbidden)', async () => {
      const fontaneroToken = signAs(Role.FONTANERO, 'fontanero-1');

      await authGet('/admin/actividades', fontaneroToken).expect(403);
      await authGet(
        `/admin/actividades-fontanero/${actividadId}`,
        fontaneroToken,
      ).expect(403);
      await authPatch(
        `/admin/actividades-fontanero/${actividadId}/revisar`,
        {},
        fontaneroToken,
      ).expect(403);
    });

    it('deniega acceso a Secretaria en listado, detalle y revisión (403 Forbidden)', async () => {
      const secretariaToken = signAs(Role.SECRETARIA, 'secretaria-1');

      await authGet('/admin/actividades', secretariaToken).expect(403);
      await authGet(
        `/admin/actividades-fontanero/${actividadId}`,
        secretariaToken,
      ).expect(403);
      await authPatch(
        `/admin/actividades-fontanero/${actividadId}/revisar`,
        {},
        secretariaToken,
      ).expect(403);
    });

    it('deniega acceso a roles no administrativos adicionales (403 Forbidden)', async () => {
      const usuarioToken = signAs('OTRO_ROL', 'usuario-sin-permiso');

      await authGet('/admin/actividades', usuarioToken).expect(403);
      await authGet(
        `/admin/actividades-fontanero/${actividadId}`,
        usuarioToken,
      ).expect(403);
      await authPatch(
        `/admin/actividades-fontanero/${actividadId}/revisar`,
        {},
        usuarioToken,
      ).expect(403);
    });

    it('deniega acceso sin iniciar sesión / sin token (401 Unauthorized)', async () => {
      await authGet('/admin/actividades').expect(401);
      await authGet(`/admin/actividades-fontanero/${actividadId}`).expect(401);
      await authPatch(
        `/admin/actividades-fontanero/${actividadId}/revisar`,
        {},
      ).expect(401);
    });

    it('deniega acceso con token inválido (401 Unauthorized)', async () => {
      const invalidToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tokenInvalido.invalido';

      await authGet('/admin/actividades', invalidToken).expect(401);
      await authGet(
        `/admin/actividades-fontanero/${actividadId}`,
        invalidToken,
      ).expect(401);
      await authPatch(
        `/admin/actividades-fontanero/${actividadId}/revisar`,
        {},
        invalidToken,
      ).expect(401);
    });

    it('deniega acceso con token vencido (401 Unauthorized)', async () => {
      const expiredToken = signAs(Role.ADMINISTRADORA, 'admin-expired', '-1s');

      await authGet('/admin/actividades', expiredToken).expect(401);
      await authGet(
        `/admin/actividades-fontanero/${actividadId}`,
        expiredToken,
      ).expect(401);
      await authPatch(
        `/admin/actividades-fontanero/${actividadId}/revisar`,
        {},
        expiredToken,
      ).expect(401);
    });
  });

  describe('5. Verificación directa en Base de Datos e Invariancia', () => {
    it('comprueba directamente en TypeORM que la revisión se persiste y no genera filas duplicadas', async () => {
      const adminToken = signAs(Role.ADMINISTRADORA, 'admin-db-audit');

      const creada = await actividadRepo.save(
        actividadRepo.create({
          titulo: 'Actividad auditoría DB',
          fontaneroId: 'fontanero-db',
          tipoActividad: tipoFugas,
          fechaActividad: '2026-08-23',
          estado: EstadoActividadFontanero.REPORTADA,
        }),
      );

      const conteoInicial = await actividadRepo.count();

      await authGet(
        `/admin/actividades-fontanero/${creada.id}`,
        adminToken,
      ).expect(200);
      const conteoTrasConsulta = await actividadRepo.count();
      expect(conteoTrasConsulta).toBe(conteoInicial);

      await authPatch(
        `/admin/actividades-fontanero/${creada.id}/revisar`,
        {},
        adminToken,
      ).expect(200);
      const conteoTrasRevision = await actividadRepo.count();

      expect(conteoTrasRevision).toBe(conteoInicial);

      const enBaseDeDatos = await actividadRepo.findOneOrFail({
        where: { id: creada.id },
        relations: { tipoActividad: true },
      });

      expect(enBaseDeDatos.estado).toBe(EstadoActividadFontanero.REVISADA);
      expect(enBaseDeDatos.revisadoPorId).toBe('admin-db-audit');
      expect(enBaseDeDatos.fechaRevision).toBeInstanceOf(Date);
      expect(enBaseDeDatos.titulo).toBe('Actividad auditoría DB');
      expect(enBaseDeDatos.fontaneroId).toBe('fontanero-db');
      expect(enBaseDeDatos.tipoActividad?.id).toBe(tipoFugas.id);
    });
  });
});
