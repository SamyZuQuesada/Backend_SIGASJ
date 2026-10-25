import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { EstadoSolicitudAusencia } from '../../common/enums/estado-solicitud-ausencia.enum';
import { TipoMovimientoVacaciones } from '../../common/enums/tipo-movimiento-vacaciones.enum';
import { TipoSolicitudAusencia } from '../../common/enums/tipo-solicitud-ausencia.enum';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import jotformConfig from '../../config/jotform.config';
import { AuthModule } from '../auth/auth.module';
import { Averia } from '../averias/entities/averia.entity';
import { ObservacionAveria } from '../averias/entities/observacion-averia.entity';
import { IntentoSmsAveria } from '../notificaciones/entities/intento-sms-averia.entity';
import { NotificacionAveria } from '../notificaciones/entities/notificacion-averia.entity';
import { TipoNotificacionAveria } from '../../common/enums/tipo-notificacion-averia.enum';
import { Colaborador } from '../recursos-humanos/entities/colaborador.entity';
import { Incapacidad } from '../recursos-humanos/entities/incapacidad.entity';
import { MovimientoVacaciones } from '../recursos-humanos/entities/movimiento-vacaciones.entity';
import { PermisoColaborador } from '../recursos-humanos/entities/permiso-colaborador.entity';
import { Puesto } from '../recursos-humanos/entities/puesto.entity';
import { RecursosHumanosModule } from '../recursos-humanos/recursos-humanos.module';
import { Rol } from '../usuarios/entities/rol.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CorrelacionSolicitudAusencia } from './entities/correlacion-solicitud-ausencia.entity';
import { SolicitudAusencia } from './entities/solicitud-ausencia.entity';
import { SolicitudesAusenciaModule } from './solicitudes-ausencia.module';

const WEBHOOK = '/api/v1/integraciones/jotform/ausencias';
const RRHH = '/api/v1/rrhh/solicitudes-ausencia';
const FONTANERO = '/api/v1/fontanero/solicitudes-ausencia';
const FORM_ID = 'form-test';

type WebhookBody = {
  id: number;
  estado: string;
  creada: boolean;
  jotformSubmissionId: string;
};

type CorrelacionBody = { token: string };

type DetalleSolicitudBody = {
  jotformSubmissionId: string;
  registroGeneradoTipo: string | null;
  registroGeneradoId: number | null;
};

type FontaneroSolicitudBody = {
  id: number;
  tipo: string;
  fechaInicio: string;
  fechaFin: string;
  motivo: string | null;
  correoNotificacion: string | null;
  observaciones: string | null;
  estado: string;
  motivoRechazo: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  jotformSubmissionId?: string;
  colaboradorId?: number;
  reviewedByUsuarioId?: number;
  registroGeneradoId?: number;
};

describe('SolicitudesAusencia (épica 6.5)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let colaboradorRepo: Repository<Colaborador>;
  let usuarioRepo: Repository<Usuario>;
  let rolRepo: Repository<Rol>;
  let permisoRepo: Repository<PermisoColaborador>;
  let movimientoRepo: Repository<MovimientoVacaciones>;
  let solicitudRepo: Repository<SolicitudAusencia>;
  let correlacionRepo: Repository<CorrelacionSolicitudAusencia>;
  let notificacionRepo: Repository<NotificacionAveria>;

  const signAs = (role: Role, sub: number | string = 1) => {
    const payload: JwtPayload = {
      sub,
      email: `${role.toLowerCase()}@asadasanjuan.cr`,
      role,
      name: `Usuario ${role}`,
    };
    return jwtService.sign(payload);
  };

  beforeAll(async () => {
    process.env.JOTFORM_WEBHOOK_SECRET = 'test-secret';
    process.env.JOTFORM_FORM_ID = FORM_ID;
    process.env.JOTFORM_VERIFY_SUBMISSION = 'false';
    process.env.JOTFORM_API_KEY = 'test-api-key-backend-only';

    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig, jotformConfig],
        }),
        TypeOrmModule.forRoot({
          type: 'sqljs',
          autoSave: false,
          dropSchema: true,
          entities: [
            Colaborador,
            PermisoColaborador,
            MovimientoVacaciones,
            Incapacidad,
            Puesto,
            Usuario,
            Rol,
            SolicitudAusencia,
            CorrelacionSolicitudAusencia,
            Averia,
            ObservacionAveria,
            NotificacionAveria,
            IntentoSmsAveria,
          ],
          synchronize: true,
        }),
        AuthModule,
        RecursosHumanosModule,
        SolicitudesAusenciaModule,
      ],
      providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
    }).compile();

    app = moduleFixture.createNestApplication<INestApplication<App>>();
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
    colaboradorRepo = moduleFixture.get(getRepositoryToken(Colaborador));
    usuarioRepo = moduleFixture.get(getRepositoryToken(Usuario));
    rolRepo = moduleFixture.get(getRepositoryToken(Rol));
    permisoRepo = moduleFixture.get(getRepositoryToken(PermisoColaborador));
    movimientoRepo = moduleFixture.get(
      getRepositoryToken(MovimientoVacaciones),
    );
    solicitudRepo = moduleFixture.get(getRepositoryToken(SolicitudAusencia));
    correlacionRepo = moduleFixture.get(
      getRepositoryToken(CorrelacionSolicitudAusencia),
    );
    notificacionRepo = moduleFixture.get(
      getRepositoryToken(NotificacionAveria),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await notificacionRepo.clear();
    await correlacionRepo.clear();
    await solicitudRepo.clear();
    await movimientoRepo.clear();
    await permisoRepo.clear();
    await colaboradorRepo.clear();
    await usuarioRepo.clear();
    await rolRepo.clear();
  });

  const crearFontaneroVinculado = async () => {
    let rol = await rolRepo.findOneBy({ nombre: Role.FONTANERO });
    rol ??= await rolRepo.save(rolRepo.create({ nombre: Role.FONTANERO }));
    const usuario = await usuarioRepo.save(
      usuarioRepo.create({
        nombre: 'Fontanero',
        correo: `f.${Date.now()}@asadasanjuan.cr`,
        passwordHash: 'x',
        activo: true,
        idRol: rol.idRol,
      }),
    );
    const colaborador = await colaboradorRepo.save(
      colaboradorRepo.create({
        nombre: 'Juan',
        apellidos: 'Fontanero',
        cedula: `1-${String(usuario.idUsuario).padStart(4, '0')}-1111`,
        correoElectronico: usuario.correo,
        cargo: 'Fontanero',
        activo: true,
        usuarioId: usuario.idUsuario,
      }),
    );
    return {
      usuario,
      colaborador,
      token: signAs(Role.FONTANERO, usuario.idUsuario),
    };
  };

  const emitirCorrelacion = async (fontaneroToken: string) => {
    const res = await request(app.getHttpServer())
      .post(`${RRHH}/correlacion`)
      .set('Authorization', `Bearer ${fontaneroToken}`)
      .expect(201);
    return (res.body as CorrelacionBody).token;
  };

  const asWebhook = (body: unknown): WebhookBody => body as WebhookBody;

  const webhook = (body: Record<string, unknown>, key = 'test-secret') =>
    request(app.getHttpServer()).post(`${WEBHOOK}?key=${key}`).send(body);

  const payloadBase = (
    correlacionToken: string,
    extras: Record<string, unknown> = {},
  ) => ({
    formId: FORM_ID,
    correlacionToken,
    tipo: 'PERMISO',
    fechaInicio: '2026-11-01',
    fechaFin: '2026-11-02',
    motivo: 'Trámite',
    ...extras,
  });

  describe('Webhook PBI 6.5.2', () => {
    it('POST /api/v1/integraciones/jotform/ausencias crea PERMISO PENDIENTE', async () => {
      const { colaborador, token } = await crearFontaneroVinculado();
      const correlacion = await emitirCorrelacion(token);

      const res = await webhook(
        payloadBase(correlacion, {
          jotformSubmissionId: 'sub-perm-1',
          tipo: 'PERMISO',
          motivo: 'Trámite personal',
        }),
      ).expect(200);

      const body = asWebhook(res.body);
      expect(body.creada).toBe(true);
      expect(body.estado).toBe(EstadoSolicitudAusencia.PENDIENTE);
      expect(body.jotformSubmissionId).toBe('sub-perm-1');
      expect(await permisoRepo.count()).toBe(0);
      expect(await movimientoRepo.count()).toBe(0);
      const sol = await solicitudRepo.findOneByOrFail({ id: body.id });
      expect(sol.colaboradorId).toBe(colaborador.id);
      expect(sol.tipo).toBe(TipoSolicitudAusencia.PERMISO);
      expect(sol.estado).toBe(EstadoSolicitudAusencia.PENDIENTE);
      expect(sol.observaciones).toBeNull();
      expect(sol.reviewedByUsuarioId).toBeNull();
    });

    it('crea VACACIONES PENDIENTE sin crear MovimientoVacaciones ni descontar saldo', async () => {
      const { colaborador, token } = await crearFontaneroVinculado();
      await movimientoRepo.save(
        movimientoRepo.create({
          colaboradorId: colaborador.id,
          tipo: TipoMovimientoVacaciones.ACUMULADO,
          cantidadDias: 10,
          fecha: '2026-01-01',
          observaciones: null,
        }),
      );
      const correlacion = await emitirCorrelacion(token);

      const res = await webhook(
        payloadBase(correlacion, {
          jotformSubmissionId: 'sub-vac-1',
          tipo: 'Vacaciones',
          fechaInicio: '2026-12-01',
          fechaFin: '2026-12-05',
          motivo: 'Semana santa anticipada',
        }),
      ).expect(200);

      const body = asWebhook(res.body);
      expect(body.creada).toBe(true);
      expect(await movimientoRepo.count()).toBe(1);
      const sol = await solicitudRepo.findOneByOrFail({ id: body.id });
      expect(sol.tipo).toBe(TipoSolicitudAusencia.VACACIONES);
      expect(sol.colaboradorId).toBe(colaborador.id);
      expect(sol.fechaInicio).toBe('2026-12-01');
      expect(sol.fechaFin).toBe('2026-12-05');
      expect(sol.motivo).toBe('Semana santa anticipada');
      expect(sol.estado).toBe(EstadoSolicitudAusencia.PENDIENTE);
    });

    it('rechaza secreto inválido y no persiste (401)', async () => {
      await webhook(
        payloadBase('t', { jotformSubmissionId: 'sub-auth' }),
        'wrong',
      ).expect(401);
      expect(await solicitudRepo.count()).toBe(0);
    });

    it('rechaza formId de otro formulario (400)', async () => {
      const { token } = await crearFontaneroVinculado();
      const correlacion = await emitirCorrelacion(token);
      await webhook(
        payloadBase(correlacion, {
          jotformSubmissionId: 'sub-other-form',
          formId: 'formulario-ajeno',
        }),
      ).expect(400);
      expect(await solicitudRepo.count()).toBe(0);
    });

    it('submission duplicada es idempotente (una sola solicitud)', async () => {
      const { token } = await crearFontaneroVinculado();
      const correlacion = await emitirCorrelacion(token);
      const body = payloadBase(correlacion, {
        jotformSubmissionId: 'sub-dup',
        motivo: 'x',
      });
      const a = asWebhook((await webhook(body).expect(200)).body);
      const b = asWebhook((await webhook(body).expect(200)).body);
      expect(a.id).toBe(b.id);
      expect(b.creada).toBe(false);
      expect(await solicitudRepo.count()).toBe(1);
    });

    it('concurrencia con el mismo submissionID deja una sola fila', async () => {
      const a = await crearFontaneroVinculado();
      const b = await crearFontaneroVinculado();
      const tokenA = await emitirCorrelacion(a.token);
      const tokenB = await emitirCorrelacion(b.token);
      const submission = 'sub-concurrent';

      const [ra, rb] = await Promise.all([
        webhook(payloadBase(tokenA, { jotformSubmissionId: submission })),
        webhook(payloadBase(tokenB, { jotformSubmissionId: submission })),
      ]);

      expect([ra.status, rb.status].every((s) => s === 200)).toBe(true);
      expect(await solicitudRepo.count()).toBe(1);
      const ids = [asWebhook(ra.body).id, asWebhook(rb.body).id];
      expect(ids[0]).toBe(ids[1]);
    });

    it('ignora colaboradorId editable del payload (identidad por correlación)', async () => {
      const victima = await crearFontaneroVinculado();
      const real = await crearFontaneroVinculado();
      const correlacion = await emitirCorrelacion(real.token);

      const res = await webhook(
        payloadBase(correlacion, {
          jotformSubmissionId: 'sub-spoof',
          colaboradorId: victima.colaborador.id,
        }),
      ).expect(200);

      const sol = await solicitudRepo.findOneByOrFail({
        id: asWebhook(res.body).id,
      });
      expect(sol.colaboradorId).toBe(real.colaborador.id);
      expect(sol.colaboradorId).not.toBe(victima.colaborador.id);
    });

    it('rechaza colaborador no resoluble / token inválido (400)', async () => {
      await webhook(
        payloadBase('token-inexistente', {
          jotformSubmissionId: 'sub-no-token',
        }),
      ).expect(400);
      expect(await solicitudRepo.count()).toBe(0);
    });

    it('rechaza tipo INCAPACIDAD (400)', async () => {
      const { token } = await crearFontaneroVinculado();
      const correlacion = await emitirCorrelacion(token);
      await webhook(
        payloadBase(correlacion, {
          jotformSubmissionId: 'sub-bad-tipo',
          tipo: 'INCAPACIDAD',
        }),
      ).expect(400);
      expect(await solicitudRepo.count()).toBe(0);
    });

    it('rechaza fechas inválidas o incompletas (400)', async () => {
      const { token } = await crearFontaneroVinculado();
      const correlacion = await emitirCorrelacion(token);
      await webhook(
        payloadBase(correlacion, {
          jotformSubmissionId: 'sub-bad-fecha',
          fechaInicio: '2026-11-10',
          fechaFin: '2026-11-01',
        }),
      ).expect(400);
      await webhook(
        payloadBase(correlacion, {
          jotformSubmissionId: 'sub-no-inicio',
          fechaInicio: '',
        }),
      ).expect(400);
      expect(await solicitudRepo.count()).toBe(0);
    });

    it('payload incompleto (400)', async () => {
      await webhook({ jotformSubmissionId: 'x', formId: FORM_ID }).expect(400);
    });
  });

  describe('PBI 6.5.4 — API Admin listar / aprobar / rechazar', () => {
    type ListadoBody = {
      data: Array<{
        id: number;
        estado: string;
        colaboradorId: number;
        tipo: string;
      }>;
      total: number;
      page: number;
      limit: number;
    };

    const crearAdmin = async () => {
      let rol = await rolRepo.findOneBy({ nombre: Role.ADMINISTRADORA });
      rol ??= await rolRepo.save(
        rolRepo.create({ nombre: Role.ADMINISTRADORA }),
      );
      const usuario = await usuarioRepo.save(
        usuarioRepo.create({
          nombre: 'Administradora',
          correo: `admin.${Date.now()}@asadasanjuan.cr`,
          passwordHash: 'x',
          activo: true,
          idRol: rol.idRol,
        }),
      );
      return {
        token: signAs(Role.ADMINISTRADORA, usuario.idUsuario),
        usuarioId: usuario.idUsuario,
      };
    };

    const crearSolicitudDirecta = async (
      colaboradorId: number,
      submissionId: string,
      extras: Partial<SolicitudAusencia> = {},
    ) =>
      solicitudRepo.save(
        solicitudRepo.create({
          colaboradorId,
          tipo: TipoSolicitudAusencia.PERMISO,
          fechaInicio: '2026-11-01',
          fechaFin: '2026-11-02',
          motivo: 'Trámite',
          observaciones: null,
          estado: EstadoSolicitudAusencia.PENDIENTE,
          jotformSubmissionId: submissionId,
          reviewedAt: null,
          reviewedByUsuarioId: null,
          motivoRechazo: null,
          registroGeneradoId: null,
          registroGeneradoTipo: null,
          ...extras,
        }),
      );

    const aprobar = (id: number, token: string) =>
      request(app.getHttpServer())
        .patch(`${RRHH}/${id}/aprobar`)
        .set('Authorization', `Bearer ${token}`);

    const rechazar = (
      id: number,
      token: string,
      body: Record<string, unknown> = {},
    ) =>
      request(app.getHttpServer())
        .patch(`${RRHH}/${id}/rechazar`)
        .set('Authorization', `Bearer ${token}`)
        .send(body);

    it('listado con filtros estado + colaboradorId (AND) y paginación', async () => {
      const a = await crearFontaneroVinculado();
      const b = await crearFontaneroVinculado();
      const pA = await crearSolicitudDirecta(a.colaborador.id, 'list-pa');
      await crearSolicitudDirecta(a.colaborador.id, 'list-aa', {
        estado: EstadoSolicitudAusencia.APROBADA,
      });
      await crearSolicitudDirecta(a.colaborador.id, 'list-ra', {
        estado: EstadoSolicitudAusencia.RECHAZADA,
      });
      await crearSolicitudDirecta(b.colaborador.id, 'list-pb');

      const { token } = await crearAdmin();
      const all = await request(app.getHttpServer())
        .get(RRHH)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((all.body as ListadoBody).total).toBe(4);

      const pend = await request(app.getHttpServer())
        .get(`${RRHH}?estado=PENDIENTE`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const pendBody = pend.body as ListadoBody;
      expect(pendBody.total).toBe(2);
      expect(pendBody.data.every((s) => s.estado === 'PENDIENTE')).toBe(true);

      const apro = await request(app.getHttpServer())
        .get(`${RRHH}?estado=APROBADA`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((apro.body as ListadoBody).total).toBe(1);

      const rej = await request(app.getHttpServer())
        .get(`${RRHH}?estado=RECHAZADA`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((rej.body as ListadoBody).total).toBe(1);

      const porColab = await request(app.getHttpServer())
        .get(`${RRHH}?colaboradorId=${a.colaborador.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect((porColab.body as ListadoBody).total).toBe(3);

      const and = await request(app.getHttpServer())
        .get(`${RRHH}?estado=PENDIENTE&colaboradorId=${a.colaborador.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const andBody = and.body as ListadoBody;
      expect(andBody.total).toBe(1);
      expect(andBody.data[0].id).toBe(pA.id);

      await request(app.getHttpServer())
        .get(`${RRHH}?estado=INVALIDO`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      await request(app.getHttpServer())
        .get(`${RRHH}?colaboradorId=999999`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect((res.body as ListadoBody).data).toEqual([]);
          expect((res.body as ListadoBody).total).toBe(0);
        });
    });

    it('aprobar PERMISO: 1 PermisoColaborador, review data, doble aprobación 409', async () => {
      const { colaborador, token } = await crearFontaneroVinculado();
      const correlacion = await emitirCorrelacion(token);
      const created = asWebhook(
        (
          await webhook(
            payloadBase(correlacion, {
              jotformSubmissionId: 'sub-ap-perm',
              motivo: 'Trámite',
            }),
          ).expect(200)
        ).body,
      );

      const admin = await crearAdmin();
      const res = await aprobar(created.id, admin.token).expect(200);
      expect(res.body).toMatchObject({
        id: created.id,
        estado: EstadoSolicitudAusencia.APROBADA,
      });

      expect(await permisoRepo.count()).toBe(1);
      const permiso = await permisoRepo.findOneByOrFail({
        colaboradorId: colaborador.id,
      });
      expect(permiso.fechaInicio).toBe('2026-11-01');
      expect(permiso.fechaFin).toBe('2026-11-02');

      const sol = await solicitudRepo.findOneByOrFail({ id: created.id });
      expect(sol.estado).toBe(EstadoSolicitudAusencia.APROBADA);
      expect(sol.reviewedByUsuarioId).toBe(admin.usuarioId);
      expect(sol.reviewedAt).toBeTruthy();
      expect(sol.registroGeneradoId).toBe(permiso.id);

      await aprobar(created.id, admin.token).expect(409);
      expect(await permisoRepo.count()).toBe(1);
    });

    it('aprobar VACACIONES: 1 DISFRUTADO y saldo afectado; doble 409', async () => {
      const { colaborador, token } = await crearFontaneroVinculado();
      await movimientoRepo.save(
        movimientoRepo.create({
          colaboradorId: colaborador.id,
          tipo: TipoMovimientoVacaciones.ACUMULADO,
          cantidadDias: 10,
          fecha: '2026-01-01',
          observaciones: null,
        }),
      );
      const correlacion = await emitirCorrelacion(token);
      const created = asWebhook(
        (
          await webhook(
            payloadBase(correlacion, {
              jotformSubmissionId: 'sub-ap-vac',
              tipo: 'VACACIONES',
              // 1 dic es feriado CR → 5 calendario − 1 feriado = 4 netos
              fechaInicio: '2026-12-01',
              fechaFin: '2026-12-05',
              motivo: 'Vacaciones',
            }),
          ).expect(200)
        ).body,
      );

      const { token: adminToken } = await crearAdmin();
      await aprobar(created.id, adminToken).expect(200);

      const disfrutados = await movimientoRepo.find({
        where: { tipo: TipoMovimientoVacaciones.DISFRUTADO },
      });
      expect(disfrutados).toHaveLength(1);
      expect(disfrutados[0].cantidadDias).toBe(4);
      expect(disfrutados[0].colaboradorId).toBe(colaborador.id);

      await aprobar(created.id, adminToken).expect(409);
      expect(
        await movimientoRepo.count({
          where: { tipo: TipoMovimientoVacaciones.DISFRUTADO },
        }),
      ).toBe(1);
    });

    it('vacaciones sin saldo: 400, sigue PENDIENTE, sin movimiento', async () => {
      const { colaborador } = await crearFontaneroVinculado();
      const sol = await crearSolicitudDirecta(colaborador.id, 'sub-no-saldo', {
        tipo: TipoSolicitudAusencia.VACACIONES,
        fechaInicio: '2026-12-01',
        fechaFin: '2026-12-05',
        motivo: 'Sin saldo',
      });

      const { token } = await crearAdmin();
      await aprobar(sol.id, token).expect(400);

      const actual = await solicitudRepo.findOneByOrFail({ id: sol.id });
      expect(actual.estado).toBe(EstadoSolicitudAusencia.PENDIENTE);
      expect(actual.reviewedAt).toBeNull();
      expect(await movimientoRepo.count()).toBe(0);
    });

    it('rechazar PERMISO y VACACIONES: sin RRHH; doble rechazo 409', async () => {
      const a = await crearFontaneroVinculado();
      const b = await crearFontaneroVinculado();
      await movimientoRepo.save(
        movimientoRepo.create({
          colaboradorId: b.colaborador.id,
          tipo: TipoMovimientoVacaciones.ACUMULADO,
          cantidadDias: 10,
          fecha: '2026-01-01',
          observaciones: null,
        }),
      );
      const perm = await crearSolicitudDirecta(a.colaborador.id, 'rej-perm');
      const vac = await crearSolicitudDirecta(b.colaborador.id, 'rej-vac', {
        tipo: TipoSolicitudAusencia.VACACIONES,
        fechaInicio: '2026-12-01',
        fechaFin: '2026-12-03',
      });

      const { token } = await crearAdmin();
      await rechazar(perm.id, token, { motivoRechazo: 'Sin cobertura' }).expect(
        200,
      );
      expect(await permisoRepo.count()).toBe(0);
      const permSol = await solicitudRepo.findOneByOrFail({ id: perm.id });
      expect(permSol.estado).toBe(EstadoSolicitudAusencia.RECHAZADA);
      expect(permSol.motivoRechazo).toBe('Sin cobertura');

      await rechazar(vac.id, token).expect(200);
      expect(
        await movimientoRepo.count({
          where: { tipo: TipoMovimientoVacaciones.DISFRUTADO },
        }),
      ).toBe(0);
      expect(
        (
          await movimientoRepo.findOneByOrFail({
            colaboradorId: b.colaborador.id,
            tipo: TipoMovimientoVacaciones.ACUMULADO,
          })
        ).cantidadDias,
      ).toBe(10);

      await rechazar(perm.id, token).expect(409);
      await aprobar(perm.id, token).expect(409);
    });

    it('no rechazar APROBADA (409) y RRHH intacto', async () => {
      const { colaborador } = await crearFontaneroVinculado();
      const sol = await crearSolicitudDirecta(colaborador.id, 'no-rej-aprob');
      const { token } = await crearAdmin();
      await aprobar(sol.id, token).expect(200);
      expect(await permisoRepo.count()).toBe(1);

      await rechazar(sol.id, token, { motivoRechazo: 'tarde' }).expect(409);
      expect(await permisoRepo.count()).toBe(1);
      const actual = await solicitudRepo.findOneByOrFail({ id: sol.id });
      expect(actual.estado).toBe(EstadoSolicitudAusencia.APROBADA);
    });

    it('no aprobar RECHAZADA (409) y sin RRHH', async () => {
      const { colaborador } = await crearFontaneroVinculado();
      const sol = await crearSolicitudDirecta(colaborador.id, 'no-apr-rech', {
        estado: EstadoSolicitudAusencia.RECHAZADA,
        motivoRechazo: 'Sin cobertura',
        reviewedAt: new Date(),
      });
      const { token } = await crearAdmin();

      await aprobar(sol.id, token).expect(409);
      expect(await permisoRepo.count()).toBe(0);
      const actual = await solicitudRepo.findOneByOrFail({ id: sol.id });
      expect(actual.estado).toBe(EstadoSolicitudAusencia.RECHAZADA);
    });

    it('concurrencia: dos PATCH aprobar → 1 RRHH', async () => {
      const { colaborador } = await crearFontaneroVinculado();
      const sol = await crearSolicitudDirecta(colaborador.id, 'conc-ap');
      const { token } = await crearAdmin();

      const [r1, r2] = await Promise.all([
        aprobar(sol.id, token),
        aprobar(sol.id, token),
      ]);
      const statuses = [r1.status, r2.status].sort();
      expect(statuses).toEqual([200, 409]);
      expect(await permisoRepo.count()).toBe(1);
      const actual = await solicitudRepo.findOneByOrFail({ id: sol.id });
      expect(actual.estado).toBe(EstadoSolicitudAusencia.APROBADA);
    });

    it('sin JWT: 401 en listado, aprobar y rechazar', async () => {
      await request(app.getHttpServer()).get(RRHH).expect(401);
      await request(app.getHttpServer()).patch(`${RRHH}/1/aprobar`).expect(401);
      await request(app.getHttpServer())
        .patch(`${RRHH}/1/rechazar`)
        .expect(401);
    });

    it('FONTANERO y SECRETARIA: 403 en listado/detalle/aprobar/rechazar', async () => {
      const { colaborador, token: fontToken } = await crearFontaneroVinculado();
      const sol = await crearSolicitudDirecta(colaborador.id, 'rol-403');

      let rolSec = await rolRepo.findOneBy({ nombre: Role.SECRETARIA });
      rolSec ??= await rolRepo.save(
        rolRepo.create({ nombre: Role.SECRETARIA }),
      );
      const secre = await usuarioRepo.save(
        usuarioRepo.create({
          nombre: 'Secretaria',
          correo: `sec.${Date.now()}@asadasanjuan.cr`,
          passwordHash: 'x',
          activo: true,
          idRol: rolSec.idRol,
        }),
      );
      const secToken = signAs(Role.SECRETARIA, secre.idUsuario);

      for (const token of [fontToken, secToken]) {
        await request(app.getHttpServer())
          .get(RRHH)
          .set('Authorization', `Bearer ${token}`)
          .expect(403);
        await request(app.getHttpServer())
          .get(`${RRHH}/${sol.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(403);
        await aprobar(sol.id, token).expect(403);
        await rechazar(sol.id, token).expect(403);
      }
      expect((await solicitudRepo.findOneByOrFail({ id: sol.id })).estado).toBe(
        EstadoSolicitudAusencia.PENDIENTE,
      );
    });

    it('ADMINISTRADORA accede a listado / aprobar / rechazar', async () => {
      const { colaborador } = await crearFontaneroVinculado();
      const a = await crearSolicitudDirecta(colaborador.id, 'admin-ok-a');
      const b = await crearSolicitudDirecta(colaborador.id, 'admin-ok-b');
      const { token } = await crearAdmin();

      await request(app.getHttpServer())
        .get(RRHH)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      await aprobar(a.id, token).expect(200);
      await rechazar(b.id, token, { motivoRechazo: 'No' }).expect(200);
    });

    it('solicitud inexistente: 404 al aprobar/rechazar', async () => {
      const { token } = await crearAdmin();
      await aprobar(999999, token).expect(404);
      await rechazar(999999, token).expect(404);
    });

    it('trazabilidad submission → solicitud → permiso', async () => {
      const { token } = await crearFontaneroVinculado();
      const correlacion = await emitirCorrelacion(token);
      const created = asWebhook(
        (
          await webhook(
            payloadBase(correlacion, {
              jotformSubmissionId: 'sub-trace',
              fechaFin: '2026-11-01',
              motivo: 'Día',
            }),
          ).expect(200)
        ).body,
      );

      const { token: adminToken } = await crearAdmin();
      await aprobar(created.id, adminToken).expect(200);

      const detalleRes = await request(app.getHttpServer())
        .get(`${RRHH}/${created.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const detalle = detalleRes.body as DetalleSolicitudBody;

      expect(detalle.jotformSubmissionId).toBe('sub-trace');
      expect(detalle.registroGeneradoTipo).toBe('PERMISO');
      expect(detalle.registroGeneradoId).toBeTruthy();
      expect(
        await permisoRepo.findOneBy({ id: detalle.registroGeneradoId! }),
      ).toBeTruthy();
    });
  });

  describe('PBI 6.5.3 / alta nativa Fontanero', () => {
    it('POST crea PERMISO PENDIENTE por JWT y sin RRHH', async () => {
      const { colaborador, token } = await crearFontaneroVinculado();

      const res = await request(app.getHttpServer())
        .post(FONTANERO)
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipo: 'PERMISO',
          fechaInicio: '2026-11-10',
          fechaFin: '2026-11-11',
          correo: 'aviso.fontanero@asadasanjuan.cr',
          motivo: 'Cita médica',
        })
        .expect(201);

      const body = res.body as FontaneroSolicitudBody;
      expect(body.estado).toBe(EstadoSolicitudAusencia.PENDIENTE);
      expect(body.tipo).toBe(TipoSolicitudAusencia.PERMISO);
      expect(body.motivo).toBe('Cita médica');
      expect(body.correoNotificacion).toBe('aviso.fontanero@asadasanjuan.cr');
      expect(body).not.toHaveProperty('colaboradorId');

      const guardada = await solicitudRepo.findOneByOrFail({ id: body.id });
      expect(guardada.colaboradorId).toBe(colaborador.id);
      expect(guardada.correoNotificacion).toBe(
        'aviso.fontanero@asadasanjuan.cr',
      );
      expect(guardada.jotformSubmissionId.startsWith('sigasj-')).toBe(true);
      expect(await permisoRepo.count()).toBe(0);
      expect(await movimientoRepo.count()).toBe(0);
    });

    it('POST notifica en campana a Administradoras activas', async () => {
      let rolAdmin = await rolRepo.findOneBy({ nombre: Role.ADMINISTRADORA });
      rolAdmin ??= await rolRepo.save(
        rolRepo.create({ nombre: Role.ADMINISTRADORA }),
      );
      const admin = await usuarioRepo.save(
        usuarioRepo.create({
          nombre: 'Admin',
          correo: `admin.campana.${Date.now()}@asadasanjuan.cr`,
          passwordHash: 'x',
          activo: true,
          idRol: rolAdmin.idRol,
        }),
      );
      const adminInactiva = await usuarioRepo.save(
        usuarioRepo.create({
          nombre: 'Admin off',
          correo: `admin.off.${Date.now()}@asadasanjuan.cr`,
          passwordHash: 'x',
          activo: false,
          idRol: rolAdmin.idRol,
        }),
      );
      const { token } = await crearFontaneroVinculado();

      const res = await request(app.getHttpServer())
        .post(FONTANERO)
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipo: 'VACACIONES',
          fechaInicio: '2026-12-01',
          fechaFin: '2026-12-05',
          correo: 'aviso@asadasanjuan.cr',
          motivo: 'Descanso',
        })
        .expect(201);

      const body = res.body as FontaneroSolicitudBody;
      const filas = await notificacionRepo.find();
      expect(filas).toHaveLength(1);
      expect(filas[0]?.idUsuarioDestinatario).toBe(admin.idUsuario);
      expect(filas[0]?.idSolicitudAusencia).toBe(body.id);
      expect(filas[0]?.idAveria).toBeNull();
      expect(filas[0]?.tipo).toBe(
        TipoNotificacionAveria.SOLICITUD_AUSENCIA_PENDIENTE_ADMINISTRADORA,
      );
      expect(filas[0]?.leida).toBe(false);
      expect(
        filas.some(
          (row) => row.idUsuarioDestinatario === adminInactiva.idUsuario,
        ),
      ).toBe(false);
    });

    it('POST acepta varios correos de aviso', async () => {
      const { token } = await crearFontaneroVinculado();

      const res = await request(app.getHttpServer())
        .post(FONTANERO)
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipo: 'PERMISO',
          fechaInicio: '2026-11-10',
          fechaFin: '2026-11-11',
          correo: 'aviso@asadasanjuan.cr, jefe@asadasanjuan.cr',
          motivo: 'Cita médica',
        })
        .expect(201);

      const body = res.body as FontaneroSolicitudBody;
      expect(body.correoNotificacion).toBe(
        'aviso@asadasanjuan.cr, jefe@asadasanjuan.cr',
      );
    });

    it('POST con un correo inválido en la lista: 400', async () => {
      const { token } = await crearFontaneroVinculado();

      await request(app.getHttpServer())
        .post(FONTANERO)
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipo: 'PERMISO',
          fechaInicio: '2026-11-10',
          fechaFin: '2026-11-11',
          correo: 'aviso@asadasanjuan.cr, no-es-correo',
          motivo: 'Cita médica',
        })
        .expect(400);

      expect(await solicitudRepo.count()).toBe(0);
    });

    it('POST sin correo: 400', async () => {
      const { token } = await crearFontaneroVinculado();

      await request(app.getHttpServer())
        .post(FONTANERO)
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipo: 'PERMISO',
          fechaInicio: '2026-11-10',
          fechaFin: '2026-11-11',
          motivo: 'Cita médica',
        })
        .expect(400);

      expect(await solicitudRepo.count()).toBe(0);
    });

    it('POST rechaza colaboradorId del cliente (forbidNonWhitelisted)', async () => {
      const { token } = await crearFontaneroVinculado();

      await request(app.getHttpServer())
        .post(FONTANERO)
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipo: 'PERMISO',
          fechaInicio: '2026-11-10',
          fechaFin: '2026-11-11',
          correo: 'aviso@asadasanjuan.cr',
          motivo: 'Cita',
          colaboradorId: 999999,
        })
        .expect(400);

      expect(await solicitudRepo.count()).toBe(0);
    });

    it('POST FONTANERO sin Colaborador: 403', async () => {
      let rol = await rolRepo.findOneBy({ nombre: Role.FONTANERO });
      rol ??= await rolRepo.save(rolRepo.create({ nombre: Role.FONTANERO }));
      const usuario = await usuarioRepo.save(
        usuarioRepo.create({
          nombre: 'Sin vínculo',
          correo: `sincol.${Date.now()}@asadasanjuan.cr`,
          passwordHash: 'x',
          activo: true,
          idRol: rol.idRol,
        }),
      );
      const token = signAs(Role.FONTANERO, usuario.idUsuario);

      await request(app.getHttpServer())
        .post(FONTANERO)
        .set('Authorization', `Bearer ${token}`)
        .send({
          tipo: 'PERMISO',
          fechaInicio: '2026-11-10',
          fechaFin: '2026-11-11',
          correo: 'aviso@asadasanjuan.cr',
          motivo: 'Prueba',
        })
        .expect(403);

      expect(await solicitudRepo.count()).toBe(0);
    });
  });

  describe('PBI 6.5.3 — API Fontanero consulta', () => {
    const crearSolicitud = async (
      colaboradorId: number,
      submissionId: string,
      extras: Partial<SolicitudAusencia> = {},
    ) =>
      solicitudRepo.save(
        solicitudRepo.create({
          colaboradorId,
          tipo: TipoSolicitudAusencia.PERMISO,
          fechaInicio: '2026-11-01',
          fechaFin: '2026-11-02',
          motivo: 'Trámite',
          observaciones: null,
          estado: EstadoSolicitudAusencia.PENDIENTE,
          jotformSubmissionId: submissionId,
          reviewedAt: null,
          reviewedByUsuarioId: null,
          motivoRechazo: null,
          registroGeneradoId: null,
          registroGeneradoTipo: null,
          ...extras,
        }),
      );

    it('listado propio: solo solicitudes del Fontanero A (aislamiento A/B)', async () => {
      const a = await crearFontaneroVinculado();
      const b = await crearFontaneroVinculado();
      const sA1 = await crearSolicitud(a.colaborador.id, 'own-a1');
      const sA2 = await crearSolicitud(a.colaborador.id, 'own-a2', {
        tipo: TipoSolicitudAusencia.VACACIONES,
        fechaInicio: '2026-12-01',
        fechaFin: '2026-12-03',
        motivo: 'Vacaciones A',
      });
      await crearSolicitud(b.colaborador.id, 'own-b1');
      await crearSolicitud(b.colaborador.id, 'own-b2');

      const res = await request(app.getHttpServer())
        .get(FONTANERO)
        .set('Authorization', `Bearer ${a.token}`)
        .expect(200);

      const body = res.body as FontaneroSolicitudBody[];
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
      const ids = body.map((s) => s.id).sort((x, y) => x - y);
      expect(ids).toEqual([sA1.id, sA2.id].sort((x, y) => x - y));
      for (const item of body) {
        expect(item.jotformSubmissionId).toBeUndefined();
        expect(item.colaboradorId).toBeUndefined();
        expect(item.reviewedByUsuarioId).toBeUndefined();
        expect(item.registroGeneradoId).toBeUndefined();
      }
    });

    it('listado vacío: 200 + []', async () => {
      const { token } = await crearFontaneroVinculado();
      const res = await request(app.getHttpServer())
        .get(FONTANERO)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('detalle propio: 200 con campos esperados', async () => {
      const a = await crearFontaneroVinculado();
      const sol = await crearSolicitud(a.colaborador.id, 'det-propia', {
        motivo: 'Cita médica',
        estado: EstadoSolicitudAusencia.PENDIENTE,
      });

      const res = await request(app.getHttpServer())
        .get(`${FONTANERO}/${sol.id}`)
        .set('Authorization', `Bearer ${a.token}`)
        .expect(200);

      const body = res.body as FontaneroSolicitudBody;
      expect(body).toMatchObject({
        id: sol.id,
        tipo: TipoSolicitudAusencia.PERMISO,
        fechaInicio: '2026-11-01',
        fechaFin: '2026-11-02',
        motivo: 'Cita médica',
        estado: EstadoSolicitudAusencia.PENDIENTE,
      });
      expect(body.jotformSubmissionId).toBeUndefined();
      expect(body.colaboradorId).toBeUndefined();
    });

    it('detalle ajeno: 404 sin datos de B', async () => {
      const a = await crearFontaneroVinculado();
      const b = await crearFontaneroVinculado();
      const solB = await crearSolicitud(b.colaborador.id, 'det-ajena', {
        motivo: 'Secreto de B',
      });

      const res = await request(app.getHttpServer())
        .get(`${FONTANERO}/${solB.id}`)
        .set('Authorization', `Bearer ${a.token}`)
        .expect(404);

      const body = res.body as Record<string, unknown>;
      expect(body).toMatchObject({ statusCode: 404 });
      expect(JSON.stringify(body)).not.toContain('Secreto de B');
      expect(body.motivo).toBeUndefined();
      expect(body.id).toBeUndefined();
    });

    it('solicitud inexistente: 404', async () => {
      const { token } = await crearFontaneroVinculado();
      await request(app.getHttpServer())
        .get(`${FONTANERO}/999999`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('sin JWT: 401 en listado y detalle', async () => {
      await request(app.getHttpServer()).get(FONTANERO).expect(401);
      await request(app.getHttpServer()).get(`${FONTANERO}/1`).expect(401);
    });

    it('rol incorrecto (ADMINISTRADORA): 403', async () => {
      let rol = await rolRepo.findOneBy({ nombre: Role.ADMINISTRADORA });
      rol ??= await rolRepo.save(
        rolRepo.create({ nombre: Role.ADMINISTRADORA }),
      );
      const admin = await usuarioRepo.save(
        usuarioRepo.create({
          nombre: 'Admin',
          correo: `admin.role.${Date.now()}@asadasanjuan.cr`,
          passwordHash: 'x',
          activo: true,
          idRol: rol.idRol,
        }),
      );
      const token = signAs(Role.ADMINISTRADORA, admin.idUsuario);

      await request(app.getHttpServer())
        .get(FONTANERO)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('FONTANERO sin Colaborador: 403 y no lista todas', async () => {
      let rol = await rolRepo.findOneBy({ nombre: Role.FONTANERO });
      rol ??= await rolRepo.save(rolRepo.create({ nombre: Role.FONTANERO }));
      const usuario = await usuarioRepo.save(
        usuarioRepo.create({
          nombre: 'Sin vínculo',
          correo: `sin.colab.${Date.now()}@asadasanjuan.cr`,
          passwordHash: 'x',
          activo: true,
          idRol: rol.idRol,
        }),
      );
      const otro = await crearFontaneroVinculado();
      await crearSolicitud(otro.colaborador.id, 'leak-check');

      const token = signAs(Role.FONTANERO, usuario.idUsuario);
      const res = await request(app.getHttpServer())
        .get(FONTANERO)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(res.body).toMatchObject({ statusCode: 403 });
      expect(Array.isArray(res.body)).toBe(false);
      expect(await solicitudRepo.count()).toBe(1);
    });

    it('ignora ?colaboradorId ajeno: sigue resolviendo por JWT', async () => {
      const a = await crearFontaneroVinculado();
      const b = await crearFontaneroVinculado();
      const sA = await crearSolicitud(a.colaborador.id, 'manip-a');
      await crearSolicitud(b.colaborador.id, 'manip-b');

      const res = await request(app.getHttpServer())
        .get(`${FONTANERO}?colaboradorId=${b.colaborador.id}`)
        .set('Authorization', `Bearer ${a.token}`)
        .expect(200);

      const body = res.body as FontaneroSolicitudBody[];
      expect(body).toHaveLength(1);
      expect(body[0].id).toBe(sA.id);
    });

    it('consultas GET son solo lectura (estado/updatedAt intactos)', async () => {
      const a = await crearFontaneroVinculado();
      const sol = await crearSolicitud(a.colaborador.id, 'readonly-check', {
        estado: EstadoSolicitudAusencia.PENDIENTE,
        motivo: 'No tocar',
      });
      const antes = await solicitudRepo.findOneByOrFail({ id: sol.id });
      const updatedAtAntes = antes.updatedAt.getTime();

      await request(app.getHttpServer())
        .get(FONTANERO)
        .set('Authorization', `Bearer ${a.token}`)
        .expect(200);
      await request(app.getHttpServer())
        .get(`${FONTANERO}/${sol.id}`)
        .set('Authorization', `Bearer ${a.token}`)
        .expect(200);
      await request(app.getHttpServer())
        .get(`${FONTANERO}/${sol.id}`)
        .set('Authorization', `Bearer ${a.token}`)
        .expect(200);

      const despues = await solicitudRepo.findOneByOrFail({ id: sol.id });
      expect(despues.estado).toBe(EstadoSolicitudAusencia.PENDIENTE);
      expect(despues.motivo).toBe('No tocar');
      expect(despues.updatedAt.getTime()).toBe(updatedAtAntes);
      expect(despues.reviewedAt).toBeNull();
      expect(despues.motivoRechazo).toBeNull();
    });

    it('id inválido: 400', async () => {
      const { token } = await crearFontaneroVinculado();
      await request(app.getHttpServer())
        .get(`${FONTANERO}/abc`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });
});
