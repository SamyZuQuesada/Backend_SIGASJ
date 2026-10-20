import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { TipoSolicitudSlug } from '../common/enums/tipo-solicitud-slug.enum';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateSolicitudTable1724686100000 } from './migrations/1724686100000-CreateSolicitudTable';
import { CreateTipoSolicitudTable1724686090000 } from './migrations/1724686090000-CreateTipoSolicitudTable';
import { CreateSolicitudArregloPagoTable1724686110000 } from './migrations/1724686110000-CreateSolicitudArregloPagoTable';
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
  ON_DELETE: string;
  ON_UPDATE: string;
};

describe('Validación física de tablas TipoSolicitud y Solicitud en SQL Server', () => {
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

  it('1. Debe confirmar que no hay migraciones pendientes en SQL Server', async () => {
    const pending = await dataSource.showMigrations();
    expect(pending).toBe(false);
  });

  it('2. Debe confirmar que las tablas TipoSolicitud y Solicitud existen en dbo', async () => {
    const rows = await dataSource.query<TableCountRow[]>(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME IN ('TipoSolicitud', 'Solicitud')
    `);

    expect(Number(rows[0]?.total)).toBe(2);
  });

  it('3. Debe validar las columnas y tipos de datos para TipoSolicitud en SQL Server', async () => {
    const cols = await dataSource.query<ColumnInfo[]>(`
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'TipoSolicitud'
      ORDER BY ORDINAL_POSITION
    `);

    const colMap = new Map(cols.map((c) => [c.COLUMN_NAME, c]));

    expect(colMap.get('id')?.DATA_TYPE).toBe('int');
    expect(colMap.get('id')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('nombre')?.DATA_TYPE).toBe('varchar');
    expect(colMap.get('nombre')?.CHARACTER_MAXIMUM_LENGTH).toBe(150);
    expect(colMap.get('nombre')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('descripcion')?.DATA_TYPE).toBe('varchar');
    expect(colMap.get('descripcion')?.CHARACTER_MAXIMUM_LENGTH).toBe(500);
    expect(colMap.get('descripcion')?.IS_NULLABLE).toBe('YES');

    expect(colMap.get('slug')?.DATA_TYPE).toBe('varchar');
    expect(colMap.get('slug')?.CHARACTER_MAXIMUM_LENGTH).toBe(100);
    expect(colMap.get('slug')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('activo')?.DATA_TYPE).toBe('bit');
    expect(colMap.get('activo')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('createdAt')?.DATA_TYPE).toBe('datetime2');
    expect(colMap.get('createdAt')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('updatedAt')?.DATA_TYPE).toBe('datetime2');
    expect(colMap.get('updatedAt')?.IS_NULLABLE).toBe('NO');
  });

  it('4. Debe validar las columnas y tipos de datos para Solicitud en SQL Server', async () => {
    const cols = await dataSource.query<ColumnInfo[]>(`
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'Solicitud'
      ORDER BY ORDINAL_POSITION
    `);

    const colMap = new Map(cols.map((c) => [c.COLUMN_NAME, c]));

    expect(colMap.get('id')?.DATA_TYPE).toBe('int');
    expect(colMap.get('id')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('tipoSolicitudId')?.DATA_TYPE).toBe('int');
    expect(colMap.get('tipoSolicitudId')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('codigoSeguimiento')?.DATA_TYPE).toBe('varchar');
    expect(colMap.get('codigoSeguimiento')?.CHARACTER_MAXIMUM_LENGTH).toBe(50);
    expect(colMap.get('codigoSeguimiento')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('estado')?.DATA_TYPE).toBe('varchar');
    expect(colMap.get('estado')?.CHARACTER_MAXIMUM_LENGTH).toBe(30);
    expect(colMap.get('estado')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('fechaIngreso')?.DATA_TYPE).toBe('datetime2');
    expect(colMap.get('fechaIngreso')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('deletedAt')?.DATA_TYPE).toBe('datetime2');
    expect(colMap.get('deletedAt')?.IS_NULLABLE).toBe('YES');

    expect(colMap.get('createdAt')?.DATA_TYPE).toBe('datetime2');
    expect(colMap.get('createdAt')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('updatedAt')?.DATA_TYPE).toBe('datetime2');
    expect(colMap.get('updatedAt')?.IS_NULLABLE).toBe('NO');
  });

  it('5. Debe validar la llave foránea entre Solicitud y TipoSolicitud', async () => {
    const fks = await dataSource.query<ForeignKeyInfo[]>(`
      SELECT
        fk.name AS FK_NAME,
        tp.name AS TABLE_NAME,
        cp.name AS COLUMN_NAME,
        tr.name AS REF_TABLE,
        cr.name AS REF_COLUMN,
        fk.delete_referential_action_desc AS ON_DELETE,
        fk.update_referential_action_desc AS ON_UPDATE
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      INNER JOIN sys.tables tp ON tp.object_id = fk.parent_object_id
      INNER JOIN sys.tables tr ON tr.object_id = fk.referenced_object_id
      INNER JOIN sys.columns cp ON cp.object_id = tp.object_id AND cp.column_id = fkc.parent_column_id
      INNER JOIN sys.columns cr ON cr.object_id = tr.object_id AND cr.column_id = fkc.referenced_column_id
      WHERE tp.name = 'Solicitud'
        AND tr.name = 'TipoSolicitud'
    `);

    expect(fks.length).toBeGreaterThan(0);
    expect(fks[0]).toEqual(
      expect.objectContaining({
        TABLE_NAME: 'Solicitud',
        COLUMN_NAME: 'tipoSolicitudId',
        REF_TABLE: 'TipoSolicitud',
        REF_COLUMN: 'id',
        ON_DELETE: 'NO_ACTION',
        ON_UPDATE: 'NO_ACTION',
      }),
    );
  });

  it('6. Debe validar el índice y restricción única de slug en TipoSolicitud', async () => {
    const indices = await dataSource.query<IndexInfo[]>(`
      SELECT
        i.name AS INDEX_NAME,
        c.name AS COLUMN_NAME,
        i.is_unique AS IS_UNIQUE
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
      INNER JOIN sys.columns c ON c.object_id = i.object_id AND c.column_id = ic.column_id
      WHERE i.object_id = OBJECT_ID('dbo.TipoSolicitud')
        AND c.name = 'slug'
    `);

    expect(indices.length).toBeGreaterThan(0);
    expect(indices.some((idx) => idx.IS_UNIQUE)).toBe(true);

    // Probar que SQL Server rechaza slugs duplicados
    await expect(
      dataSource.query(`
        INSERT INTO TipoSolicitud (nombre, descripcion, slug, activo, createdAt, updatedAt)
        VALUES ('Prueba Duplicado', 'Desc', 'arreglo-pago', 1, GETDATE(), GETDATE())
      `),
    ).rejects.toThrow();
  });

  it('7. Debe validar el índice y restricción única de codigoSeguimiento en Solicitud', async () => {
    const indices = await dataSource.query<IndexInfo[]>(`
      SELECT
        i.name AS INDEX_NAME,
        c.name AS COLUMN_NAME,
        i.is_unique AS IS_UNIQUE
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
      INNER JOIN sys.columns c ON c.object_id = i.object_id AND c.column_id = ic.column_id
      WHERE i.object_id = OBJECT_ID('dbo.Solicitud')
        AND c.name = 'codigoSeguimiento'
    `);

    expect(indices.length).toBeGreaterThan(0);
    expect(indices.some((idx) => idx.IS_UNIQUE)).toBe(true);

    // Obtener un tipo válido
    const tipos = await dataSource.query<{ id: number }[]>(`
      SELECT TOP 1 id FROM TipoSolicitud
    `);
    const tipoId = tipos[0].id;
    const testCode = 'TEST-SOL-DUP-001';

    // Insertar primera solicitud de prueba
    await dataSource.query(`
      INSERT INTO Solicitud (tipoSolicitudId, codigoSeguimiento, estado, fechaIngreso, createdAt, updatedAt)
      VALUES (${tipoId}, '${testCode}', 'PENDIENTE', GETDATE(), GETDATE(), GETDATE())
    `);

    try {
      // Intentar insertar solicitud con el mismo código de seguimiento debe fallar por UQ
      await expect(
        dataSource.query(`
          INSERT INTO Solicitud (tipoSolicitudId, codigoSeguimiento, estado, fechaIngreso, createdAt, updatedAt)
          VALUES (${tipoId}, '${testCode}', 'PENDIENTE', GETDATE(), GETDATE(), GETDATE())
        `),
      ).rejects.toThrow();
    } finally {
      // Limpieza de prueba
      await dataSource.query(`
        DELETE FROM Solicitud WHERE codigoSeguimiento = '${testCode}'
      `);
    }
  });

  it('8. Debe contener los 6 trámites oficiales registrados en TipoSolicitud', async () => {
    const tipos = await dataSource.query<{ slug: string; nombre: string }[]>(`
      SELECT slug, nombre FROM TipoSolicitud
    `);

    expect(tipos.length).toBeGreaterThanOrEqual(6);
    const slugs = tipos.map((t) => t.slug);

    expect(slugs).toContain(TipoSolicitudSlug.ARREGLO_PAGO);
    expect(slugs).toContain(TipoSolicitudSlug.CAMBIO_TITULAR);
    expect(slugs).toContain(TipoSolicitudSlug.INFRAESTRUCTURA_LINDEROS);
    expect(slugs).toContain(TipoSolicitudSlug.AFILIACION);
    expect(slugs).toContain(TipoSolicitudSlug.DISPONIBILIDAD_SERVICIOS);
    expect(slugs).toContain(TipoSolicitudSlug.SERVICIO_EXISTENTE);
  });

  it('9. Debe probar rollback (down) y re-ejecución (up) sin afectar estructuras existentes', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    const migArreglo = new CreateSolicitudArregloPagoTable1724686110000();
    const migFormulario = new CreateFormularioOficialTable1724686120000();
    const migSolicitud = new CreateSolicitudTable1724686100000();
    const migTipoSolicitud = new CreateTipoSolicitudTable1724686090000();

    try {
      // 0. Rollback de tablas hijas dependientes si existen
      if (await queryRunner.hasTable('SolicitudArregloPago')) {
        await migArreglo.down(queryRunner);
      }
      if (await queryRunner.hasTable('FormularioOficial')) {
        await migFormulario.down(queryRunner);
      }

      // 1. Rollback de Solicitud (dropea FK y tabla)
      await migSolicitud.down(queryRunner);
      expect(await queryRunner.hasTable('Solicitud')).toBe(false);

      // 2. Rollback de TipoSolicitud
      await migTipoSolicitud.down(queryRunner);
      expect(await queryRunner.hasTable('TipoSolicitud')).toBe(false);

      // 3. Confirmar que tablas preexistentes del sistema no fueron afectadas
      expect(await queryRunner.hasTable('Usuario')).toBe(true);
      expect(await queryRunner.hasTable('Averia')).toBe(true);

      // 4. Re-ejecución up de migraciones
      await migTipoSolicitud.up(queryRunner);
      expect(await queryRunner.hasTable('TipoSolicitud')).toBe(true);

      await migSolicitud.up(queryRunner);
      expect(await queryRunner.hasTable('Solicitud')).toBe(true);

      await migArreglo.up(queryRunner);
      expect(await queryRunner.hasTable('SolicitudArregloPago')).toBe(true);

      await migFormulario.up(queryRunner);
      expect(await queryRunner.hasTable('FormularioOficial')).toBe(true);

      // Verificar que los 6 tipos vuelven a estar sembrados
      const seedCount = (await queryRunner.query(`
        SELECT COUNT(*) AS total FROM TipoSolicitud
      `)) as TableCountRow[];
      expect(Number(seedCount[0]?.total)).toBe(6);
    } finally {
      await queryRunner.release();
    }
  });
});
