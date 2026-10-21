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
 * PBI 6.5.3 — Comparar API Fontanero con SQL Server físico.
 * Si SQL Server no está disponible, las pruebas quedan pendientes.
 */

const FONTANERO = '/api/v1/fontanero/solicitudes-ausencia';
const MARCA = `QA653-${Date.now()}`;

type IdRow = { id: number };
type FontaneroBody = { id: number; tipo: string; motivo: string | null };

describe('SQL Server — fontanero solicitudes-ausencia (PBI 6.5.3)', () => {
  jest.setTimeout(90_000);

  let app: INestApplication<App> | null = null;
  let dataSource: DataSource | null = null;
  let disponible = false;
  let motivo = '';
  let tokenA = '';
  let colaboradorAId = 0;
  let colaboradorBId = 0;
  let usuarioAId = 0;
  let usuarioBId = 0;
  let solicitudAIds: number[] = [];
  let solicitudBId = 0;

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
      motivo = `DB_TYPE=${options.type} (esta suite requiere mssql)`;
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
      const [rolFontanero] = await dataSource.query<Array<{ idRol: number }>>(
        `SELECT idRol FROM Rol WHERE nombre = 'FONTANERO'`,
      );
      if (!rolFontanero?.idRol) {
        motivo = 'no existe rol FONTANERO en la base';
        return;
      }

      const crearPar = async (sufijo: string) => {
        const correo = `qa653.${sufijo}.${Date.now()}@asadasanjuan.cr`;
        const cedula = `8-${String(Date.now()).slice(-8, -4)}-${sufijo.slice(0, 4).padStart(4, '0')}`;
        const [usuario] = await dataSource!.query<Array<{ idUsuario: number }>>(
          `
          INSERT INTO Usuario (nombre, correo, passwordHash, activo, idRol)
          OUTPUT INSERTED.idUsuario
          VALUES (@0, @1, 'qa-hash', 1, @2)
        `,
          [`Fontanero ${sufijo} ${MARCA}`, correo, rolFontanero.idRol],
        );
        const usuarioId = Number(usuario.idUsuario);
        const [colaborador] = await dataSource!.query<IdRow[]>(
          `
          INSERT INTO Colaborador
            (nombre, apellidos, cedula, correoElectronico, cargo, activo, usuarioId)
          OUTPUT INSERTED.id
          VALUES (@0, @1, @2, @3, 'Fontanero', 1, @4)
        `,
          [sufijo.toUpperCase(), MARCA, cedula, correo, usuarioId],
        );
        const colaboradorId = Number(colaborador.id);
        const token = jwtService.sign({
          sub: usuarioId,
          email: correo,
          role: Role.FONTANERO,
          name: `QA ${sufijo}`,
        } satisfies JwtPayload);
        return { usuarioId, colaboradorId, token };
      };

      const a = await crearPar('a');
      const b = await crearPar('b');
      usuarioAId = a.usuarioId;
      usuarioBId = b.usuarioId;
      colaboradorAId = a.colaboradorId;
      colaboradorBId = b.colaboradorId;
      tokenA = a.token;

      const insertSolicitud = async (
        colaboradorId: number,
        submission: string,
        motivoTexto: string,
      ) => {
        const [row] = await dataSource!.query<IdRow[]>(
          `
          INSERT INTO SolicitudAusencia
            (colaboradorId, tipo, fechaInicio, fechaFin, motivo, observaciones,
             estado, jotformSubmissionId, reviewedAt, reviewedByUsuarioId,
             motivoRechazo, registroGeneradoId, registroGeneradoTipo)
          OUTPUT INSERTED.id
          VALUES
            (@0, @1, '2026-11-01', '2026-11-02', @2, NULL,
             @3, @4, NULL, NULL, NULL, NULL, NULL)
        `,
          [
            colaboradorId,
            TipoSolicitudAusencia.PERMISO,
            motivoTexto,
            EstadoSolicitudAusencia.PENDIENTE,
            submission,
          ],
        );
        return Number(row.id);
      };

      solicitudAIds = [
        await insertSolicitud(colaboradorAId, `sub-${MARCA}-a1`, 'Motivo A1'),
        await insertSolicitud(colaboradorAId, `sub-${MARCA}-a2`, 'Motivo A2'),
      ];
      solicitudBId = await insertSolicitud(
        colaboradorBId,
        `sub-${MARCA}-b1`,
        'Motivo B secreto',
      );

      disponible =
        colaboradorAId > 0 &&
        colaboradorBId > 0 &&
        solicitudAIds.length === 2 &&
        solicitudBId > 0;
      if (!disponible) motivo = 'no se pudieron crear datos de prueba';
    } catch (error) {
      motivo = error instanceof Error ? error.message : String(error);
      console.warn('[AVISO QA] SQL Server no está disponible:', motivo);
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      try {
        if (colaboradorAId > 0 || colaboradorBId > 0) {
          await dataSource.query(
            `DELETE FROM SolicitudAusencia WHERE colaboradorId IN (@0, @1)`,
            [colaboradorAId || 0, colaboradorBId || 0],
          );
          await dataSource.query(
            `DELETE FROM Colaborador WHERE id IN (@0, @1)`,
            [colaboradorAId || 0, colaboradorBId || 0],
          );
        }
        if (usuarioAId > 0 || usuarioBId > 0) {
          await dataSource.query(
            `DELETE FROM Usuario WHERE idUsuario IN (@0, @1)`,
            [usuarioAId || 0, usuarioBId || 0],
          );
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

  it('listado API coincide con SQL por colaboradorId de A', async () => {
    const { app: nest, db } = requiere();

    const res = await request(nest.getHttpServer())
      .get(FONTANERO)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const body = res.body as FontaneroBody[];
    expect(body).toHaveLength(2);
    const apiIds = body.map((s) => s.id).sort((x, y) => x - y);

    const sql = await db.query<IdRow[]>(
      `
      SELECT id FROM SolicitudAusencia
      WHERE colaboradorId = @0
      ORDER BY createdAt DESC, id DESC
    `,
      [colaboradorAId],
    );
    const sqlIds = sql.map((r) => Number(r.id)).sort((x, y) => x - y);
    expect(apiIds).toEqual(sqlIds);
    expect(apiIds).toEqual([...solicitudAIds].sort((x, y) => x - y));
    expect(apiIds).not.toContain(solicitudBId);
  });

  it('detalle propio coincide; detalle ajeno 404', async () => {
    const { app: nest, db } = requiere();
    const propiaId = solicitudAIds[0];

    const res = await request(nest.getHttpServer())
      .get(`${FONTANERO}/${propiaId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const body = res.body as FontaneroBody;
    expect(body.id).toBe(propiaId);
    expect(body.motivo).toBe('Motivo A1');

    const [sql] = await db.query<
      Array<{ id: number; colaboradorId: number; motivo: string }>
    >(
      `
      SELECT id, colaboradorId, motivo
      FROM SolicitudAusencia
      WHERE id = @0 AND colaboradorId = @1
    `,
      [propiaId, colaboradorAId],
    );
    expect(Number(sql.id)).toBe(body.id);
    expect(Number(sql.colaboradorId)).toBe(colaboradorAId);

    const ajena = await request(nest.getHttpServer())
      .get(`${FONTANERO}/${solicitudBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
    expect(JSON.stringify(ajena.body)).not.toContain('Motivo B secreto');
  });
});
