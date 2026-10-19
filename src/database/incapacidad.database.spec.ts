import { config as loadEnv } from 'dotenv';
import {
  DataSource,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';
import { aFechaIso } from '../modules/recursos-humanos/fecha-permiso';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateIncapacidadTable1724686000000 } from './migrations/1724686000000-CreateIncapacidadTable';

loadEnv();

type TableRow = { TABLE_NAME: string };
type ColumnRow = {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
  CHARACTER_MAXIMUM_LENGTH: number | null;
  COLUMN_DEFAULT: string | null;
};
type ForeignKeyRow = {
  FK_NAME: string;
  COLUMN_NAME: string;
  REF_TABLE: string;
  REF_COLUMN: string;
  DELETE_ACTION: string;
  UPDATE_ACTION: string;
};
type IndexRow = { INDEX_NAME: string };
type PkRow = { COLUMN_NAME: string };
type IdentityRow = { is_identity: boolean };
type InsertIdRow = { id: number };
type IncapacidadPersistidaRow = {
  id: number;
  colaboradorId: number;
  fechaInicio: Date | string;
  fechaFin: Date | string;
  observaciones: string | null;
  createdAt: Date;
  updatedAt: Date;
};

describe('Migración e integridad Incapacidad', () => {
  describe('1. Definición de la migración TypeORM', () => {
    it('define CreateIncapacidadTable1724686000000', () => {
      const migration = new CreateIncapacidadTable1724686000000();
      expect(migration.name).toBe('CreateIncapacidadTable1724686000000');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('crea Incapacidad con PK, FK, fechas, observaciones y auditoría', async () => {
      const migration = new CreateIncapacidadTable1724686000000();
      let createdTable: Table | undefined;
      const foreignKeys: TableForeignKey[] = [];
      const indexes: TableIndex[] = [];

      const mockQueryRunner = {
        connection: { options: { type: 'mssql' } },
        hasTable: jest.fn().mockResolvedValue(false),
        createTable: jest.fn().mockImplementation((table: Table) => {
          createdTable = table;
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
            indexes.push(index);
            return Promise.resolve();
          }),
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);

      expect(createdTable?.name).toBe('Incapacidad');
      const colMap = new Map(
        (createdTable?.columns ?? []).map((column) => [column.name, column]),
      );
      expect([...colMap.keys()]).toEqual([
        'id',
        'colaboradorId',
        'fechaInicio',
        'fechaFin',
        'observaciones',
        'createdAt',
        'updatedAt',
      ]);
      expect(colMap.get('id')?.isPrimary).toBe(true);
      expect(colMap.get('id')?.isGenerated).toBe(true);
      expect(colMap.get('colaboradorId')?.isNullable).toBe(false);
      expect(colMap.get('fechaInicio')?.type).toBe('date');
      expect(colMap.get('fechaFin')?.type).toBe('date');
      expect(colMap.get('observaciones')?.isNullable).toBe(true);
      expect(colMap.get('observaciones')?.length).toBe('500');
      expect(colMap.get('createdAt')?.type).toBe('datetime2');
      expect(colMap.get('createdAt')?.default).toBe('GETDATE()');
      expect(colMap.get('updatedAt')?.type).toBe('datetime2');
      expect(colMap.get('updatedAt')?.default).toBe('GETDATE()');

      expect(foreignKeys).toHaveLength(1);
      expect(foreignKeys[0]).toMatchObject({
        name: 'FK_Incapacidad_Colaborador',
        columnNames: ['colaboradorId'],
        referencedTableName: 'Colaborador',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      });

      expect(indexes.map((index) => index.name)).toEqual([
        'IX_Incapacidad_colaboradorId',
        'IX_Incapacidad_fechas',
      ]);
      expect(indexes[1]?.columnNames).toEqual(['fechaInicio', 'fechaFin']);
    });

    it('usa tipos portables fuera de SQL Server', async () => {
      const migration = new CreateIncapacidadTable1724686000000();
      let createdTable: Table | undefined;
      const mockQueryRunner = {
        connection: { options: { type: 'postgres' } },
        hasTable: jest.fn().mockResolvedValue(false),
        createTable: jest.fn().mockImplementation((table: Table) => {
          createdTable = table;
          return Promise.resolve();
        }),
        createForeignKey: jest.fn().mockResolvedValue(undefined),
        createIndex: jest.fn().mockResolvedValue(undefined),
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);

      const createdAt = createdTable?.columns.find(
        (column) => column.name === 'createdAt',
      );
      const updatedAt = createdTable?.columns.find(
        (column) => column.name === 'updatedAt',
      );
      expect(createdAt?.type).toBe('datetime');
      expect(createdAt?.default).toBe('CURRENT_TIMESTAMP');
      expect(updatedAt?.type).toBe('datetime');
      expect(updatedAt?.default).toBe('CURRENT_TIMESTAMP');
    });

    it('no recrea la tabla si ya existe', async () => {
      const migration = new CreateIncapacidadTable1724686000000();
      const createTable = jest.fn();
      const mockQueryRunner = {
        connection: { options: { type: 'mssql' } },
        hasTable: jest.fn().mockResolvedValue(true),
        createTable,
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);
      expect(createTable).not.toHaveBeenCalled();
    });

    it('down elimina FK, índices y tabla en orden', async () => {
      const migration = new CreateIncapacidadTable1724686000000();
      const llamadas: string[] = [];
      const mockQueryRunner = {
        getTable: jest.fn().mockResolvedValue({
          foreignKeys: [{ name: 'FK_Incapacidad_Colaborador' }],
          indices: [
            { name: 'IX_Incapacidad_colaboradorId' },
            { name: 'IX_Incapacidad_fechas' },
          ],
        }),
        dropForeignKey: jest.fn().mockImplementation(() => {
          llamadas.push('fk');
          return Promise.resolve();
        }),
        dropIndex: jest
          .fn()
          .mockImplementation((_t: string, index: { name: string }) => {
            llamadas.push(index.name);
            return Promise.resolve();
          }),
        dropTable: jest.fn().mockImplementation(() => {
          llamadas.push('table');
          return Promise.resolve();
        }),
      } as unknown as QueryRunner;

      await migration.down(mockQueryRunner);

      expect(llamadas).toEqual([
        'fk',
        'IX_Incapacidad_fechas',
        'IX_Incapacidad_colaboradorId',
        'table',
      ]);
    });

    it('down no falla si la tabla no existe', async () => {
      const migration = new CreateIncapacidadTable1724686000000();
      const dropTable = jest.fn();
      const mockQueryRunner = {
        getTable: jest.fn().mockResolvedValue(undefined),
        dropTable,
      } as unknown as QueryRunner;

      await migration.down(mockQueryRunner);
      expect(dropTable).not.toHaveBeenCalled();
    });
  });

  describe('2. Persistencia e integridad (sqljs + migración)', () => {
    let dataSource: DataSource;
    let colaboradorId: number;

    type IncapacidadRow = {
      id: number;
      colaboradorId: number;
      fechaInicio: string;
      fechaFin: string;
      observaciones: string | null;
      createdAt: string;
      updatedAt: string;
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

      const migration = new CreateIncapacidadTable1724686000000();
      await migration.up(queryRunner);

      await queryRunner.query(
        `INSERT INTO "Colaborador" ("nombre") VALUES ('Ana')`,
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
      await dataSource.query(`DELETE FROM "Incapacidad"`);
    });

    it('crea y revierte la tabla sobre Colaborador existente', async () => {
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
      const migration = new CreateIncapacidadTable1724686000000();

      await migration.up(queryRunner);
      expect(await queryRunner.getTable('Incapacidad')).toBeTruthy();
      await migration.up(queryRunner);
      expect(await queryRunner.getTable('Incapacidad')).toBeTruthy();
      await migration.down(queryRunner);
      expect(await queryRunner.getTable('Incapacidad')).toBeFalsy();

      await isolated.destroy();
    });

    it('puede crear una incapacidad asociada a un Colaborador', async () => {
      await dataSource.query(
        `INSERT INTO "Incapacidad"
          ("colaboradorId", "fechaInicio", "fechaFin", "observaciones", "createdAt", "updatedAt")
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [colaboradorId, '2026-10-12', '2026-10-20', 'Incapacidad registrada.'],
      );

      const rows = await dataSource.query<IncapacidadRow[]>(
        `SELECT * FROM "Incapacidad" WHERE "colaboradorId" = ?`,
        [colaboradorId],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBeGreaterThan(0);
      expect(rows[0]?.colaboradorId).toBe(colaboradorId);
    });

    it('un Colaborador puede tener múltiples incapacidades', async () => {
      await dataSource.query(
        `INSERT INTO "Incapacidad"
          ("colaboradorId", "fechaInicio", "fechaFin", "observaciones", "createdAt", "updatedAt")
         VALUES (?, '2026-01-01', '2026-01-05', NULL, datetime('now'), datetime('now'))`,
        [colaboradorId],
      );
      await dataSource.query(
        `INSERT INTO "Incapacidad"
          ("colaboradorId", "fechaInicio", "fechaFin", "observaciones", "createdAt", "updatedAt")
         VALUES (?, '2026-03-10', '2026-03-15', 'Documento entregado a administración', datetime('now'), datetime('now'))`,
        [colaboradorId],
      );

      const rows = await dataSource.query<IncapacidadRow[]>(
        `SELECT * FROM "Incapacidad" WHERE "colaboradorId" = ?`,
        [colaboradorId],
      );
      expect(rows).toHaveLength(2);
    });

    it('almacena fechaInicio y fechaFin del periodo', async () => {
      await dataSource.query(
        `INSERT INTO "Incapacidad"
          ("colaboradorId", "fechaInicio", "fechaFin", "observaciones", "createdAt", "updatedAt")
         VALUES (?, '2026-10-12', '2026-10-20', NULL, datetime('now'), datetime('now'))`,
        [colaboradorId],
      );
      const rows = await dataSource.query<
        Array<{ fechaInicio: string; fechaFin: string }>
      >(`SELECT "fechaInicio", "fechaFin" FROM "Incapacidad"`);

      expect(String(rows[0]?.fechaInicio).slice(0, 10)).toBe('2026-10-12');
      expect(String(rows[0]?.fechaFin).slice(0, 10)).toBe('2026-10-20');
    });

    it('puede almacenar observaciones administrativas', async () => {
      await dataSource.query(
        `INSERT INTO "Incapacidad"
          ("colaboradorId", "fechaInicio", "fechaFin", "observaciones", "createdAt", "updatedAt")
         VALUES (?, '2026-10-01', '2026-10-03', 'Documento entregado a administración', datetime('now'), datetime('now'))`,
        [colaboradorId],
      );
      const rows = await dataSource.query<
        Array<{ observaciones: string | null }>
      >(`SELECT "observaciones" FROM "Incapacidad"`);
      expect(rows[0]?.observaciones).toBe(
        'Documento entregado a administración',
      );
    });

    it('permite omitir observaciones (null)', async () => {
      await dataSource.query(
        `INSERT INTO "Incapacidad"
          ("colaboradorId", "fechaInicio", "fechaFin", "observaciones", "createdAt", "updatedAt")
         VALUES (?, '2026-11-01', '2026-11-02', NULL, datetime('now'), datetime('now'))`,
        [colaboradorId],
      );
      const rows = await dataSource.query<
        Array<{ observaciones: string | null }>
      >(`SELECT "observaciones" FROM "Incapacidad"`);
      expect(rows[0]?.observaciones).toBeNull();
    });

    it('persiste createdAt y updatedAt', async () => {
      await dataSource.query(
        `INSERT INTO "Incapacidad"
          ("colaboradorId", "fechaInicio", "fechaFin", "observaciones", "createdAt", "updatedAt")
         VALUES (?, '2026-12-01', '2026-12-05', NULL, datetime('now'), datetime('now'))`,
        [colaboradorId],
      );
      const rows = await dataSource.query<
        Array<{ createdAt: string; updatedAt: string }>
      >(`SELECT "createdAt", "updatedAt" FROM "Incapacidad"`);

      expect(rows[0]?.createdAt).toBeTruthy();
      expect(rows[0]?.updatedAt).toBeTruthy();
    });

    it('la FK impide asociar una incapacidad a un Colaborador inexistente', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO "Incapacidad"
            ("colaboradorId", "fechaInicio", "fechaFin", "observaciones", "createdAt", "updatedAt")
           VALUES (999999, '2026-10-12', '2026-10-20', NULL, datetime('now'), datetime('now'))`,
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

    it('confirma la existencia de Incapacidad tras migrar', async () => {
      const db = requireSqlServer();
      const queryRunner = db.createQueryRunner();
      await queryRunner.connect();
      try {
        const migration = new CreateIncapacidadTable1724686000000();
        await migration.up(queryRunner);
      } finally {
        await queryRunner.release();
      }

      const tables = await db.query<TableRow[]>(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = 'Incapacidad'
      `);
      expect(tables.length).toBeGreaterThanOrEqual(1);
    });

    it('coincide columnas, tipos y nullability con la entidad 6.4.1', async () => {
      const db = requireSqlServer();
      const columns = await db.query<ColumnRow[]>(`
        SELECT
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          CHARACTER_MAXIMUM_LENGTH,
          COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Incapacidad'
        ORDER BY ORDINAL_POSITION
      `);
      const colMap = new Map(
        columns.map((column) => [column.COLUMN_NAME, column]),
      );

      expect([...colMap.keys()]).toEqual([
        'id',
        'colaboradorId',
        'fechaInicio',
        'fechaFin',
        'observaciones',
        'createdAt',
        'updatedAt',
      ]);

      expect(colMap.get('id')?.DATA_TYPE).toBe('int');
      expect(colMap.get('id')?.IS_NULLABLE).toBe('NO');
      expect(colMap.get('colaboradorId')?.DATA_TYPE).toBe('int');
      expect(colMap.get('colaboradorId')?.IS_NULLABLE).toBe('NO');
      expect(colMap.get('fechaInicio')?.DATA_TYPE).toBe('date');
      expect(colMap.get('fechaInicio')?.IS_NULLABLE).toBe('NO');
      expect(colMap.get('fechaFin')?.DATA_TYPE).toBe('date');
      expect(colMap.get('fechaFin')?.IS_NULLABLE).toBe('NO');
      expect(colMap.get('observaciones')?.DATA_TYPE).toBe('varchar');
      expect(colMap.get('observaciones')?.CHARACTER_MAXIMUM_LENGTH).toBe(500);
      expect(colMap.get('observaciones')?.IS_NULLABLE).toBe('YES');
      expect(colMap.get('createdAt')?.DATA_TYPE).toBe('datetime2');
      expect(colMap.get('createdAt')?.IS_NULLABLE).toBe('NO');
      expect(colMap.get('createdAt')?.COLUMN_DEFAULT).toMatch(
        /getutcdate|sysutcdatetime/i,
      ); // UTC tras la migración UseUtcDefaultsForTimestamps
      expect(colMap.get('updatedAt')?.DATA_TYPE).toBe('datetime2');
      expect(colMap.get('updatedAt')?.IS_NULLABLE).toBe('NO');
      expect(colMap.get('updatedAt')?.COLUMN_DEFAULT).toMatch(
        /getutcdate|sysutcdatetime/i,
      ); // UTC tras la migración UseUtcDefaultsForTimestamps

      expect(colMap.has('diagnostico')).toBe(false);
      expect(colMap.has('enfermedad')).toBe(false);
      expect(colMap.has('tratamiento')).toBe(false);
      expect(colMap.has('medicamentos')).toBe(false);
      expect(colMap.has('sintomas')).toBe(false);
    });

    it('define PK IDENTITY sobre id', async () => {
      const db = requireSqlServer();
      const pkRows = await db.query<PkRow[]>(`
        SELECT kcu.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
          ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
          AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
        WHERE tc.TABLE_NAME = 'Incapacidad'
          AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      `);
      expect(pkRows).toHaveLength(1);
      expect(pkRows[0]?.COLUMN_NAME).toBe('id');

      const identity = await db.query<IdentityRow[]>(`
        SELECT CAST(c.is_identity AS bit) AS is_identity
        FROM sys.columns c
        INNER JOIN sys.tables t ON t.object_id = c.object_id
        WHERE t.name = 'Incapacidad' AND c.name = 'id'
      `);
      expect(identity[0]?.is_identity).toBe(true);
    });

    it('confirma FK hacia Colaborador.id con CASCADE / NO ACTION', async () => {
      const db = requireSqlServer();
      const foreignKeys = await db.query<ForeignKeyRow[]>(`
        SELECT
          fk.name AS FK_NAME,
          col1.name AS COLUMN_NAME,
          t2.name AS REF_TABLE,
          col2.name AS REF_COLUMN,
          fk.delete_referential_action_desc AS DELETE_ACTION,
          fk.update_referential_action_desc AS UPDATE_ACTION
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
        WHERE t1.name = 'Incapacidad'
          AND col1.name = 'colaboradorId'
      `);
      expect(foreignKeys.length).toBe(1);
      expect(foreignKeys[0]?.FK_NAME).toBe('FK_Incapacidad_Colaborador');
      expect(foreignKeys[0]?.REF_TABLE).toBe('Colaborador');
      expect(foreignKeys[0]?.REF_COLUMN).toBe('id');
      expect(foreignKeys[0]?.DELETE_ACTION).toBe('CASCADE');
      expect(foreignKeys[0]?.UPDATE_ACTION).toBe('NO_ACTION');
    });

    it('define índices por colaborador y por fechas', async () => {
      const db = requireSqlServer();
      const indexes = await db.query<IndexRow[]>(`
        SELECT i.name AS INDEX_NAME
        FROM sys.indexes i
        INNER JOIN sys.tables t ON t.object_id = i.object_id
        WHERE t.name = 'Incapacidad'
          AND i.name IN (
            'IX_Incapacidad_colaboradorId',
            'IX_Incapacidad_fechas'
          )
      `);
      expect(indexes.map((index) => index.INDEX_NAME).sort()).toEqual([
        'IX_Incapacidad_colaboradorId',
        'IX_Incapacidad_fechas',
      ]);
    });

    it('persiste una incapacidad válida y rechaza FK inválida', async () => {
      const db = requireSqlServer();
      const queryRunner = db.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const marca = `QA642-${Date.now()}`;
        const cedula = `9-${String(Date.now()).slice(-8, -4)}-${String(Date.now()).slice(-4)}`;
        const creado = (await queryRunner.query(
          `
          INSERT INTO Colaborador
            (nombre, apellidos, cedula, correoElectronico, cargo, activo)
          OUTPUT INSERTED.id
          VALUES (@0, @1, @2, @3, @4, 1)
        `,
          [
            'Prueba',
            marca,
            cedula,
            `incapacidad.${Date.now()}@asadasanjuan.cr`,
            'Fontanero',
          ],
        )) as InsertIdRow[];
        const colaboradorId = Number(creado[0]?.id);
        expect(colaboradorId).toBeGreaterThan(0);

        const insertada = (await queryRunner.query(
          `
          INSERT INTO Incapacidad
            (colaboradorId, fechaInicio, fechaFin, observaciones)
          OUTPUT INSERTED.id, INSERTED.colaboradorId, INSERTED.fechaInicio,
                 INSERTED.fechaFin, INSERTED.observaciones,
                 INSERTED.createdAt, INSERTED.updatedAt
          VALUES (@0, @1, @2, @3)
        `,
          [
            colaboradorId,
            '2026-10-12',
            '2026-10-20',
            'Documento entregado a administración',
          ],
        )) as IncapacidadPersistidaRow[];

        expect(Number(insertada[0]?.id)).toBeGreaterThan(0);
        expect(Number(insertada[0]?.colaboradorId)).toBe(colaboradorId);
        expect(aFechaIso(insertada[0].fechaInicio)).toBe('2026-10-12');
        expect(aFechaIso(insertada[0].fechaFin)).toBe('2026-10-20');
        expect(insertada[0]?.observaciones).toBe(
          'Documento entregado a administración',
        );
        expect(insertada[0]?.createdAt).toBeTruthy();
        expect(insertada[0]?.updatedAt).toBeTruthy();

        const sinObservaciones = (await queryRunner.query(
          `
          INSERT INTO Incapacidad
            (colaboradorId, fechaInicio, fechaFin, observaciones)
          OUTPUT INSERTED.id, INSERTED.observaciones
          VALUES (@0, @1, @2, NULL)
        `,
          [colaboradorId, '2026-11-01', '2026-11-03'],
        )) as Array<{ id: number; observaciones: string | null }>;
        expect(Number(sinObservaciones[0]?.id)).toBeGreaterThan(0);
        expect(sinObservaciones[0]?.observaciones).toBeNull();

        await expect(
          queryRunner.query(
            `
            INSERT INTO Incapacidad
              (colaboradorId, fechaInicio, fechaFin, observaciones)
            VALUES (9999999, '2026-10-12', '2026-10-20', NULL)
          `,
          ),
        ).rejects.toBeDefined();
      } finally {
        if (queryRunner.isTransactionActive) {
          await queryRunner.rollbackTransaction();
        }
        await queryRunner.release();
      }
    });
  });
});
