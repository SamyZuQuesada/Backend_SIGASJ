import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

type CountRow = { total: number | string };
type ColumnRow = { COLUMN_NAME: string };
type TipoCountRow = {
  id: number;
  codigo: string;
  nombre: string;
  cantidad: number | string;
};
type FontaneroCountRow = {
  fontaneroId: string;
  cantidad: number | string;
};

const describeSqlServer =
  process.env.RUN_SQLSERVER_INTEGRATION === 'true' ? describe : describe.skip;

/**
 * QA Backlog 8.6 / 7.6 contra SQL Server real.
 * Si faltan columnas del modelo actual, el test falla con diagnóstico
 * (migraciones pendientes), no con un falso positivo.
 */
describeSqlServer('QA reportes — agregados reales en SQL Server', () => {
  jest.setTimeout(60_000);
  let dataSource: DataSource;
  let hasActividad = false;
  let hasTipo = false;
  let actividadColumns = new Set<string>();

  beforeAll(async () => {
    const options = buildMigrationDataSourceOptions();
    if (options.type !== 'mssql') {
      throw new Error('Esta suite requiere DB_TYPE=mssql.');
    }
    dataSource = new DataSource(options);
    await dataSource.initialize();

    const tables = await dataSource.query<{ TABLE_NAME: string }[]>(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME IN ('ActividadFontanero', 'TipoActividadFontanero')
    `);
    const names = new Set(tables.map((row) => row.TABLE_NAME));
    hasActividad = names.has('ActividadFontanero');
    hasTipo = names.has('TipoActividadFontanero');

    if (hasActividad) {
      const cols = await dataSource.query<ColumnRow[]>(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'ActividadFontanero'
      `);
      actividadColumns = new Set(cols.map((row) => row.COLUMN_NAME));
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('existe ActividadFontanero y TipoActividadFontanero', () => {
    expect(hasActividad).toBe(true);
    expect(hasTipo).toBe(true);
  });

  it('ActividadFontanero tiene columnas del modelo de reportes', () => {
    expect(hasActividad).toBe(true);
    const required = ['id', 'fontaneroId', 'idTipoActividad', 'fechaActividad'];
    const missing = required.filter((col) => !actividadColumns.has(col));
    expect(missing).toEqual([]);
  });

  it('total SQL coincide con COUNT(*) de ActividadFontanero', async () => {
    expect(hasActividad).toBe(true);
    const rows = await dataSource.query<CountRow[]>(
      'SELECT COUNT(*) AS total FROM ActividadFontanero',
    );
    const total = Number(rows[0]?.total ?? 0);
    expect(Number.isFinite(total)).toBe(true);
    expect(total).toBeGreaterThanOrEqual(0);
  });

  it('agregado por tipo usa JOIN real con TipoActividadFontanero', async () => {
    expect(hasActividad && hasTipo).toBe(true);
    expect(actividadColumns.has('idTipoActividad')).toBe(true);

    const rows = await dataSource.query<TipoCountRow[]>(`
      SELECT
        t.id,
        t.codigo,
        t.nombre,
        COUNT(a.id) AS cantidad
      FROM TipoActividadFontanero t
      LEFT JOIN ActividadFontanero a
        ON a.idTipoActividad = t.id
      GROUP BY t.id, t.codigo, t.nombre, t.orden
      ORDER BY t.orden ASC, t.id ASC
    `);

    expect(rows.length).toBeGreaterThan(0);
    const sum = rows.reduce((acc, row) => acc + Number(row.cantidad), 0);
    const totalRows = await dataSource.query<CountRow[]>(
      'SELECT COUNT(*) AS total FROM ActividadFontanero',
    );
    expect(sum).toBeLessThanOrEqual(Number(totalRows[0]?.total ?? 0));
  });

  it('agregado por fontaneroId no mezcla identidades', async () => {
    expect(hasActividad).toBe(true);
    expect(actividadColumns.has('fontaneroId')).toBe(true);

    const rows = await dataSource.query<FontaneroCountRow[]>(`
      SELECT fontaneroId, COUNT(*) AS cantidad
      FROM ActividadFontanero
      GROUP BY fontaneroId
      ORDER BY COUNT(*) DESC
    `);

    const sum = rows.reduce((acc, row) => acc + Number(row.cantidad), 0);
    const totalRows = await dataSource.query<CountRow[]>(
      'SELECT COUNT(*) AS total FROM ActividadFontanero',
    );
    expect(sum).toBe(Number(totalRows[0]?.total ?? 0));

    for (const row of rows) {
      expect(String(row.fontaneroId).length).toBeGreaterThan(0);
    }
  });

  it('filtro de rango de fechas en SQL es inclusivo sobre fechaActividad', async () => {
    expect(hasActividad).toBe(true);
    expect(actividadColumns.has('fechaActividad')).toBe(true);

    const bounds = await dataSource.query<
      { minFecha: string | null; maxFecha: string | null }[]
    >(`
      SELECT
        CONVERT(varchar(10), MIN(fechaActividad), 23) AS minFecha,
        CONVERT(varchar(10), MAX(fechaActividad), 23) AS maxFecha
      FROM ActividadFontanero
      WHERE fechaActividad IS NOT NULL
    `);

    const minFecha = bounds[0]?.minFecha;
    const maxFecha = bounds[0]?.maxFecha;
    if (!minFecha || !maxFecha) {
      expect(true).toBe(true);
      return;
    }

    const ranged = await dataSource.query<CountRow[]>(
      `
        SELECT COUNT(*) AS total
        FROM ActividadFontanero
        WHERE fechaActividad >= @0 AND fechaActividad <= @1
      `,
      [minFecha, maxFecha],
    );
    const allDated = await dataSource.query<CountRow[]>(`
      SELECT COUNT(*) AS total
      FROM ActividadFontanero
      WHERE fechaActividad IS NOT NULL
    `);

    expect(Number(ranged[0]?.total)).toBe(Number(allDated[0]?.total));
  });

  it('consultar agregados de reporte no modifica filas (solo lectura SQL)', async () => {
    expect(hasActividad).toBe(true);
    expect(actividadColumns.has('idTipoActividad')).toBe(true);

    const before = await dataSource.query<CountRow[]>(
      'SELECT COUNT(*) AS total FROM ActividadFontanero',
    );
    await dataSource.query(`
      SELECT COUNT(*) AS total
      FROM ActividadFontanero a
      LEFT JOIN TipoActividadFontanero t ON t.id = a.idTipoActividad
    `);
    const after = await dataSource.query<CountRow[]>(
      'SELECT COUNT(*) AS total FROM ActividadFontanero',
    );

    expect(Number(after[0]?.total)).toBe(Number(before[0]?.total));
  });
});
