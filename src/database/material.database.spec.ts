import { config as loadEnv } from 'dotenv';
import { DataSource, QueryRunner, Table } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateMaterialTable1724684600000 } from './migrations/1724684600000-CreateMaterialTable';

loadEnv();

type TableRow = { TABLE_NAME: string };
type ColumnRow = {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
};
type InsertIdRow = { id: number };
type MaterialSelectRow = {
  id: number;
  nombre: string;
  unidadMedida: string;
  stockMinimo: number;
  stockActual: number;
  activo: boolean;
};

describe('Pruebas de Base de Datos e Integridad: Migración Material', () => {
  describe('1. Definición y Estructura de la Migración TypeORM', () => {
    it('debe contar con la migración CreateMaterialTable1724684600000 bien nombrada', () => {
      const migration = new CreateMaterialTable1724684600000();
      expect(migration.name).toBe('CreateMaterialTable1724684600000');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('debe definir la creación de la tabla Material con las columnas y restricciones adecuadas en up', async () => {
      const migration = new CreateMaterialTable1724684600000();
      let createdTable: Table | undefined;

      const createTableSpy = jest
        .fn()
        .mockImplementation((table: Table): Promise<void> => {
          createdTable = table;
          return Promise.resolve();
        });

      const mockQueryRunner = {
        connection: {
          options: {
            type: 'mssql',
          },
        },
        createTable: createTableSpy,
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);

      expect(createTableSpy).toHaveBeenCalled();
      expect(createdTable).toBeDefined();
      expect(createdTable?.name).toBe('Material');

      const colNames = createdTable?.columns.map((c) => c.name);
      expect(colNames).toEqual([
        'id',
        'nombre',
        'descripcion',
        'unidadMedida',
        'ubicacion',
        'stockMinimo',
        'stockActual',
        'activo',
        'createdAt',
        'updatedAt',
      ]);

      // Verificar llave primaria
      const idCol = createdTable?.columns.find((c) => c.name === 'id');
      expect(idCol?.isPrimary).toBe(true);
      expect(idCol?.isGenerated).toBe(true);
      expect(idCol?.generationStrategy).toBe('increment');

      // Verificar campos obligatorios
      const nombreCol = createdTable?.columns.find((c) => c.name === 'nombre');
      expect(nombreCol?.isNullable).toBe(false);
      expect(nombreCol?.length).toBe('150');

      const unidadCol = createdTable?.columns.find(
        (c) => c.name === 'unidadMedida',
      );
      expect(unidadCol?.isNullable).toBe(false);
      expect(unidadCol?.length).toBe('50');

      // Verificar campos opcionales
      const descCol = createdTable?.columns.find(
        (c) => c.name === 'descripcion',
      );
      expect(descCol?.isNullable).toBe(true);

      const ubicCol = createdTable?.columns.find((c) => c.name === 'ubicacion');
      expect(ubicCol?.isNullable).toBe(true);

      // Verificar stocks y defaults
      const stockMinCol = createdTable?.columns.find(
        (c) => c.name === 'stockMinimo',
      );
      expect(stockMinCol?.default).toBe(0);
      expect(stockMinCol?.isNullable).toBe(false);

      const stockActCol = createdTable?.columns.find(
        (c) => c.name === 'stockActual',
      );
      expect(stockActCol?.default).toBe(0);
      expect(stockActCol?.isNullable).toBe(false);

      // Verificar estado activo
      const activoCol = createdTable?.columns.find((c) => c.name === 'activo');
      expect(activoCol?.type).toBe('bit');
      expect(activoCol?.default).toBe(1);
      expect(activoCol?.isNullable).toBe(false);

      // Verificar fechas
      const createdCol = createdTable?.columns.find(
        (c) => c.name === 'createdAt',
      );
      expect(createdCol?.type).toBe('datetime2');
      expect(createdCol?.default).toBe('GETDATE()');

      const updatedCol = createdTable?.columns.find(
        (c) => c.name === 'updatedAt',
      );
      expect(updatedCol?.type).toBe('datetime2');
      expect(updatedCol?.default).toBe('GETDATE()');

      // Verificar restricciones CHECK
      const checkNames = createdTable?.checks.map((ck) => ck.name);
      expect(checkNames).toContain('CK_Material_stockMinimo');
      expect(checkNames).toContain('CK_Material_stockActual');
    });

    it('debe definir la eliminación de la tabla Material en down', async () => {
      const migration = new CreateMaterialTable1724684600000();
      const dropTableSpy = jest.fn().mockResolvedValue(undefined);
      const mockQueryRunner = {
        dropTable: dropTableSpy,
      } as unknown as QueryRunner;

      await migration.down(mockQueryRunner);

      expect(dropTableSpy).toHaveBeenCalledWith('Material', true);
    });
  });

  describe('2. Verificación de Estructura Física en Base de Datos SQL Server', () => {
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
      } catch {
        isConnected = false;
      }
    });

    afterAll(async () => {
      if (dataSource?.isInitialized) {
        await dataSource.destroy();
      }
    });

    it('debe confirmar la existencia de la tabla Material en SQL Server', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const tables = await dataSource.query<TableRow[]>(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = 'Material'
      `);

      expect(tables.length).toBeGreaterThanOrEqual(1);
      expect(tables[0]?.TABLE_NAME).toBe('Material');
    });

    it('debe coincidir la definición de columnas con la entidad Material en SQL Server', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const columns = await dataSource.query<ColumnRow[]>(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Material'
        ORDER BY ORDINAL_POSITION
      `);

      const colMap = new Map(columns.map((c) => [c.COLUMN_NAME, c]));

      expect(colMap.has('id')).toBe(true);
      expect(colMap.get('id')?.DATA_TYPE).toBe('int');
      expect(colMap.get('id')?.IS_NULLABLE).toBe('NO');

      expect(colMap.has('nombre')).toBe(true);
      expect(colMap.get('nombre')?.DATA_TYPE).toBe('varchar');
      expect(colMap.get('nombre')?.IS_NULLABLE).toBe('NO');

      expect(colMap.has('descripcion')).toBe(true);
      expect(colMap.get('descripcion')?.IS_NULLABLE).toBe('YES');

      expect(colMap.has('unidadMedida')).toBe(true);
      expect(colMap.get('unidadMedida')?.DATA_TYPE).toBe('varchar');
      expect(colMap.get('unidadMedida')?.IS_NULLABLE).toBe('NO');

      expect(colMap.has('ubicacion')).toBe(true);
      expect(colMap.get('ubicacion')?.IS_NULLABLE).toBe('YES');

      expect(colMap.has('stockMinimo')).toBe(true);
      expect(colMap.get('stockMinimo')?.DATA_TYPE).toBe('int');
      expect(colMap.get('stockMinimo')?.IS_NULLABLE).toBe('NO');

      expect(colMap.has('stockActual')).toBe(true);
      expect(colMap.get('stockActual')?.DATA_TYPE).toBe('int');
      expect(colMap.get('stockActual')?.IS_NULLABLE).toBe('NO');

      expect(colMap.has('activo')).toBe(true);
      expect(colMap.get('activo')?.DATA_TYPE).toBe('bit');
      expect(colMap.get('activo')?.IS_NULLABLE).toBe('NO');

      expect(colMap.has('createdAt')).toBe(true);
      expect(colMap.get('createdAt')?.IS_NULLABLE).toBe('NO');

      expect(colMap.has('updatedAt')).toBe(true);
      expect(colMap.get('updatedAt')?.IS_NULLABLE).toBe('NO');
    });

    it('debe permitir insertar, consultar y eliminar un registro de prueba en SQL Server', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const insertResult = await dataSource.query<InsertIdRow[]>(`
        INSERT INTO Material (nombre, unidadMedida, stockMinimo, stockActual, activo)
        OUTPUT INSERTED.id
        VALUES ('Material Prueba Migración QA', 'Unidad', 5, 10, 1)
      `);

      const insertedId = insertResult[0]?.id;
      expect(insertedId).toBeDefined();

      const selectResult = await dataSource.query<MaterialSelectRow[]>(
        `SELECT id, nombre, unidadMedida, stockMinimo, stockActual, activo FROM Material WHERE id = @0`,
        [insertedId],
      );

      expect(selectResult.length).toBe(1);
      expect(selectResult[0]?.nombre).toBe('Material Prueba Migración QA');
      expect(selectResult[0]?.stockMinimo).toBe(5);
      expect(selectResult[0]?.stockActual).toBe(10);
      expect(selectResult[0]?.activo).toBe(true);

      // Limpieza de datos
      await dataSource.query(`DELETE FROM Material WHERE id = @0`, [
        insertedId,
      ]);
    });
  });
});
