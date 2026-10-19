import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config as loadEnv } from 'dotenv';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { EstadoSolicitudAusencia } from '../common/enums/estado-solicitud-ausencia.enum';
import { Role } from '../common/enums/role.enum';
import { TipoMovimientoVacaciones } from '../common/enums/tipo-movimiento-vacaciones.enum';
import { TipoSolicitudAusencia } from '../common/enums/tipo-solicitud-ausencia.enum';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import jotformConfig from '../config/jotform.config';
import jwtConfig from '../config/jwt.config';
import { AuthModule } from '../modules/auth/auth.module';
import { RecursosHumanosModule } from '../modules/recursos-humanos/recursos-humanos.module';
import { SolicitudesAusenciaModule } from '../modules/solicitudes-ausencia/solicitudes-ausencia.module';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

/**
 * PBI 6.5.4 — Aprobar/rechazar contra SQL Server físico.
 */

const RRHH = '/api/v1/rrhh/solicitudes-ausencia';
const MARCA = `QA654-${Date.now()}`;

type IdRow = { id: number };
type CountRow = { n: number };

describe('SQL Server — admin solicitudes-ausencia (PBI 6.5.4)', () => {
  jest.setTimeout(90_000);

  let app: INestApplication<App> | null = null;
  let dataSource: DataSource | null = null;
  let disponible = false;
  let motivo = '';
  let adminToken = '';
  let adminUsuarioId = 0;
  let colaboradorPermisoId = 0;
  let colaboradorVacId = 0;
  let colaboradorRechazoId = 0;
  const usuarioIds: number[] = [];

  const requiere = () => {
    if (!disponible || !app || !dataSource) {
      pending(`SQL Server no está disponible: ${motivo}`);
      throw new Error('SQL Server no disponible');
    }
    return { app, db: dataSource };
  };

  beforeAll(async () => {
    process.env.JOTFORM_WEBHOOK_SECRET ??= 'qa-sqlserver-secret';
    process.env.JOTFORM_FORM_ID ??= 'qa-form';
    process.env.JOTFORM_VERIFY_SUBMISSION ??= 'false';

    const options = buildMigrationDataSourceOptions();
    if (options.type !== 'mssql') {
      motivo = `DB_TYPE=${options.type}`;
      return;
    }

    try {
      dataSource = new DataSource(options);
      await dataSource.initialize();

      const moduleFixture = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            load: [jwtConfig, jotformConfig],
          }),
          TypeOrmModule.forRoot({ ...options, logging: false }),
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

      const jwtService = moduleFixture.get(JwtService);
      const [rolAdmin] = await dataSource.query<Array<{ idRol: number }>>(
        `SELECT idRol FROM Rol WHERE nombre = 'ADMINISTRADORA'`,
      );
      if (!rolAdmin?.idRol) {
        motivo = 'no existe rol ADMINISTRADORA';
        return;
      }

      const [adminIns] = await dataSource.query<Array<{ idUsuario: number }>>(
        `
        INSERT INTO Usuario (nombre, correo, passwordHash, activo, idRol)
        OUTPUT INSERTED.idUsuario
        VALUES (@0, @1, 'qa-hash', 1, @2)
      `,
        [
          `Admin ${MARCA}`,
          `qa654.admin.${Date.now()}@asadasanjuan.cr`,
          rolAdmin.idRol,
        ],
      );
      adminUsuarioId = Number(adminIns.idUsuario);
      usuarioIds.push(adminUsuarioId);
      adminToken = jwtService.sign({
        sub: adminUsuarioId,
        email: `qa654.admin@asadasanjuan.cr`,
        role: Role.ADMINISTRADORA,
        name: 'QA Admin',
      } satisfies JwtPayload);

      const crearColaborador = async (sufijo: string) => {
        const cedula = `6-${String(Date.now()).slice(-8, -4)}-${sufijo.padStart(4, '0')}`;
        const [row] = await dataSource!.query<IdRow[]>(
          `
          INSERT INTO Colaborador
            (nombre, apellidos, cedula, correoElectronico, cargo, activo, usuarioId)
          OUTPUT INSERTED.id
          VALUES (@0, @1, @2, @3, 'Fontanero', 1, NULL)
        `,
          [
            sufijo.toUpperCase(),
            MARCA,
            cedula,
            `qa654.${sufijo}.${Date.now()}@asadasanjuan.cr`,
          ],
        );
        return Number(row.id);
      };

      colaboradorPermisoId = await crearColaborador('p');
      colaboradorVacId = await crearColaborador('v');
      colaboradorRechazoId = await crearColaborador('r');

      disponible =
        adminUsuarioId > 0 &&
        colaboradorPermisoId > 0 &&
        colaboradorVacId > 0 &&
        colaboradorRechazoId > 0;
    } catch (error) {
      motivo = error instanceof Error ? error.message : String(error);
      console.warn('[AVISO QA] SQL Server no está disponible:', motivo);
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      try {
        const cols = [
          colaboradorPermisoId,
          colaboradorVacId,
          colaboradorRechazoId,
        ].filter((id) => id > 0);
        for (const id of cols) {
          await dataSource.query(
            `DELETE FROM SolicitudAusencia WHERE colaboradorId = @0`,
            [id],
          );
          await dataSource.query(
            `DELETE FROM PermisoColaborador WHERE colaboradorId = @0`,
            [id],
          );
          await dataSource.query(
            `DELETE FROM MovimientoVacaciones WHERE colaboradorId = @0`,
            [id],
          );
          await dataSource.query(`DELETE FROM Colaborador WHERE id = @0`, [id]);
        }
        for (const uid of usuarioIds) {
          await dataSource.query(`DELETE FROM Usuario WHERE idUsuario = @0`, [
            uid,
          ]);
        }
      } catch (error) {
        console.warn(
          '[AVISO QA] limpieza incompleta:',
          error instanceof Error ? error.message : error,
        );
      }
      await dataSource.destroy();
    }
    if (app) await app.close();
  });

  const insertSolicitud = async (
    colaboradorId: number,
    tipo: TipoSolicitudAusencia,
    submission: string,
    inicio: string,
    fin: string,
  ) => {
    const [row] = await dataSource!.query<IdRow[]>(
      `
      INSERT INTO SolicitudAusencia
        (colaboradorId, tipo, fechaInicio, fechaFin, motivo, observaciones,
         estado, jotformSubmissionId, reviewedAt, reviewedByUsuarioId,
         motivoRechazo, registroGeneradoId, registroGeneradoTipo)
      OUTPUT INSERTED.id
      VALUES
        (@0, @1, @2, @3, 'QA', NULL, @4, @5, NULL, NULL, NULL, NULL, NULL)
    `,
      [
        colaboradorId,
        tipo,
        inicio,
        fin,
        EstadoSolicitudAusencia.PENDIENTE,
        submission,
      ],
    );
    return Number(row.id);
  };

  it('flujo PERMISO: aprueba y crea exactamente 1 PermisoColaborador', async () => {
    const { app: nest, db } = requiere();
    const id = await insertSolicitud(
      colaboradorPermisoId,
      TipoSolicitudAusencia.PERMISO,
      `sub-${MARCA}-perm`,
      '2026-11-01',
      '2026-11-02',
    );

    await request(nest.getHttpServer())
      .patch(`${RRHH}/${id}/aprobar`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const [sol] = await db.query<
      Array<{
        estado: string;
        reviewedByUsuarioId: number;
        registroGeneradoId: number;
      }>
    >(
      `SELECT estado, reviewedByUsuarioId, registroGeneradoId
       FROM SolicitudAusencia WHERE id = @0`,
      [id],
    );
    expect(sol.estado).toBe(EstadoSolicitudAusencia.APROBADA);
    expect(Number(sol.reviewedByUsuarioId)).toBe(adminUsuarioId);

    const [count] = await db.query<CountRow[]>(
      `SELECT COUNT(*) AS n FROM PermisoColaborador WHERE colaboradorId = @0`,
      [colaboradorPermisoId],
    );
    expect(Number(count.n)).toBe(1);
    expect(Number(sol.registroGeneradoId)).toBeGreaterThan(0);
  });

  it('flujo VACACIONES: DISFRUTADO único y saldo final correcto', async () => {
    const { app: nest, db } = requiere();
    await db.query(
      `
      INSERT INTO MovimientoVacaciones
        (colaboradorId, tipo, cantidadDias, fecha, observaciones, signoAjuste, registradoPorUsuarioId)
      VALUES (@0, @1, 10, '2026-01-01', NULL, NULL, NULL)
    `,
      [colaboradorVacId, TipoMovimientoVacaciones.ACUMULADO],
    );

    const id = await insertSolicitud(
      colaboradorVacId,
      TipoSolicitudAusencia.VACACIONES,
      `sub-${MARCA}-vac`,
      '2026-12-01',
      '2026-12-05',
    );

    await request(nest.getHttpServer())
      .patch(`${RRHH}/${id}/aprobar`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const [sol] = await db.query<Array<{ estado: string }>>(
      `SELECT estado FROM SolicitudAusencia WHERE id = @0`,
      [id],
    );
    expect(sol.estado).toBe(EstadoSolicitudAusencia.APROBADA);

    const movs = await db.query<Array<{ tipo: string; cantidadDias: number }>>(
      `SELECT tipo, cantidadDias FROM MovimientoVacaciones
       WHERE colaboradorId = @0 AND tipo = @1`,
      [colaboradorVacId, TipoMovimientoVacaciones.DISFRUTADO],
    );
    expect(movs).toHaveLength(1);
    expect(Number(movs[0].cantidadDias)).toBe(5);
  });

  it('flujo RECHAZO: RECHAZADA sin registros RRHH', async () => {
    const { app: nest, db } = requiere();
    const id = await insertSolicitud(
      colaboradorRechazoId,
      TipoSolicitudAusencia.PERMISO,
      `sub-${MARCA}-rej`,
      '2026-11-10',
      '2026-11-11',
    );

    await request(nest.getHttpServer())
      .patch(`${RRHH}/${id}/rechazar`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ motivoRechazo: 'Sin cobertura QA' })
      .expect(200);

    const [sol] = await db.query<
      Array<{ estado: string; motivoRechazo: string }>
    >(`SELECT estado, motivoRechazo FROM SolicitudAusencia WHERE id = @0`, [
      id,
    ]);
    expect(sol.estado).toBe(EstadoSolicitudAusencia.RECHAZADA);
    expect(sol.motivoRechazo).toBe('Sin cobertura QA');

    const [perm] = await db.query<CountRow[]>(
      `SELECT COUNT(*) AS n FROM PermisoColaborador WHERE colaboradorId = @0`,
      [colaboradorRechazoId],
    );
    const [mov] = await db.query<CountRow[]>(
      `SELECT COUNT(*) AS n FROM MovimientoVacaciones WHERE colaboradorId = @0`,
      [colaboradorRechazoId],
    );
    expect(Number(perm.n)).toBe(0);
    expect(Number(mov.n)).toBe(0);
  });
});
