import { config as loadEnv } from 'dotenv';
import { DataSource, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateReposicionMaterialTables1724685500000 } from './migrations/1724685500000-CreateReposicionMaterialTables';

loadEnv();

type TableRow = { TABLE_NAME: string };
type ColumnRow = {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
};

describe('Pruebas de Base de Datos: Migración ReposicionMaterial', () => {
  describe('1. Definición de la migración TypeORM', () => {
    it('debe contar con CreateReposicionMaterialTables1724685500000', () => {
      const migration = new CreateReposicionMaterialTables1724685500000();
      expect(migration.name).toBe('CreateReposicionMaterialTables1724685500000');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('crea ReposicionMaterial y DetalleReposicionMaterial con FK e índices, sin duplicar catálogo', async () => {
      const migration = new CreateReposicionMaterialTables1724685500000();
      const createdTables: Table[] = [];
      const foreignKeys: TableForeignKey[] = [];
      const indices: TableIndex[] = [];

      const mockQueryRunner = {
        connection: { options: { type: 'mssql' } },
        hasTable: jest.fn().mockResolvedValue(true),
        createTable: jest.fn().mockImplementation((table: Table) => {
          createdTables.push(table);
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

      const reposicion = createdTables.find((table) => table.name === 'ReposicionMaterial');
      const detalle = createdTables.find((table) => table.name === 'DetalleReposicionMaterial');

      expect(reposicion?.columns.map((column) => column.name)).toEqual([
        'id',
        'codigo',
        'fechaGeneracion',
        'origen',
        'estado',
        'idAlertaReposicion',
        'idSolicitudMaterial',
        'idUsuarioResponsable',
        'idProveedor',
        'fechaCompra',
        'fechaRecepcion',
        'observacion',
        'createdAt',
        'updatedAt',
      ]);
      expect(reposicion?.columns.find((column) => column.name === 'nombre')).toBeUndefined();
      expect(reposicion?.columns.find((column) => column.name === 'idUsuarioResponsable')?.isNullable).toBe(false);
      expect(reposicion?.columns.find((column) => column.name === 'idProveedor')?.isNullable).toBe(true);
      expect(reposicion?.columns.find((column) => column.name === 'fechaCompra')?.isNullable).toBe(true);
      expect(reposicion?.columns.find((column) => column.name === 'fechaRecepcion')?.isNullable).toBe(true);

      expect(detalle?.columns.map((column) => column.name)).toEqual([
        'id',
        'idReposicion',
        'idMaterial',
        'cantidad',
        'observacion',
        'createdAt',
        'updatedAt',
      ]);
      expect(detalle?.checks.map((check) => check.name)).toEqual(
        expect.arrayContaining(['CK_DetalleReposicionMaterial_cantidad']),
      );

      expect(foreignKeys.map((fk) => fk.name)).toEqual(
        expect.arrayContaining([
          'FK_ReposicionMaterial_AlertaReposicion',
          'FK_ReposicionMaterial_SolicitudMaterial',
          'FK_ReposicionMaterial_Usuario_Responsable',
          'FK_ReposicionMaterial_Proveedor',
          'FK_DetalleReposicionMaterial_Reposicion',
          'FK_DetalleReposicionMaterial_Material',
        ]),
      );
      expect(indices.map((index) => index.name)).toEqual(
        expect.arrayContaining([
          'IX_ReposicionMaterial_codigo',
          'IX_ReposicionMaterial_fechaGeneracion',
          'IX_ReposicionMaterial_origen',
          'IX_ReposicionMaterial_estado',
          'IX_ReposicionMaterial_idUsuarioResponsable',
          'IX_DetalleReposicionMaterial_idReposicion',
          'IX_DetalleReposicionMaterial_idMaterial',
        ]),
      );
    });

    it('elimina las tablas en down respetando el orden de dependencias', async () => {
      const migration = new CreateReposicionMaterialTables1724685500000();
      const dropTableSpy = jest.fn().mockResolvedValue(undefined);
      const mockQueryRunner = {
        hasTable: jest.fn().mockResolvedValue(true),
        dropTable: dropTableSpy,
      } as unknown as QueryRunner;

      await migration.down(mockQueryRunner);

      expect(dropTableSpy).toHaveBeenNthCalledWith(1, 'DetalleReposicionMaterial', true);
      expect(dropTableSpy).toHaveBeenNthCalledWith(2, 'ReposicionMaterial', true);
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

    it('confirma las tablas ReposicionMaterial y DetalleReposicionMaterial cuando la migración ya se aplicó', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const tables = await dataSource.query<TableRow[]>(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME IN ('ReposicionMaterial', 'DetalleReposicionMaterial')
      `);

      if (tables.length === 0) {
        return;
      }

      const tableNames = tables.map((table) => table.TABLE_NAME);
      expect(tableNames).toEqual(expect.arrayContaining(['ReposicionMaterial']));

      const columns = await dataSource.query<ColumnRow[]>(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'ReposicionMaterial'
      `);
      const colMap = new Map(columns.map((column) => [column.COLUMN_NAME, column]));

      expect(colMap.has('origen')).toBe(true);
      expect(colMap.has('estado')).toBe(true);
      expect(colMap.has('idAlertaReposicion')).toBe(true);
      expect(colMap.has('idSolicitudMaterial')).toBe(true);
      expect(colMap.has('idProveedor')).toBe(true);
      expect(colMap.has('fechaCompra')).toBe(true);
      expect(colMap.has('fechaRecepcion')).toBe(true);
      expect(colMap.get('idProveedor')?.IS_NULLABLE).toBe('YES');
      expect(colMap.has('nombre')).toBe(false);
    });
  });
});
