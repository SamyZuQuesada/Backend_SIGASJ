import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

type CountRow = { total: number };
type ForeignKeyRow = {
  nombre: string;
  tablaReferenciada: string;
  columna: string;
  columnaReferenciada: string;
};

const describeSqlServer =
  process.env.RUN_SQLSERVER_INTEGRATION === 'true' ? describe : describe.skip;

describeSqlServer('Integridad real de actividades en SQL Server', () => {
  jest.setTimeout(60_000);
  let dataSource: DataSource;

  beforeAll(async () => {
    const options = buildMigrationDataSourceOptions();
    if (options.type !== 'mssql') {
      throw new Error('Esta suite requiere DB_TYPE=mssql.');
    }
    dataSource = new DataSource(options);
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
  });

  it('no tiene migraciones TypeORM pendientes', async () => {
    await expect(dataSource.showMigrations()).resolves.toBe(false);
  });

  it('contiene las tablas de actividad, tipo y documento', async () => {
    const rows = await dataSource.query<CountRow[]>(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME IN (
          'ActividadFontanero',
          'TipoActividadFontanero',
          'DocumentoActividadFontanero'
        )
    `);

    expect(Number(rows[0]?.total)).toBe(3);
  });

  it('mantiene la FK restrictiva entre documento y actividad', async () => {
    const rows = await dataSource.query<ForeignKeyRow[]>(`
      SELECT
        fk.name AS nombre,
        rt.name AS tablaReferenciada,
        pc.name AS columna,
        rc.name AS columnaReferenciada
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc
        ON fkc.constraint_object_id = fk.object_id
      INNER JOIN sys.tables pt ON pt.object_id = fk.parent_object_id
      INNER JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
      INNER JOIN sys.columns pc
        ON pc.object_id = pt.object_id AND pc.column_id = fkc.parent_column_id
      INNER JOIN sys.columns rc
        ON rc.object_id = rt.object_id AND rc.column_id = fkc.referenced_column_id
      WHERE pt.name = 'DocumentoActividadFontanero'
        AND fk.delete_referential_action_desc = 'NO_ACTION'
    `);

    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]).toEqual(
      expect.objectContaining({
        tablaReferenciada: 'ActividadFontanero',
        columna: 'idActividad',
        columnaReferenciada: 'id',
      }),
    )
    expect(rows[0]?.nombre).toMatch(/ActividadFontanero|FK_/i)
  })

  it('no contiene documentos huérfanos', async () => {
    const rows = await dataSource.query<CountRow[]>(`
      SELECT COUNT(*) AS total
      FROM DocumentoActividadFontanero documento
      LEFT JOIN ActividadFontanero actividad
        ON actividad.id = documento.idActividad
      WHERE actividad.id IS NULL
    `);

    expect(Number(rows[0]?.total)).toBe(0);
  });
});
