import { config as loadEnv } from 'dotenv';
import {
  DataSource,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateSolicitudAusenciaTables1724686040000 } from './migrations/1724686040000-CreateSolicitudAusenciaTables';
import { CompleteSolicitudAusenciaModelo1724686060000 } from './migrations/1724686060000-CompleteSolicitudAusenciaModelo';

loadEnv();

type TableRow = { TABLE_NAME: string };
type ColumnRow = {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
  CHARACTER_MAXIMUM_LENGTH: number | null;
};
type ForeignKeyRow = {
  FK_NAME: string;
  COLUMN_NAME: string;
  REF_TABLE: string;
};
type IndexRow = { INDEX_NAME: string; is_unique: boolean };

describe('Migración e integridad SolicitudAusencia (PBI 6.5.1)', () => {
  describe('1. Definición de la migración TypeORM', () => {
    it('define CreateSolicitudAusenciaTables1724686040000', () => {
      const migration = new CreateSolicitudAusenciaTables1724686040000();
      expect(migration.name).toBe('CreateSolicitudAusenciaTables1724686040000');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('crea SolicitudAusencia con PK, FKs, enums, índices y UNIQUE jotform', async () => {
      const migration = new CreateSolicitudAusenciaTables1724686040000();
      let createdSolicitud: Table | undefined;
      const foreignKeys: TableForeignKey[] = [];
      const indexes: TableIndex[] = [];

      const mockQueryRunner = {
        connection: { options: { type: 'mssql' } },
        hasTable: jest.fn().mockResolvedValue(false),
        createTable: jest.fn().mockImplementation((table: Table) => {
          if (table.name === 'SolicitudAusencia') {
            createdSolicitud = table;
          }
          return Promise.resolve();
        }),
        createForeignKey: jest
          .fn()
          .mockImplementation((_table: string, fk: TableForeignKey) => {
            foreignKeys.push(fk);
            return Promise.resolve();
          }),
        createIndex: jest
          .fn()
          .mockImplementation((_table: string, index: TableIndex) => {
            if (
              index.name?.startsWith('IX_SolicitudAusencia') ||
              index.name?.startsWith('UQ_SolicitudAusencia')
            ) {
              indexes.push(index);
            }
            return Promise.resolve();
          }),
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);

      expect(createdSolicitud?.name).toBe('SolicitudAusencia');
      const colMap = new Map(
        (createdSolicitud?.columns ?? []).map((column) => [
          column.name,
          column,
        ]),
      );
      expect([...colMap.keys()]).toEqual(
        expect.arrayContaining([
          'id',
          'colaboradorId',
          'tipo',
          'fechaInicio',
          'fechaFin',
          'motivo',
          'observaciones',
          'estado',
          'jotformSubmissionId',
          'reviewedAt',
          'reviewedByUsuarioId',
          'motivoRechazo',
          'createdAt',
          'updatedAt',
        ]),
      );
      expect(colMap.get('id')?.isPrimary).toBe(true);
      expect(colMap.get('fechaInicio')?.type).toBe('date');
      expect(colMap.get('fechaFin')?.type).toBe('date');
      expect(colMap.get('observaciones')?.isNullable).toBe(true);
      expect(colMap.get('estado')?.default).toBe("'PENDIENTE'");
      expect(colMap.get('createdAt')?.type).toBe('datetime2');

      expect(foreignKeys.map((fk) => fk.name)).toEqual(
        expect.arrayContaining([
          'FK_SolicitudAusencia_Colaborador',
          'FK_SolicitudAusencia_UsuarioRevisor',
        ]),
      );
      expect(
        foreignKeys.find(
          (fk) => fk.name === 'FK_SolicitudAusencia_Colaborador',
        ),
      ).toMatchObject({
        columnNames: ['colaboradorId'],
        referencedTableName: 'Colaborador',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      });
      expect(
        foreignKeys.find(
          (fk) => fk.name === 'FK_SolicitudAusencia_UsuarioRevisor',
        ),
      ).toMatchObject({
        columnNames: ['reviewedByUsuarioId'],
        referencedTableName: 'Usuario',
        referencedColumnNames: ['idUsuario'],
        onDelete: 'SET NULL',
      });

      expect(indexes.map((index) => index.name).sort()).toEqual([
        'IX_SolicitudAusencia_colaboradorId',
        'IX_SolicitudAusencia_estado',
        'UQ_SolicitudAusencia_jotformSubmissionId',
      ]);
      expect(
        indexes.find(
          (i) => i.name === 'UQ_SolicitudAusencia_jotformSubmissionId',
        )?.isUnique,
      ).toBe(true);
    });

    it('down elimina FKs y tabla SolicitudAusencia', async () => {
      const migration = new CreateSolicitudAusenciaTables1724686040000();
      const llamadas: string[] = [];
      const mockQueryRunner = {
        hasTable: jest.fn().mockResolvedValue(true),
        getTable: jest.fn().mockResolvedValue({
          foreignKeys: [
            { name: 'FK_SolicitudAusencia_UsuarioRevisor' },
            { name: 'FK_SolicitudAusencia_Colaborador' },
          ],
        }),
        dropForeignKey: jest
          .fn()
          .mockImplementation((_t: string, fk: { name: string }) => {
            llamadas.push(fk.name);
            return Promise.resolve();
          }),
        dropTable: jest.fn().mockImplementation((name: string) => {
          llamadas.push(`drop:${name}`);
          return Promise.resolve();
        }),
      } as unknown as QueryRunner;

      await migration.down(mockQueryRunner);

      expect(llamadas).toEqual([
        'FK_SolicitudAusencia_UsuarioRevisor',
        'FK_SolicitudAusencia_Colaborador',
        'drop:SolicitudAusencia',
        'drop:CorrelacionSolicitudAusencia',
      ]);
    });
  });

  describe('2. Persistencia e integridad (sqljs + migración)', () => {
    let dataSource: DataSource;
    let colaboradorId: number;

    type SolicitudRow = {
      id: number;
      colaboradorId: number;
      tipo: string;
      fechaInicio: string;
      fechaFin: string;
      motivo: string | null;
      observaciones: string | null;
      estado: string;
      jotformSubmissionId: string;
      reviewedAt: string | null;
      reviewedByUsuarioId: number | null;
    };

    beforeAll(async () => {
      dataSource = new DataSource({
        type: 'sqljs',
        autoSave: false,
        entities: [],
        synchronize: false,
      });
      await dataSource.initialize();
      await dataSource.query('PRAGMA foreign_keys = ON');
      const queryRunner = dataSource.createQueryRunner();

      await queryRunner.query(`
        CREATE TABLE "Colaborador" (
          "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          "nombre" varchar(100) NOT NULL
        )
      `);
      await queryRunner.query(`
        CREATE TABLE "Usuario" (
          "idUsuario" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
          "nombre" varchar(150) NOT NULL
        )
      `);

      const migration = new CreateSolicitudAusenciaTables1724686040000();
      await migration.up(queryRunner);

      await queryRunner.query(
        `INSERT INTO "Colaborador" ("nombre") VALUES ('Fontanero QA')`,
      );
      const rows = (await queryRunner.query(
        `SELECT last_insert_rowid() AS id`,
      )) as Array<{ id: number }>;
      colaboradorId = Number(rows[0]?.id);

      await queryRunner.release();
    });

    afterAll(async () => {
      if (dataSource?.isInitialized) {
        await dataSource.destroy();
      }
    });

    beforeEach(async () => {
      await dataSource.query('PRAGMA foreign_keys = ON');
      await dataSource.query(`DELETE FROM "SolicitudAusencia"`);
    });

    it('crea y revierte SolicitudAusencia (UP → DOWN → UP)', async () => {
      const isolated = new DataSource({
        type: 'sqljs',
        autoSave: false,
        entities: [],
        synchronize: false,
      });
      await isolated.initialize();
      const queryRunner = isolated.createQueryRunner();
      await queryRunner.query(
        `CREATE TABLE "Colaborador" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL)`,
      );
      await queryRunner.query(
        `CREATE TABLE "Usuario" ("idUsuario" integer PRIMARY KEY AUTOINCREMENT NOT NULL)`,
      );
      const migration = new CreateSolicitudAusenciaTables1724686040000();

      await migration.up(queryRunner);
      expect(await queryRunner.getTable('SolicitudAusencia')).toBeTruthy();
      await migration.down(queryRunner);
      expect(await queryRunner.getTable('SolicitudAusencia')).toBeFalsy();
      await migration.up(queryRunner);
      expect(await queryRunner.getTable('SolicitudAusencia')).toBeTruthy();

      await isolated.destroy();
    });

    it('persiste solicitud PERMISO con campos del modelo', async () => {
      await dataSource.query(
        `INSERT INTO "SolicitudAusencia"
          ("colaboradorId", "tipo", "fechaInicio", "fechaFin", "motivo", "observaciones",
           "estado", "jotformSubmissionId", "reviewedAt", "reviewedByUsuarioId",
           "motivoRechazo", "registroGeneradoId", "registroGeneradoTipo",
           "createdAt", "updatedAt")
         VALUES (?, 'PERMISO', '2026-11-01', '2026-11-02', 'Trámite', NULL,
                 'PENDIENTE', 'sub-perm-sqljs-1', NULL, NULL, NULL, NULL, NULL,
                 datetime('now'), datetime('now'))`,
        [colaboradorId],
      );

      const rows = await dataSource.query<SolicitudRow[]>(
        `SELECT * FROM "SolicitudAusencia" WHERE "jotformSubmissionId" = ?`,
        ['sub-perm-sqljs-1'],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.colaboradorId).toBe(colaboradorId);
      expect(rows[0]?.tipo).toBe('PERMISO');
      expect(String(rows[0]?.fechaInicio).slice(0, 10)).toBe('2026-11-01');
      expect(String(rows[0]?.fechaFin).slice(0, 10)).toBe('2026-11-02');
      expect(rows[0]?.motivo).toBe('Trámite');
      expect(rows[0]?.observaciones).toBeNull();
      expect(rows[0]?.estado).toBe('PENDIENTE');
      expect(rows[0]?.jotformSubmissionId).toBe('sub-perm-sqljs-1');
      expect(rows[0]?.reviewedByUsuarioId).toBeNull();
    });

    it('persiste solicitud VACACIONES y permite observaciones null en PENDIENTE', async () => {
      await dataSource.query(
        `INSERT INTO "SolicitudAusencia"
          ("colaboradorId", "tipo", "fechaInicio", "fechaFin", "motivo", "observaciones",
           "estado", "jotformSubmissionId", "createdAt", "updatedAt")
         VALUES (?, 'VACACIONES', '2026-12-01', '2026-12-05', 'Descanso', NULL,
                 'PENDIENTE', 'sub-vac-sqljs-1', datetime('now'), datetime('now'))`,
        [colaboradorId],
      );
      const rows = await dataSource.query<SolicitudRow[]>(
        `SELECT "tipo", "estado", "observaciones" FROM "SolicitudAusencia"`,
      );
      expect(rows[0]?.tipo).toBe('VACACIONES');
      expect(rows[0]?.estado).toBe('PENDIENTE');
      expect(rows[0]?.observaciones).toBeNull();
    });

    it('la FK impide asociar a un Colaborador inexistente', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO "SolicitudAusencia"
            ("colaboradorId", "tipo", "fechaInicio", "fechaFin", "motivo",
             "estado", "jotformSubmissionId", "createdAt", "updatedAt")
           VALUES (999999, 'PERMISO', '2026-11-01', '2026-11-02', NULL,
                   'PENDIENTE', 'sub-fk-fail', datetime('now'), datetime('now'))`,
        ),
      ).rejects.toThrow();
    });

    it('rechaza jotformSubmissionId duplicado (UNIQUE)', async () => {
      await dataSource.query(
        `INSERT INTO "SolicitudAusencia"
          ("colaboradorId", "tipo", "fechaInicio", "fechaFin", "motivo",
           "estado", "jotformSubmissionId", "createdAt", "updatedAt")
         VALUES (?, 'PERMISO', '2026-11-01', '2026-11-01', NULL,
                 'PENDIENTE', 'sub-dup', datetime('now'), datetime('now'))`,
        [colaboradorId],
      );

      await expect(
        dataSource.query(
          `INSERT INTO "SolicitudAusencia"
            ("colaboradorId", "tipo", "fechaInicio", "fechaFin", "motivo",
             "estado", "jotformSubmissionId", "createdAt", "updatedAt")
           VALUES (?, 'VACACIONES', '2026-12-01', '2026-12-02', NULL,
                   'PENDIENTE', 'sub-dup', datetime('now'), datetime('now'))`,
          [colaboradorId],
        ),
      ).rejects.toThrow();
    });
  });

  describe('3. Verificación de esquema físico en SQL Server', () => {
    let dataSource: DataSource | null = null;
    let isConnected = false;

    beforeAll(async () => {
      try {
        const options = buildMigrationDataSourceOptions();
        if (options.type === 'mssql') {
          dataSource = new DataSource(options);
          await dataSource.initialize();
          isConnected = true;
        }
      } catch (error) {
        isConnected = false;
        console.warn(
          '[AVISO QA] SQL Server no está disponible:',
          error instanceof Error ? error.message : error,
        );
      }
    }, 15_000);

    afterAll(async () => {
      if (dataSource?.isInitialized) {
        await dataSource.destroy();
      }
    });

    const requireSqlServer = (): DataSource => {
      if (!isConnected || !dataSource) {
        pending('SQL Server no está disponible: esquema físico no verificado');
        throw new Error('SQL Server no disponible');
      }
      return dataSource;
    };

    it('aplica CompleteSolicitudAusenciaModelo y confirma tabla', async () => {
      const db = requireSqlServer();
      const queryRunner = db.createQueryRunner();
      await queryRunner.connect();
      try {
        await new CreateSolicitudAusenciaTables1724686040000().up(queryRunner);
        await new CompleteSolicitudAusenciaModelo1724686060000().up(
          queryRunner,
        );
      } finally {
        await queryRunner.release();
      }

      const tables = await db.query<TableRow[]>(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = 'SolicitudAusencia'
      `);
      expect(tables.length).toBeGreaterThanOrEqual(1);
    });

    it('tiene columnas del modelo 6.5.1 incluyendo observaciones', async () => {
      const db = requireSqlServer();
      const columns = await db.query<ColumnRow[]>(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, CHARACTER_MAXIMUM_LENGTH
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'SolicitudAusencia'
        ORDER BY ORDINAL_POSITION
      `);
      const names = columns.map((c) => c.COLUMN_NAME);
      expect(names).toEqual(
        expect.arrayContaining([
          'colaboradorId',
          'tipo',
          'fechaInicio',
          'fechaFin',
          'motivo',
          'observaciones',
          'estado',
          'jotformSubmissionId',
          'reviewedAt',
          'reviewedByUsuarioId',
          'createdAt',
          'updatedAt',
        ]),
      );
      const obs = columns.find((c) => c.COLUMN_NAME === 'observaciones');
      expect(obs?.IS_NULLABLE).toBe('YES');
      expect(obs?.CHARACTER_MAXIMUM_LENGTH).toBe(500);
      expect(
        columns.find((c) => c.COLUMN_NAME === 'fechaInicio')?.DATA_TYPE,
      ).toBe('date');
    });

    it('tiene índices por colaboradorId, estado y UNIQUE jotform', async () => {
      const db = requireSqlServer();
      const idxs = await db.query<IndexRow[]>(`
        SELECT i.name AS INDEX_NAME, CAST(i.is_unique AS bit) AS is_unique
        FROM sys.indexes i
        WHERE i.object_id = OBJECT_ID('SolicitudAusencia') AND i.name IS NOT NULL
      `);
      const names = idxs.map((i) => i.INDEX_NAME);
      expect(names).toEqual(
        expect.arrayContaining([
          'IX_SolicitudAusencia_colaboradorId',
          'IX_SolicitudAusencia_estado',
          'UQ_SolicitudAusencia_jotformSubmissionId',
        ]),
      );
      expect(
        idxs.find(
          (i) => i.INDEX_NAME === 'UQ_SolicitudAusencia_jotformSubmissionId',
        )?.is_unique,
      ).toBeTruthy();
    });

    it('tiene FK a Colaborador y a Usuario revisor', async () => {
      const db = requireSqlServer();
      const fks = await db.query<ForeignKeyRow[]>(`
        SELECT fk.name AS FK_NAME,
               COL_NAME(fc.parent_object_id, fc.parent_column_id) AS COLUMN_NAME,
               OBJECT_NAME(fk.referenced_object_id) AS REF_TABLE
        FROM sys.foreign_keys fk
        JOIN sys.foreign_key_columns fc ON fk.object_id = fc.constraint_object_id
        WHERE fk.parent_object_id = OBJECT_ID('SolicitudAusencia')
      `);
      expect(fks).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            FK_NAME: 'FK_SolicitudAusencia_Colaborador',
            COLUMN_NAME: 'colaboradorId',
            REF_TABLE: 'Colaborador',
          }),
          expect.objectContaining({
            FK_NAME: 'FK_SolicitudAusencia_UsuarioRevisor',
            COLUMN_NAME: 'reviewedByUsuarioId',
            REF_TABLE: 'Usuario',
          }),
        ]),
      );
    });

    it('persiste y consulta una SolicitudAusencia real en SQL Server', async () => {
      const db = requireSqlServer();
      const colaboradores = await db.query<Array<{ id: number }>>(
        `SELECT TOP 1 id FROM Colaborador ORDER BY id`,
      );
      if (!colaboradores[0]) {
        pending('No hay Colaborador en la BD para prueba de persistencia');
        return;
      }
      const colaboradorId = colaboradores[0].id;
      const submission = `pbi651-${Date.now()}`;

      await db.query(
        `INSERT INTO SolicitudAusencia
          (colaboradorId, tipo, fechaInicio, fechaFin, motivo, observaciones,
           estado, jotformSubmissionId, reviewedAt, reviewedByUsuarioId)
         VALUES (@0, 'PERMISO', '2026-11-10', '2026-11-11', 'Motivo QA', NULL,
                 'PENDIENTE', @1, NULL, NULL)`,
        [colaboradorId, submission],
      );

      const rows = await db.query<
        Array<{
          colaboradorId: number;
          tipo: string;
          motivo: string;
          observaciones: string | null;
          estado: string;
          jotformSubmissionId: string;
        }>
      >(
        `SELECT colaboradorId, tipo, motivo, observaciones, estado, jotformSubmissionId
         FROM SolicitudAusencia WHERE jotformSubmissionId = @0`,
        [submission],
      );

      expect(rows[0]).toMatchObject({
        colaboradorId: Number(colaboradorId),
        tipo: 'PERMISO',
        motivo: 'Motivo QA',
        observaciones: null,
        estado: 'PENDIENTE',
        jotformSubmissionId: submission,
      });
      expect(Number(rows[0]?.colaboradorId)).toBe(Number(colaboradorId));

      await db.query(
        `DELETE FROM SolicitudAusencia WHERE jotformSubmissionId = @0`,
        [submission],
      );
    });

    it('rechaza FK a colaborador inexistente en SQL Server', async () => {
      const db = requireSqlServer();
      await expect(
        db.query(
          `INSERT INTO SolicitudAusencia
            (colaboradorId, tipo, fechaInicio, fechaFin, estado, jotformSubmissionId)
           VALUES (2147483000, 'PERMISO', '2026-11-01', '2026-11-01', 'PENDIENTE', @0)`,
          [`fk-fail-${Date.now()}`],
        ),
      ).rejects.toThrow();
    });

    it('rechaza jotformSubmissionId duplicado en SQL Server', async () => {
      const db = requireSqlServer();
      const colaboradores = await db.query<Array<{ id: number }>>(
        `SELECT TOP 1 id FROM Colaborador ORDER BY id`,
      );
      if (!colaboradores[0]) {
        pending('No hay Colaborador en la BD');
        return;
      }
      const colaboradorId = colaboradores[0].id;
      const submission = `dup-${Date.now()}`;

      await db.query(
        `INSERT INTO SolicitudAusencia
          (colaboradorId, tipo, fechaInicio, fechaFin, estado, jotformSubmissionId)
         VALUES (@0, 'PERMISO', '2026-11-01', '2026-11-01', 'PENDIENTE', @1)`,
        [colaboradorId, submission],
      );

      await expect(
        db.query(
          `INSERT INTO SolicitudAusencia
            (colaboradorId, tipo, fechaInicio, fechaFin, estado, jotformSubmissionId)
           VALUES (@0, 'VACACIONES', '2026-12-01', '2026-12-02', 'PENDIENTE', @1)`,
          [colaboradorId, submission],
        ),
      ).rejects.toThrow();

      await db.query(
        `DELETE FROM SolicitudAusencia WHERE jotformSubmissionId = @0`,
        [submission],
      );
    });
  });
});
