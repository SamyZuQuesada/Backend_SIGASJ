import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

type ForeignKeyRow = {
  COLUMN_NAME: string;
  REF_TABLE: string;
  REF_COLUMN: string;
  DELETE_ACTION: string;
};

const describeSqlServer =
  process.env.RUN_SQLSERVER_INTEGRATION === 'true' ? describe : describe.skip;

describeSqlServer('Persistencia ObservacionAveria en SQL Server', () => {
  jest.setTimeout(30_000);
  let dataSource: DataSource | null = null;

  beforeAll(async () => {
    const options = buildMigrationDataSourceOptions();
    if (options.type !== 'mssql') {
      throw new Error('Esta suite requiere DB_TYPE=mssql.');
    }
    dataSource = new DataSource(options);
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('la tabla ObservacionAveria existe con FK NO ACTION hacia Averia y Usuario', async () => {
    const db = dataSource;
    if (!db) {
      throw new Error('SQL Server no disponible');
    }

    const tables = await db.query<{ TABLE_NAME: string }[]>(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'ObservacionAveria'
    `);
    expect(tables).toHaveLength(1);

    const foreignKeys = await db.query<ForeignKeyRow[]>(`
      SELECT
        col1.name AS COLUMN_NAME,
        t2.name AS REF_TABLE,
        col2.name AS REF_COLUMN,
        fk.delete_referential_action_desc AS DELETE_ACTION
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc
        ON fkc.constraint_object_id = fk.object_id
      INNER JOIN sys.tables t1 ON t1.object_id = fk.parent_object_id
      INNER JOIN sys.columns col1
        ON col1.column_id = fkc.parent_column_id
        AND col1.object_id = fk.parent_object_id
      INNER JOIN sys.tables t2 ON t2.object_id = fk.referenced_object_id
      INNER JOIN sys.columns col2
        ON col2.column_id = fkc.referenced_column_id
        AND col2.object_id = fk.referenced_object_id
      WHERE t1.name = 'ObservacionAveria'
      ORDER BY col1.name
    `);

    expect(foreignKeys).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          COLUMN_NAME: 'idAveria',
          REF_TABLE: 'Averia',
          REF_COLUMN: 'id',
          DELETE_ACTION: 'NO_ACTION',
        }),
        expect.objectContaining({
          COLUMN_NAME: 'idUsuarioAutor',
          REF_TABLE: 'Usuario',
          REF_COLUMN: 'idUsuario',
          DELETE_ACTION: 'NO_ACTION',
        }),
      ]),
    );
  });

  it('inserta dos observaciones independientes y conserva ambas filas', async () => {
    const db = dataSource;
    if (!db) {
      throw new Error('SQL Server no disponible');
    }

    const suffix = Date.now();
    const createdIds: number[] = [];
    let averiaId: number | null = null;
    let autorId: number | null = null;

    try {
      const usuarioInsert = await db.query<{ idUsuario: number }[]>(
        `INSERT INTO Usuario OUTPUT INSERTED.idUsuario DEFAULT VALUES`,
      );
      autorId =
        usuarioInsert[0]?.idUsuario != null
          ? Number(usuarioInsert[0].idUsuario)
          : null;
      if (autorId == null) {
        throw new Error('No se pudo insertar el Usuario de prueba');
      }

      const averiaInsert = await db.query<{ id: number }[]>(
        `INSERT INTO Averia (
           codigoSeguimiento, nombreReportante, telefonoReportante,
           ubicacion, sectorComunidad, estado, descripcion,
           fechaReporte, createdAt, updatedAt, observacionesAtencion
         )
         OUTPUT INSERTED.id
         VALUES (
           @0, @1, @2, @3, @4, @5, @6, GETDATE(), GETDATE(), GETDATE(), @7
         )`,
        [
          `AV-QA-OBS-${suffix}`,
          'QA Observaciones',
          '8888-0000',
          'Sitio QA',
          'San Juan',
          'ASIGNADA',
          'Fuga QA observaciones',
          'Texto legado QA',
        ],
      );
      averiaId =
        averiaInsert[0]?.id != null ? Number(averiaInsert[0].id) : null;
      if (averiaId == null) {
        throw new Error('No se pudo insertar la Avería de prueba');
      }

      const first = await db.query<{ id: number }[]>(
        `INSERT INTO ObservacionAveria (idAveria, idUsuarioAutor, observacion)
         OUTPUT INSERTED.id
         VALUES (@0, @1, @2)`,
        [averiaId, autorId, 'Primera nota SQL Server'],
      );
      const second = await db.query<{ id: number }[]>(
        `INSERT INTO ObservacionAveria (idAveria, idUsuarioAutor, observacion)
         OUTPUT INSERTED.id
         VALUES (@0, @1, @2)`,
        [averiaId, autorId, 'Segunda nota SQL Server'],
      );
      createdIds.push(Number(first[0]?.id ?? 0), Number(second[0]?.id ?? 0));
      expect(createdIds[0]).toBeGreaterThan(0);
      expect(createdIds[1]).toBeGreaterThan(0);

      const rows = await db.query<
        {
          id: number;
          observacion: string;
          idAveria: number;
          idUsuarioAutor: number;
          fechaCreacion: Date;
        }[]
      >(
        `SELECT id, observacion, idAveria, idUsuarioAutor, fechaCreacion
         FROM ObservacionAveria
         WHERE idAveria = @0
         ORDER BY id`,
        [averiaId],
      );
      expect(rows).toHaveLength(2);
      expect(Number(rows[0]?.idAveria)).toBe(averiaId);
      expect(Number(rows[0]?.idUsuarioAutor)).toBe(autorId);
      expect(Number(rows[1]?.idAveria)).toBe(averiaId);
      expect(Number(rows[1]?.idUsuarioAutor)).toBe(autorId);
      expect(rows[0]?.observacion).toBe('Primera nota SQL Server');
      expect(rows[1]?.observacion).toBe('Segunda nota SQL Server');
      expect(rows[0]?.fechaCreacion).toBeTruthy();
      expect(rows[1]?.fechaCreacion).toBeTruthy();
    } finally {
      if (createdIds.length > 0) {
        await db.query(
          `DELETE FROM ObservacionAveria WHERE id IN (${createdIds.filter((id) => id > 0).join(',') || '0'})`,
        );
      }
      if (averiaId != null) {
        await db.query(`DELETE FROM Averia WHERE id = @0`, [averiaId]);
      }
      if (autorId != null) {
        await db.query(`DELETE FROM Usuario WHERE idUsuario = @0`, [autorId]);
      }
    }
  });

  it('rechaza una observación con Avería o autor inexistentes', async () => {
    const db = dataSource;
    if (!db) {
      throw new Error('SQL Server no disponible');
    }

    await expect(
      db.query(
        `INSERT INTO ObservacionAveria (idAveria, idUsuarioAutor, observacion)
         VALUES (@0, @1, @2)`,
        [999999, 999999, 'No debe persistir'],
      ),
    ).rejects.toThrow();
  });
});
