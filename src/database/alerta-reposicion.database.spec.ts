import { config as loadEnv } from 'dotenv';
import { DataSource, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateAlertaReposicionTable1724685400000 } from './migrations/1724685400000-CreateAlertaReposicionTable';

loadEnv();

type TableRow = { TABLE_NAME: string };
type ColumnRow = {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
};

describe('Pruebas de Base de Datos: Migración AlertaReposicion', () => {
  describe('1. Definición de la migración TypeORM', () => {
    it('debe contar con CreateAlertaReposicionTable1724685400000', () => {
      const migration = new CreateAlertaReposicionTable1724685400000();
      expect(migration.name).toBe('CreateAlertaReposicionTable1724685400000');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('crea la tabla AlertaReposicion con FK a Material y Usuario, sin duplicar el catálogo', async () => {
      const migration = new CreateAlertaReposicionTable1724685400000();
      let createdTable: Table | undefined;
      const foreignKeys: TableForeignKey[] = [];
      const indices: TableIndex[] = [];

      const mockQueryRunner = {
        connection: { options: { type: 'mssql' } },
        hasTable: jest.fn().mockResolvedValue(true),
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
        createIndices: jest
          .fn()
          .mockImplementation((_table: string, items: TableIndex[]) => {
            indices.push(...items);
            return Promise.resolve();
          }),
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);

      expect(createdTable?.name).toBe('AlertaReposicion');
      expect(createdTable?.columns.map((column) => column.name)).toEqual([
        'id',
        'idMaterial',
        'stockActual',
        'stockMinimo',
        'estado',
        'fechaGeneracion',
        'idUsuarioGestiona',
        'createdAt',
        'updatedAt',
      ]);
      expect(createdTable?.columns.find((column) => column.name === 'nombre')).toBeUndefined();
      expect(createdTable?.columns.find((column) => column.name === 'unidadMedida')).toBeUndefined();

      const idCol = createdTable?.columns.find((column) => column.name === 'id');
      expect(idCol?.isPrimary).toBe(true);
      expect(idCol?.isGenerated).toBe(true);

      const usuarioGestiona = createdTable?.columns.find(
        (column) => column.name === 'idUsuarioGestiona',
      );
      expect(usuarioGestiona?.isNullable).toBe(true);

      expect(createdTable?.checks.map((check) => check.name)).toEqual(
        expect.arrayContaining([
          'CK_AlertaReposicion_stockActual',
          'CK_AlertaReposicion_stockMinimo',
        ]),
      );

      expect(foreignKeys.map((fk) => fk.name)).toEqual(
        expect.arrayContaining([
          'FK_AlertaReposicion_Material',
          'FK_AlertaReposicion_Usuario_Gestiona',
        ]),
      );
      expect(indices.map((index) => index.name)).toEqual(
        expect.arrayContaining([
          'IX_AlertaReposicion_idMaterial',
          'IX_AlertaReposicion_estado',
          'IX_AlertaReposicion_fechaGeneracion',
        ]),
      );
    });

    it('elimina la tabla AlertaReposicion en down', async () => {
      const migration = new CreateAlertaReposicionTable1724685400000();
      const dropTableSpy = jest.fn().mockResolvedValue(undefined);
      const mockQueryRunner = {
        hasTable: jest.fn().mockResolvedValue(true),
        dropTable: dropTableSpy,
      } as unknown as QueryRunner;

      await migration.down(mockQueryRunner);

      expect(dropTableSpy).toHaveBeenCalledWith('AlertaReposicion', true);
    });
  });

  describe('2. Verificación física en SQL Server', () => {
    jest.setTimeout(30_000);
    let dataSource: DataSource | null = null;
    let isConnected = false;

    beforeAll(async () => {
      try {
        const options = buildMigrationDataSourceOptions();
        if (options.type === 'mssql') {
          dataSource = new DataSource(options);
          await Promise.race([
            dataSource.initialize(),
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error('SQL Server no disponible')), 4000);
            }),
          ]);
          isConnected = Boolean(dataSource.isInitialized);
        }
      } catch {
        isConnected = false;
      }
    }, 10_000);

    afterAll(async () => {
      if (dataSource?.isInitialized) {
        await dataSource.destroy();
      }
    }, 10_000);

    it('confirma la tabla AlertaReposicion cuando la migración ya se aplicó', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const tables = await dataSource.query<TableRow[]>(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = 'AlertaReposicion'
      `);

      if (tables.length === 0) {
        return;
      }

      expect(tables[0]?.TABLE_NAME).toBe('AlertaReposicion');

      const columns = await dataSource.query<ColumnRow[]>(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'AlertaReposicion'
      `);
      const colMap = new Map(columns.map((column) => [column.COLUMN_NAME, column]));

      expect(colMap.has('idMaterial')).toBe(true);
      expect(colMap.has('stockActual')).toBe(true);
      expect(colMap.has('stockMinimo')).toBe(true);
      expect(colMap.has('estado')).toBe(true);
      expect(colMap.has('fechaGeneracion')).toBe(true);
      expect(colMap.get('idUsuarioGestiona')?.IS_NULLABLE).toBe('YES');
      expect(colMap.has('nombre')).toBe(false);
    });
  });
});
