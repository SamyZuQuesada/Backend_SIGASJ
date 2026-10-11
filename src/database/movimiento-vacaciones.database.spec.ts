import { config as loadEnv } from 'dotenv';
import {
  DataSource,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateMovimientoVacacionesTable1724685970000 } from './migrations/1724685970000-CreateMovimientoVacacionesTable';

loadEnv();

type TableRow = { TABLE_NAME: string };
type ColumnRow = {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
  COLUMN_DEFAULT: string | null;
};
type IndexRow = { INDEX_NAME: string; IS_UNIQUE: boolean };
type ForeignKeyRow = {
  FK_NAME: string;
  COLUMN_NAME: string;
  REF_TABLE: string;
  REF_COLUMN: string;
  DELETE_ACTION: string;
};
type CheckRow = { CHECK_NAME: string; DEFINITION: string };
type InsertIdRow = { id: number };
type SaldoRow = { acumulados: number; disfrutados: number };

describe('Migración MovimientoVacaciones', () => {
  describe('1. Definición de la migración TypeORM', () => {
    it('define CreateMovimientoVacacionesTable1724685970000', () => {
      const migration = new CreateMovimientoVacacionesTable1724685970000();
      expect(migration.name).toBe(
        'CreateMovimientoVacacionesTable1724685970000',
      );
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('crea MovimientoVacaciones con tipo, días, fecha, FK, índices y CHECKs', async () => {
      const migration = new CreateMovimientoVacacionesTable1724685970000();
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

      expect(createdTable?.name).toBe('MovimientoVacaciones');
      const colMap = new Map(
        (createdTable?.columns ?? []).map((column) => [column.name, column]),
      );
      expect([...colMap.keys()]).toEqual([
        'id',
        'colaboradorId',
        'tipo',
        'cantidadDias',
        'fecha',
        'observaciones',
        'createdAt',
      ]);
      expect(colMap.get('id')?.isPrimary).toBe(true);
      expect(colMap.get('id')?.isGenerated).toBe(true);
      expect(colMap.get('colaboradorId')?.isNullable).toBe(false);
      expect(colMap.get('tipo')?.type).toBe('varchar');
      expect(colMap.get('tipo')?.length).toBe('20');
      expect(colMap.get('cantidadDias')?.type).toBe('int');
      expect(colMap.get('cantidadDias')?.isNullable).toBe(false);
      expect(colMap.get('fecha')?.type).toBe('date');
      expect(colMap.get('fecha')?.isNullable).toBe(false);
      expect(colMap.get('observaciones')?.isNullable).toBe(true);
      expect(colMap.get('observaciones')?.length).toBe('500');
      expect(colMap.get('createdAt')?.type).toBe('datetime2');
      expect(colMap.get('createdAt')?.default).toBe('GETDATE()');

      const checks = new Map(
        (createdTable?.checks ?? []).map((check) => [
          check.name,
          check.expression,
        ]),
      );
      expect(checks.get('CK_MovimientoVacaciones_Tipo')).toBe(
        "tipo IN ('ACUMULADO', 'DISFRUTADO')",
      );
      expect(checks.get('CK_MovimientoVacaciones_CantidadDias')).toBe(
        'cantidadDias > 0',
      );

      expect(foreignKeys).toHaveLength(1);
      expect(foreignKeys[0]).toMatchObject({
        name: 'FK_MovimientoVacaciones_Colaborador',
        columnNames: ['colaboradorId'],
        referencedTableName: 'Colaborador',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      });

      expect(indexes.map((index) => index.name)).toEqual([
        'IX_MovimientoVacaciones_colaboradorId',
        'IX_MovimientoVacaciones_colaborador_fecha',
      ]);
      expect(indexes[1]?.columnNames).toEqual(['colaboradorId', 'fecha']);
    });

    it('usa tipos portables fuera de SQL Server', async () => {
      const migration = new CreateMovimientoVacacionesTable1724685970000();
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
      expect(createdAt?.type).toBe('datetime');
      expect(createdAt?.default).toBe('CURRENT_TIMESTAMP');
    });

    it('no recrea la tabla si ya existe', async () => {
      const migration = new CreateMovimientoVacacionesTable1724685970000();
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
      const migration = new CreateMovimientoVacacionesTable1724685970000();
      const llamadas: string[] = [];
      const mockQueryRunner = {
        getTable: jest.fn().mockResolvedValue({
          foreignKeys: [{ name: 'FK_MovimientoVacaciones_Colaborador' }],
          indices: [
            { name: 'IX_MovimientoVacaciones_colaboradorId' },
            { name: 'IX_MovimientoVacaciones_colaborador_fecha' },
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
        'IX_MovimientoVacaciones_colaborador_fecha',
        'IX_MovimientoVacaciones_colaboradorId',
        'table',
      ]);
    });

    it('down no falla si la tabla no existe', async () => {
      const migration = new CreateMovimientoVacacionesTable1724685970000();
      const dropTable = jest.fn();
      const mockQueryRunner = {
        getTable: jest.fn().mockResolvedValue(undefined),
        dropTable,
      } as unknown as QueryRunner;

      await migration.down(mockQueryRunner);
      expect(dropTable).not.toHaveBeenCalled();
    });
  });

  describe('2. Verificación de esquema físico en SQL Server', () => {
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

    it('confirma la existencia de MovimientoVacaciones', async () => {
      const db = requireSqlServer();
      const tables = await db.query<TableRow[]>(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = 'MovimientoVacaciones'
      `);
      expect(tables.length).toBeGreaterThanOrEqual(1);
    });

    it('coincide columnas, tipos y nullability', async () => {
      const db = requireSqlServer();
      const columns = await db.query<ColumnRow[]>(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'MovimientoVacaciones'
        ORDER BY ORDINAL_POSITION
      `);
      const colMap = new Map(
        columns.map((column) => [column.COLUMN_NAME, column]),
      );
      expect(colMap.get('id')?.DATA_TYPE).toBe('int');
      expect(colMap.get('colaboradorId')?.IS_NULLABLE).toBe('NO');
      expect(colMap.get('tipo')?.DATA_TYPE).toBe('varchar');
      expect(colMap.get('cantidadDias')?.DATA_TYPE).toBe('int');
      expect(colMap.get('fecha')?.DATA_TYPE).toBe('date');
      expect(colMap.get('observaciones')?.IS_NULLABLE).toBe('YES');
      expect(colMap.get('createdAt')?.DATA_TYPE).toBe('datetime2');
      expect(colMap.has('updatedAt')).toBe(false);
    });

    it('confirma FK hacia Colaborador.id con CASCADE', async () => {
      const db = requireSqlServer();
      const foreignKeys = await db.query<ForeignKeyRow[]>(`
        SELECT
          fk.name AS FK_NAME,
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
        WHERE t1.name = 'MovimientoVacaciones'
          AND col1.name = 'colaboradorId'
      `);
      expect(foreignKeys.length).toBe(1);
      expect(foreignKeys[0]?.FK_NAME).toBe(
        'FK_MovimientoVacaciones_Colaborador',
      );
      expect(foreignKeys[0]?.REF_TABLE).toBe('Colaborador');
      expect(foreignKeys[0]?.REF_COLUMN).toBe('id');
      expect(foreignKeys[0]?.DELETE_ACTION).toBe('CASCADE');
    });

    it('define índices por colaborador y por colaborador+fecha', async () => {
      const db = requireSqlServer();
      const indexes = await db.query<IndexRow[]>(`
        SELECT i.name AS INDEX_NAME, CAST(i.is_unique AS bit) AS IS_UNIQUE
        FROM sys.indexes i
        INNER JOIN sys.tables t ON t.object_id = i.object_id
        WHERE t.name = 'MovimientoVacaciones'
          AND i.name IN (
            'IX_MovimientoVacaciones_colaboradorId',
            'IX_MovimientoVacaciones_colaborador_fecha'
          )
      `);
      expect(indexes.map((index) => index.INDEX_NAME).sort()).toEqual([
        'IX_MovimientoVacaciones_colaboradorId',
        'IX_MovimientoVacaciones_colaborador_fecha',
      ]);
    });

    it('define CHECK de tipo y de cantidad de días', async () => {
      const db = requireSqlServer();
      const checks = await db.query<CheckRow[]>(`
        SELECT cc.name AS CHECK_NAME, cc.definition AS DEFINITION
        FROM sys.check_constraints cc
        INNER JOIN sys.tables t ON t.object_id = cc.parent_object_id
        WHERE t.name = 'MovimientoVacaciones'
      `);
      const names = checks.map((check) => check.CHECK_NAME);
      expect(names).toContain('CK_MovimientoVacaciones_Tipo');
      expect(names).toContain('CK_MovimientoVacaciones_CantidadDias');
    });

    it('inserta movimientos, deriva el saldo y rechaza datos inválidos', async () => {
      const db = requireSqlServer();
      const queryRunner = db.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const colaboradores = (await queryRunner.query(`
          SELECT TOP 1 id FROM Colaborador ORDER BY id
        `)) as { id: number }[];
        let colaboradorId = colaboradores[0]?.id;
        if (!colaboradorId) {
          const creado = (await queryRunner.query(`
            INSERT INTO Colaborador (nombre, apellidos, cedula, correoElectronico, cargo, activo)
            OUTPUT INSERTED.id
            VALUES ('Prueba', 'Vacaciones', '9-9999-9999', 'prueba.vacaciones@asadasanjuan.cr', 'Fontanero', 1)
          `)) as InsertIdRow[];
          colaboradorId = creado[0]?.id;
        }
        expect(colaboradorId).toBeDefined();

        const insertar = (tipo: string, dias: number, fecha: string) =>
          queryRunner.query(
            `
            INSERT INTO MovimientoVacaciones (colaboradorId, tipo, cantidadDias, fecha)
            OUTPUT INSERTED.id
            VALUES (@0, @1, @2, @3)
          `,
            [colaboradorId, tipo, dias, fecha],
          ) as Promise<InsertIdRow[]>;

        const base = (await queryRunner.query(
          `
          SELECT
            COALESCE(SUM(CASE WHEN tipo = 'ACUMULADO' THEN cantidadDias ELSE 0 END), 0) AS acumulados,
            COALESCE(SUM(CASE WHEN tipo = 'DISFRUTADO' THEN cantidadDias ELSE 0 END), 0) AS disfrutados
          FROM MovimientoVacaciones
          WHERE colaboradorId = @0
        `,
          [colaboradorId],
        )) as SaldoRow[];

        expect(
          (await insertar('ACUMULADO', 12, '2026-01-01'))[0]?.id,
        ).toBeDefined();
        expect(
          (await insertar('DISFRUTADO', 3, '2026-03-10'))[0]?.id,
        ).toBeDefined();

        const saldo = (await queryRunner.query(
          `
          SELECT
            COALESCE(SUM(CASE WHEN tipo = 'ACUMULADO' THEN cantidadDias ELSE 0 END), 0) AS acumulados,
            COALESCE(SUM(CASE WHEN tipo = 'DISFRUTADO' THEN cantidadDias ELSE 0 END), 0) AS disfrutados
          FROM MovimientoVacaciones
          WHERE colaboradorId = @0
        `,
          [colaboradorId],
        )) as SaldoRow[];
        expect(Number(saldo[0]?.acumulados) - Number(base[0]?.acumulados)).toBe(
          12,
        );
        expect(
          Number(saldo[0]?.disfrutados) - Number(base[0]?.disfrutados),
        ).toBe(3);

        await expect(
          insertar('PENDIENTE', 1, '2026-01-01'),
        ).rejects.toBeDefined();
        await expect(
          insertar('ACUMULADO', 0, '2026-01-01'),
        ).rejects.toBeDefined();
        await expect(
          queryRunner.query(`
            INSERT INTO MovimientoVacaciones (colaboradorId, tipo, cantidadDias, fecha)
            VALUES (9999999, 'ACUMULADO', 1, '2026-01-01')
          `),
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
