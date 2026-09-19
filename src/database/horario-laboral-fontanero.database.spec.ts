import { config as loadEnv } from 'dotenv';
import { DataSource, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateHorarioLaboralFontaneroTable1724685800000 } from './migrations/1724685800000-CreateHorarioLaboralFontaneroTable';

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

describe('Migración HorarioLaboralFontanero', () => {
  describe('1. Definición de la migración TypeORM', () => {
    it('define CreateHorarioLaboralFontaneroTable1724685800000', () => {
      const migration = new CreateHorarioLaboralFontaneroTable1724685800000();
      expect(migration.name).toBe(
        'CreateHorarioLaboralFontaneroTable1724685800000',
      );
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('crea HorarioLaboralFontanero con día, horas, activo, FK y unique', async () => {
      const migration = new CreateHorarioLaboralFontaneroTable1724685800000();
      let createdTable: Table | undefined;
      const foreignKeys: TableForeignKey[] = [];
      const indexes: TableIndex[] = [];

      const mockQueryRunner = {
        connection: {
          options: {
            type: 'mssql',
          },
        },
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

      expect(createdTable?.name).toBe('HorarioLaboralFontanero');
      const colMap = new Map(
        (createdTable?.columns ?? []).map((column) => [column.name, column]),
      );
      expect(colMap.get('id')?.isPrimary).toBe(true);
      expect(colMap.get('idFontanero')?.isNullable).toBe(false);
      expect(colMap.get('diaSemana')?.type).toBe('tinyint');
      expect(colMap.get('horaInicio')?.type).toBe('time');
      expect(colMap.get('horaFin')?.type).toBe('time');
      expect(colMap.get('activo')?.type).toBe('bit');
      expect(colMap.get('activo')?.default).toBe(1);

      const checkNames = createdTable?.checks.map((check) => check.name);
      expect(checkNames).toContain('CK_HorarioLaboralFontanero_DiaSemana');
      expect(checkNames).toContain('CK_HorarioLaboralFontanero_Horas');

      expect(foreignKeys).toHaveLength(1);
      expect(foreignKeys[0]).toMatchObject({
        name: 'FK_HorarioLaboralFontanero_Usuario',
        referencedTableName: 'Usuario',
        referencedColumnNames: ['idUsuario'],
        onDelete: 'NO ACTION',
      });
      expect(indexes.map((index) => index.name)).toEqual([
        'UQ_HorarioLaboralFontanero_Fontanero_Dia',
        'IX_HorarioLaboralFontanero_Fontanero_Dia_Activo',
      ]);
      expect(indexes[0]?.isUnique).toBe(true);
    });

    it('no recrea la tabla si ya existe', async () => {
      const migration = new CreateHorarioLaboralFontaneroTable1724685800000();
      const createTable = jest.fn();
      const mockQueryRunner = {
        connection: { options: { type: 'mssql' } },
        hasTable: jest.fn().mockResolvedValue(true),
        createTable,
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);
      expect(createTable).not.toHaveBeenCalled();
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

    it('confirma la existencia de HorarioLaboralFontanero', async () => {
      const db = requireSqlServer();
      const tables = await db.query<TableRow[]>(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = 'HorarioLaboralFontanero'
      `);
      expect(tables.length).toBeGreaterThanOrEqual(1);
    });

    it('coincide columnas, tipos y nullability', async () => {
      const db = requireSqlServer();
      const columns = await db.query<ColumnRow[]>(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'HorarioLaboralFontanero'
        ORDER BY ORDINAL_POSITION
      `);
      const colMap = new Map(columns.map((column) => [column.COLUMN_NAME, column]));
      expect(colMap.get('id')?.DATA_TYPE).toBe('int');
      expect(colMap.get('idFontanero')?.IS_NULLABLE).toBe('NO');
      expect(colMap.get('diaSemana')?.DATA_TYPE).toBe('tinyint');
      expect(colMap.get('horaInicio')?.DATA_TYPE).toBe('time');
      expect(colMap.get('horaFin')?.DATA_TYPE).toBe('time');
      expect(colMap.get('activo')?.DATA_TYPE).toBe('bit');
      expect(colMap.get('activo')?.IS_NULLABLE).toBe('NO');
    });

    it('confirma FK hacia Usuario.idUsuario', async () => {
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
        WHERE t1.name = 'HorarioLaboralFontanero'
          AND col1.name = 'idFontanero'
      `);
      expect(foreignKeys.length).toBe(1);
      expect(foreignKeys[0]?.REF_TABLE).toBe('Usuario');
      expect(foreignKeys[0]?.REF_COLUMN).toBe('idUsuario');
      expect(foreignKeys[0]?.DELETE_ACTION).toBe('NO_ACTION');
    });

    it('garantiza UNIQUE de Fontanero y día', async () => {
      const db = requireSqlServer();
      const indexes = await db.query<IndexRow[]>(`
        SELECT i.name AS INDEX_NAME, CAST(i.is_unique AS bit) AS IS_UNIQUE
        FROM sys.indexes i
        INNER JOIN sys.tables t ON t.object_id = i.object_id
        WHERE t.name = 'HorarioLaboralFontanero'
          AND i.name = 'UQ_HorarioLaboralFontanero_Fontanero_Dia'
      `);
      expect(indexes.length).toBe(1);
      expect(Boolean(indexes[0]?.IS_UNIQUE)).toBe(true);
    });

    it('define CHECK de día y de horas coherentes', async () => {
      const db = requireSqlServer();
      const checks = await db.query<CheckRow[]>(`
        SELECT cc.name AS CHECK_NAME, cc.definition AS DEFINITION
        FROM sys.check_constraints cc
        INNER JOIN sys.tables t ON t.object_id = cc.parent_object_id
        WHERE t.name = 'HorarioLaboralFontanero'
      `);
      const names = checks.map((check) => check.CHECK_NAME);
      expect(names).toContain('CK_HorarioLaboralFontanero_DiaSemana');
      expect(names).toContain('CK_HorarioLaboralFontanero_Horas');
    });

    it('inserta un horario válido, consulta por Fontanero/día y rechaza uno inválido', async () => {
      const db = requireSqlServer();
      const queryRunner = db.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const fontaneros = (await queryRunner.query(`
          SELECT TOP 1 u.idUsuario
          FROM Usuario u
          INNER JOIN Rol r ON r.idRol = u.idRol
          WHERE r.nombre = 'FONTANERO'
          ORDER BY u.idUsuario
        `)) as { idUsuario: number }[];
        const idFontanero = fontaneros[0]?.idUsuario;
        if (!idFontanero) {
          pending('No hay un Fontanero persistido para la prueba de integridad');
          return;
        }

        const insertResult = (await queryRunner.query(
          `
          INSERT INTO HorarioLaboralFontanero (idFontanero, diaSemana, horaInicio, horaFin, activo)
          OUTPUT INSERTED.id
          VALUES (@0, 1, '07:00:00', '16:00:00', 1)
        `,
          [idFontanero],
        )) as InsertIdRow[];
        expect(insertResult[0]?.id).toBeDefined();

        const consulta = (await queryRunner.query(
          `
          SELECT id, diaSemana
          FROM HorarioLaboralFontanero
          WHERE idFontanero = @0 AND diaSemana = 1 AND activo = 1
        `,
          [idFontanero],
        )) as { id: number; diaSemana: number }[];
        expect(consulta).toHaveLength(1);

        await expect(
          queryRunner.query(
            `
            INSERT INTO HorarioLaboralFontanero (idFontanero, diaSemana, horaInicio, horaFin, activo)
            VALUES (@0, 2, '16:00:00', '07:00:00', 1)
          `,
            [idFontanero],
          ),
        ).rejects.toBeDefined();

        await expect(
          queryRunner.query(`
            INSERT INTO HorarioLaboralFontanero (idFontanero, diaSemana, horaInicio, horaFin, activo)
            VALUES (9999999, 1, '07:00:00', '16:00:00', 1)
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
