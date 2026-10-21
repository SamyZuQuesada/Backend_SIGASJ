import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateFormularioOficialTable1724686120000 } from './migrations/1724686120000-CreateFormularioOficialTable';

loadEnv();

type TableCountRow = { total: number };
type ColumnInfo = {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  CHARACTER_MAXIMUM_LENGTH: number | null;
  IS_NULLABLE: string;
  COLUMN_DEFAULT: string | null;
};
type IndexInfo = {
  INDEX_NAME: string;
  COLUMN_NAME: string;
  IS_UNIQUE: boolean;
};
type ForeignKeyInfo = {
  FK_NAME: string;
  TABLE_NAME: string;
  COLUMN_NAME: string;
  REF_TABLE: string;
  REF_COLUMN: string;
};

describe('Validación física de tabla FormularioOficial en SQL Server', () => {
  jest.setTimeout(60_000);
  let dataSource: DataSource;

  beforeAll(async () => {
    const options = buildMigrationDataSourceOptions();
    dataSource = new DataSource(options);
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('1. Debe confirmar que la tabla FormularioOficial existe en dbo', async () => {
    const rows = await dataSource.query<TableCountRow[]>(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'FormularioOficial'
    `);
    expect(Number(rows[0]?.total)).toBe(1);
  });

  it('2. Debe validar las columnas y tipos de datos de FormularioOficial', async () => {
    const cols = await dataSource.query<ColumnInfo[]>(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'FormularioOficial'
    `);

    const colMap = new Map(cols.map((c) => [c.COLUMN_NAME, c]));

    expect(colMap.get('id')?.DATA_TYPE).toBe('int');
    expect(colMap.get('id')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('tipoSolicitudId')?.DATA_TYPE).toBe('int');
    expect(colMap.get('tipoSolicitudId')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('nombreArchivoOriginal')?.DATA_TYPE).toBe('varchar');
    expect(colMap.get('nombreArchivoOriginal')?.CHARACTER_MAXIMUM_LENGTH).toBe(
      255,
    );
    expect(colMap.get('nombreArchivoOriginal')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('nombreArchivoInterno')?.DATA_TYPE).toBe('varchar');
    expect(colMap.get('nombreArchivoInterno')?.CHARACTER_MAXIMUM_LENGTH).toBe(
      255,
    );
    expect(colMap.get('nombreArchivoInterno')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('mimeType')?.DATA_TYPE).toBe('varchar');
    expect(colMap.get('mimeType')?.CHARACTER_MAXIMUM_LENGTH).toBe(100);
    expect(colMap.get('mimeType')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('tamano')?.DATA_TYPE).toBe('int');
    expect(colMap.get('tamano')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('ubicacionArchivo')?.DATA_TYPE).toBe('varchar');
    expect(colMap.get('ubicacionArchivo')?.CHARACTER_MAXIMUM_LENGTH).toBe(255);
    expect(colMap.get('ubicacionArchivo')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('fechaCarga')?.DATA_TYPE).toBe('datetime2');
    expect(colMap.get('fechaCarga')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('createdAt')?.DATA_TYPE).toBe('datetime2');
    expect(colMap.get('createdAt')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('updatedAt')?.DATA_TYPE).toBe('datetime2');
    expect(colMap.get('updatedAt')?.IS_NULLABLE).toBe('NO');
  });

  it('3. Debe validar la llave foránea con TipoSolicitud', async () => {
    const fks = await dataSource.query<ForeignKeyInfo[]>(`
      SELECT
        fk.name AS FK_NAME,
        t1.name AS TABLE_NAME,
        col1.name AS COLUMN_NAME,
        t2.name AS REF_TABLE,
        col2.name AS REF_COLUMN
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      INNER JOIN sys.tables t1 ON t1.object_id = fk.parent_object_id
      INNER JOIN sys.tables t2 ON t2.object_id = fk.referenced_object_id
      INNER JOIN sys.columns col1 ON col1.column_id = fkc.parent_column_id AND col1.object_id = fk.parent_object_id
      INNER JOIN sys.columns col2 ON col2.column_id = fkc.referenced_column_id AND col2.object_id = fk.referenced_object_id
      WHERE t1.name = 'FormularioOficial'
    `);

    expect(fks.length).toBeGreaterThan(0);
    expect(fks[0]).toEqual(
      expect.objectContaining({
        TABLE_NAME: 'FormularioOficial',
        COLUMN_NAME: 'tipoSolicitudId',
        REF_TABLE: 'TipoSolicitud',
        REF_COLUMN: 'id',
      }),
    );
  });

  it('4. Debe validar la restricción única de tipoSolicitudId (máximo 1 PDF por trámite)', async () => {
    const indices = await dataSource.query<IndexInfo[]>(`
      SELECT
        i.name AS INDEX_NAME,
        c.name AS COLUMN_NAME,
        i.is_unique AS IS_UNIQUE
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
      INNER JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
      INNER JOIN sys.tables t ON t.object_id = i.object_id
      WHERE t.name = 'FormularioOficial'
        AND c.name = 'tipoSolicitudId'
    `);

    expect(indices.length).toBeGreaterThan(0);
    expect(indices.some((idx) => idx.IS_UNIQUE)).toBe(true);
  });

  it('5. Debe insertar metadatos de PDF y rechazar duplicados para el mismo tipoSolicitudId', async () => {
    // Obtener un tipo de solicitud válido
    const tipos = await dataSource.query<{ id: number }[]>(`
      SELECT TOP 1 id FROM TipoSolicitud ORDER BY id ASC
    `);
    expect(tipos.length).toBe(1);
    const tipoId = tipos[0].id;

    // Limpiar previo si existiera
    await dataSource.query(
      `DELETE FROM FormularioOficial WHERE tipoSolicitudId = @0`,
      [tipoId],
    );

    // Insertar primer formulario
    await dataSource.query(
      `
      INSERT INTO FormularioOficial (
        tipoSolicitudId, nombreArchivoOriginal, nombreArchivoInterno,
        mimeType, tamano, ubicacionArchivo, fechaCarga, createdAt, updatedAt
      ) VALUES (@0, @1, @2, @3, @4, @5, SYSUTCDATETIME(), SYSUTCDATETIME(), SYSUTCDATETIME())
    `,
      [
        tipoId,
        'oficial-test.pdf',
        'internal-uuid-1.pdf',
        'application/pdf',
        2048,
        'formularios-oficiales/internal-uuid-1.pdf',
      ],
    );

    // Intentar duplicado debe fallar por restricción única
    await expect(
      dataSource.query(
        `
        INSERT INTO FormularioOficial (
          tipoSolicitudId, nombreArchivoOriginal, nombreArchivoInterno,
          mimeType, tamano, ubicacionArchivo, fechaCarga, createdAt, updatedAt
        ) VALUES (@0, @1, @2, @3, @4, @5, SYSUTCDATETIME(), SYSUTCDATETIME(), SYSUTCDATETIME())
      `,
        [
          tipoId,
          'otro.pdf',
          'internal-uuid-2.pdf',
          'application/pdf',
          1024,
          'formularios-oficiales/internal-uuid-2.pdf',
        ],
      ),
    ).rejects.toThrow();

    // Limpiar registro de prueba
    await dataSource.query(
      `DELETE FROM FormularioOficial WHERE tipoSolicitudId = @0`,
      [tipoId],
    );
  });

  it('6. Debe probar rollback (down) y re-ejecución (up) de la migración FormularioOficial', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    const migFormulario = new CreateFormularioOficialTable1724686120000();

    try {
      // 1. Rollback
      await migFormulario.down(queryRunner);
      expect(await queryRunner.hasTable('FormularioOficial')).toBe(false);

      // Confirmar que TipoSolicitud sigue intacto
      expect(await queryRunner.hasTable('TipoSolicitud')).toBe(true);

      // 2. Re-ejecución up
      await migFormulario.up(queryRunner);
      expect(await queryRunner.hasTable('FormularioOficial')).toBe(true);
    } finally {
      await queryRunner.release();
    }
  });
});
