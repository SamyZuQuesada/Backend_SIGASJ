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
import { Role } from '../common/enums/role.enum';
import { TipoMovimientoVacaciones } from '../common/enums/tipo-movimiento-vacaciones.enum';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import jwtConfig from '../config/jwt.config';
import { AuthModule } from '../modules/auth/auth.module';
import { RecursosHumanosModule } from '../modules/recursos-humanos/recursos-humanos.module';
import {
  BalanceVacaciones,
  MovimientosVacacionesListado,
} from '../modules/recursos-humanos/vacaciones.service';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

/**
 * QA 6.3 — "Comparar con SQL Server".
 *
 * Levanta los controladores reales de vacaciones (mismos guards, pipes y
 * filtro que main.ts) contra la base SQL Server configurada en .env y
 * contrasta cada respuesta del API con consultas SQL directas sobre
 * MovimientoVacaciones. Si SQL Server no está disponible, las pruebas se
 * marcan como pendientes en lugar de fallar.
 *
 * Deja la base como estaba: crea un colaborador marcado y lo elimina al final
 * (la FK con CASCADE borra sus movimientos; eso también se verifica).
 */

const BASE = '/api/v1/rrhh/vacaciones';
const MOVIMIENTOS_URL = `${BASE}/movimientos`;
const balanceUrl = (id: number) => `${BASE}/colaboradores/${id}/balance`;
const { ACUMULADO, DISFRUTADO } = TipoMovimientoVacaciones;

const MARCA = `QA63-${Date.now()}`;
const CEDULA_QA = `9-${String(Date.now()).slice(-8, -4)}-${String(Date.now()).slice(-4)}`;

type IdRow = { id: number };
type CountRow = { n: number };
type SaldoRow = {
  acumulados: number | string | null;
  disfrutados: number | string | null;
  total: number | string | null;
};
type MovimientoRow = {
  id: number;
  tipo: string;
  cantidadDias: number;
  fecha: string;
  observaciones: string | null;
  createdAt: Date;
};
type ErrorResponse = { statusCode: number; message: string | string[] };
type MovimientoResponse = { id: number; cantidadDias: number; fecha: string };

describe('SQL Server — vacaciones: API real contra la base física', () => {
  jest.setTimeout(90_000);

  let app: INestApplication<App> | null = null;
  let dataSource: DataSource | null = null;
  let disponible = false;
  let motivo = '';
  let adminToken = '';
  let fontaneroToken = '';
  let colaboradorId = 0;

  const requiere = () => {
    if (!disponible || !app || !dataSource) {
      pending(`SQL Server no está disponible: ${motivo}`);
      throw new Error('SQL Server no disponible');
    }
    return { app, db: dataSource };
  };

  const post = (body: Record<string, unknown>, token = adminToken) =>
    request(requiere().app.getHttpServer())
      .post(MOVIMIENTOS_URL)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const get = (path: string, token = adminToken) =>
    request(requiere().app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  const balanceApi = async (): Promise<BalanceVacaciones> => {
    const res = await get(balanceUrl(colaboradorId));
    expect(res.status).toBe(200);
    return res.body as BalanceVacaciones;
  };

  const listarApi = async (
    query = '',
  ): Promise<MovimientosVacacionesListado> => {
    const res = await get(
      `${MOVIMIENTOS_URL}?colaboradorId=${colaboradorId}${query}`,
    );
    expect(res.status).toBe(200);
    return res.body as MovimientosVacacionesListado;
  };

  /** Saldo calculado por SQL Server directamente, sin TypeORM ni servicio. */
  const saldoSql = async () => {
    const [fila] = await requiere().db.query<SaldoRow[]>(
      `
      SELECT
        COALESCE(SUM(CASE WHEN tipo = 'ACUMULADO' THEN cantidadDias END), 0) AS acumulados,
        COALESCE(SUM(CASE WHEN tipo = 'DISFRUTADO' THEN cantidadDias END), 0) AS disfrutados,
        COUNT(*) AS total
      FROM MovimientoVacaciones
      WHERE colaboradorId = @0
    `,
      [colaboradorId],
    );
    return {
      acumulados: Number(fila?.acumulados ?? 0),
      disfrutados: Number(fila?.disfrutados ?? 0),
      disponibles:
        Number(fila?.acumulados ?? 0) - Number(fila?.disfrutados ?? 0),
      total: Number(fila?.total ?? 0),
    };
  };

  /** Filas físicas; el driver ODBC puede devolver enteros como texto. */
  const filasSql = async (whereExtra = '', params: unknown[] = []) => {
    const filas = await requiere().db.query<MovimientoRow[]>(
      `
      SELECT id, tipo, cantidadDias,
             CONVERT(varchar(10), fecha, 23) AS fecha,
             observaciones, createdAt
      FROM MovimientoVacaciones
      WHERE colaboradorId = @0 ${whereExtra}
      ORDER BY fecha DESC, id DESC
    `,
      [colaboradorId, ...params],
    );
    return filas.map((f) => ({
      ...f,
      id: Number(f.id),
      cantidadDias: Number(f.cantidadDias),
    }));
  };

  const esperarBalanceIgualASql = async () => {
    const api = await balanceApi();
    const sql = await saldoSql();
    expect(api.diasAcumulados).toBe(sql.acumulados);
    expect(api.diasDisfrutados).toBe(sql.disfrutados);
    expect(api.diasDisponibles).toBe(sql.disponibles);
    expect(api.totalMovimientos).toBe(sql.total);
    expect(api.diasDisponibles).toBeGreaterThanOrEqual(0);
    return { api, sql };
  };

  beforeAll(async () => {
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
          ConfigModule.forRoot({ isGlobal: true, load: [jwtConfig] }),
          TypeOrmModule.forRoot({ ...options, logging: false }),
          AuthModule,
          RecursosHumanosModule,
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
      const firmar = (role: Role) => {
        const payload: JwtPayload = {
          sub: '1',
          email: `${role.toLowerCase()}@asadasanjuan.cr`,
          role,
          name: `QA ${role}`,
        };
        return jwtService.sign(payload);
      };
      adminToken = firmar(Role.ADMINISTRADORA);
      fontaneroToken = firmar(Role.FONTANERO);

      // Colaborador exclusivo de esta corrida; se elimina en afterAll.
      await dataSource.query(`DELETE FROM Colaborador WHERE cedula = @0`, [
        CEDULA_QA,
      ]);
      const creado = await dataSource.query<IdRow[]>(
        `
        INSERT INTO Colaborador (nombre, apellidos, cedula, correoElectronico, cargo, activo)
        OUTPUT INSERTED.id
        VALUES ('Juan', @0, @1, @2, 'Fontanero', 1)
      `,
        [`Pérez ${MARCA}`, CEDULA_QA, `qa63.${Date.now()}@asadasanjuan.cr`],
      );
      colaboradorId = Number(creado[0]?.id);
      disponible = colaboradorId > 0;
      if (!disponible) motivo = 'no se pudo crear el colaborador de prueba';
    } catch (error) {
      motivo = error instanceof Error ? error.message : String(error);
      console.warn('[AVISO QA] SQL Server no está disponible:', motivo);
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized && colaboradorId > 0) {
      await dataSource.query(`DELETE FROM Colaborador WHERE id = @0`, [
        colaboradorId,
      ]);
    }
    await app?.close();
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('la tabla MovimientoVacaciones existe y el colaborador de prueba parte sin movimientos', async () => {
    const { db } = requiere();
    const [tabla] = await db.query<CountRow[]>(
      `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'MovimientoVacaciones'`,
    );
    expect(Number(tabla?.n)).toBe(1);
    expect(await saldoSql()).toEqual({
      acumulados: 0,
      disfrutados: 0,
      disponibles: 0,
      total: 0,
    });
    expect(await balanceApi()).toMatchObject({
      colaboradorId,
      totalMovimientos: 0,
      diasDisponibles: 0,
    });
  });

  it('registrar acumulados (15 + 5): el API y SQL Server coinciden en 20', async () => {
    requiere();
    const a = await post({
      colaboradorId,
      tipo: ACUMULADO,
      cantidadDias: 15,
      fecha: '2025-01-01',
      observaciones: `Periodo 2025 ${MARCA}`,
    });
    expect(a.status).toBe(201);
    const b = await post({
      colaboradorId,
      tipo: ACUMULADO,
      cantidadDias: 5,
      fecha: '2026-01-01',
    });
    expect(b.status).toBe(201);

    const { api, sql } = await esperarBalanceIgualASql();
    expect(sql).toEqual({
      acumulados: 20,
      disfrutados: 0,
      disponibles: 20,
      total: 2,
    });
    expect(api.diasAcumulados).toBe(20);

    // La fila persistida es exactamente lo que respondió el API.
    const filas = await filasSql(`AND id = @1`, [
      (a.body as MovimientoResponse).id,
    ]);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      tipo: 'ACUMULADO',
      cantidadDias: 15,
      fecha: '2025-01-01',
      observaciones: `Periodo 2025 ${MARCA}`,
    });
    expect(filas[0]?.createdAt).toBeInstanceOf(Date);
  });

  it('registrar disfrutados (3 + 5): el API y SQL Server coinciden en 20 / 8 / 12', async () => {
    requiere();
    expect(
      (
        await post({
          colaboradorId,
          tipo: DISFRUTADO,
          cantidadDias: 3,
          fecha: '2025-04-14',
          observaciones: 'Semana Santa',
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await post({
          colaboradorId,
          tipo: DISFRUTADO,
          cantidadDias: 5,
          fecha: '2026-07-06',
        })
      ).status,
    ).toBe(201);

    const { api, sql } = await esperarBalanceIgualASql();
    expect(sql).toEqual({
      acumulados: 20,
      disfrutados: 8,
      disponibles: 12,
      total: 4,
    });
    expect(api).toMatchObject({
      diasAcumulados: 20,
      diasDisfrutados: 8,
      diasDisponibles: 12,
      totalMovimientos: 4,
    });
  });

  it('intentar disfrutar más de lo disponible (13 > 12): 400 y SQL Server no cambia', async () => {
    requiere();
    const antes = await saldoSql();
    const res = await post({
      colaboradorId,
      tipo: DISFRUTADO,
      cantidadDias: 13,
      fecha: '2026-08-01',
    });
    expect(res.status).toBe(400);
    expect(String((res.body as ErrorResponse).message)).toMatch(
      /dispone de 12/,
    );
    expect(await saldoSql()).toEqual(antes);
    await esperarBalanceIgualASql();
  });

  it.each([
    ['negativa', -3],
    ['cero', 0],
  ])(
    'cantidad %s por API: 400 y ninguna fila nueva en SQL Server',
    async (_nombre, cantidadDias) => {
      requiere();
      const antes = await saldoSql();
      for (const tipo of [ACUMULADO, DISFRUTADO]) {
        const res = await post({
          colaboradorId,
          tipo,
          cantidadDias,
          fecha: '2026-08-01',
        });
        expect(res.status).toBe(400);
      }
      expect(await saldoSql()).toEqual(antes);
    },
  );

  it.each([
    ['negativa', -3],
    ['cero', 0],
  ])(
    'cantidad %s directo en SQL: el CHECK de la tabla la rechaza',
    async (_nombre, cantidadDias) => {
      const { db } = requiere();
      const antes = await saldoSql();
      await expect(
        db.query(
          `INSERT INTO MovimientoVacaciones (colaboradorId, tipo, cantidadDias, fecha)
           VALUES (@0, 'ACUMULADO', @1, '2026-08-01')`,
          [colaboradorId, cantidadDias],
        ),
      ).rejects.toThrow(/CK_MovimientoVacaciones_CantidadDias/);
      expect(await saldoSql()).toEqual(antes);
    },
  );

  it('tipo fuera del catálogo directo en SQL: el CHECK de tipo lo rechaza', async () => {
    const { db } = requiere();
    await expect(
      db.query(
        `INSERT INTO MovimientoVacaciones (colaboradorId, tipo, cantidadDias, fecha)
         VALUES (@0, 'PENDIENTE', 1, '2026-08-01')`,
        [colaboradorId],
      ),
    ).rejects.toThrow(/CK_MovimientoVacaciones_Tipo/);
  });

  it('consultar historial: el API devuelve las mismas filas y el mismo orden que SQL Server', async () => {
    requiere();
    const api = await listarApi('&limit=100');
    const sql = await filasSql();

    expect(api.total).toBe(4);
    expect(api.total).toBe(sql.length);
    expect(api.data.map((m) => m.id)).toEqual(sql.map((f) => f.id));
    expect(
      api.data.map((m) => [m.tipo, m.cantidadDias, m.fecha, m.observaciones]),
    ).toEqual(
      sql.map((f) => [f.tipo, f.cantidadDias, f.fecha, f.observaciones]),
    );
    expect(api.data.map((m) => m.fecha)).toEqual([
      '2026-07-06',
      '2026-01-01',
      '2025-04-14',
      '2025-01-01',
    ]);
  });

  it('paginar historial: las páginas del API cubren exactamente las filas de SQL Server', async () => {
    requiere();
    const p1 = await listarApi('&limit=3&page=1');
    const p2 = await listarApi('&limit=3&page=2');
    const sql = await filasSql();
    expect(p1.totalPages).toBe(2);
    expect([...p1.data, ...p2.data].map((m) => m.id)).toEqual(
      sql.map((f) => f.id),
    );
  });

  it('filtrar por tipo: coincide con WHERE tipo = ... en SQL Server', async () => {
    requiere();
    for (const tipo of [ACUMULADO, DISFRUTADO]) {
      const api = await listarApi(`&tipo=${tipo}&limit=100`);
      const sql = await filasSql(`AND tipo = @1`, [tipo]);
      expect(api.total).toBe(sql.length);
      expect(api.data.map((m) => m.id)).toEqual(sql.map((f) => f.id));
      expect(api.data.every((m) => m.tipo === tipo)).toBe(true);
    }
  });

  it('filtrar por rango de fechas: coincide con BETWEEN en SQL Server', async () => {
    requiere();
    const api = await listarApi(
      '&fechaInicio=2025-01-01&fechaFin=2025-12-31&limit=100',
    );
    const sql = await filasSql(`AND fecha BETWEEN @1 AND @2`, [
      '2025-01-01',
      '2025-12-31',
    ]);
    expect(sql).toHaveLength(2);
    expect(api.total).toBe(2);
    expect(api.data.map((m) => m.id)).toEqual(sql.map((f) => f.id));
  });

  it('filtrar combinando colaborador + tipo + fechas: coincide con SQL Server', async () => {
    requiere();
    const api = await listarApi(
      '&tipo=DISFRUTADO&fechaInicio=2026-01-01&fechaFin=2026-12-31',
    );
    const sql = await filasSql(
      `AND tipo = 'DISFRUTADO' AND fecha BETWEEN @1 AND @2`,
      ['2026-01-01', '2026-12-31'],
    );
    expect(sql).toHaveLength(1);
    expect(api.data.map((m) => m.id)).toEqual(sql.map((f) => f.id));
    expect(api.data[0]).toMatchObject({ cantidadDias: 5, fecha: '2026-07-06' });
  });

  it('permisos: sin token 401, Fontanero 403, y SQL Server no registra nada', async () => {
    const { app: nest } = requiere();
    const antes = await saldoSql();
    const body = {
      colaboradorId,
      tipo: ACUMULADO,
      cantidadDias: 50,
      fecha: '2026-09-01',
    };

    expect(
      (await request(nest.getHttpServer()).post(MOVIMIENTOS_URL).send(body))
        .status,
    ).toBe(401);
    expect(
      (await request(nest.getHttpServer()).get(balanceUrl(colaboradorId)))
        .status,
    ).toBe(401);

    expect((await post(body, fontaneroToken)).status).toBe(403);
    expect((await get(MOVIMIENTOS_URL, fontaneroToken)).status).toBe(403);
    expect((await get(balanceUrl(colaboradorId), fontaneroToken)).status).toBe(
      403,
    );

    expect(await saldoSql()).toEqual(antes);
    expect((await balanceApi()).diasDisponibles).toBe(12);
  });

  it('trazabilidad: la suma con signo de las filas físicas reproduce el saldo del API', async () => {
    requiere();
    const sql = await filasSql();
    const conSigno = sql.reduce(
      (acc, f) => acc + (f.tipo === 'ACUMULADO' ? 1 : -1) * f.cantidadDias,
      0,
    );
    const api = await balanceApi();
    expect(conSigno).toBe(12);
    expect(conSigno).toBe(api.diasDisponibles);
    expect(sql.every((f) => f.cantidadDias > 0)).toBe(true);
    expect(sql.every((f) => f.createdAt instanceof Date)).toBe(true);
  });

  it('trazabilidad: eliminar el colaborador elimina sus movimientos en cascada', async () => {
    const { db } = requiere();
    expect((await saldoSql()).total).toBe(4);

    await db.query(`DELETE FROM Colaborador WHERE id = @0`, [colaboradorId]);

    const [restantes] = await db.query<CountRow[]>(
      `SELECT COUNT(*) AS n FROM MovimientoVacaciones WHERE colaboradorId = @0`,
      [colaboradorId],
    );
    expect(Number(restantes?.n)).toBe(0);
    expect((await get(balanceUrl(colaboradorId))).status).toBe(404);
    colaboradorId = 0; // ya no hay nada que limpiar en afterAll
  });
});
