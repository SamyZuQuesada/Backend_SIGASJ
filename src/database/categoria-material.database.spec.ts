import { config as loadEnv } from 'dotenv';
import { DataSource, QueryRunner, Table } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateCategoriaMaterialTable1724684700000 } from './migrations/1724684700000-CreateCategoriaMaterialTable';

loadEnv();

type TableRow = { TABLE_NAME: string };
type ColumnRow = {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
};
type InsertIdRow = { id: number };
type CategoriaSelectRow = {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
};

describe('Pruebas de Base de Datos e Integridad: Migración CategoriaMaterial', () => {
  describe('1. Definición y Estructura de la Migración TypeORM', () => {
    it('debe contar con la migración CreateCategoriaMaterialTable1724684700000 bien nombrada', () => {
      const migration = new CreateCategoriaMaterialTable1724684700000();
      expect(migration.name).toBe('CreateCategoriaMaterialTable1724684700000');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('debe definir la creación de la tabla CategoriaMaterial y la columna foránea en up', async () => {
      const migration = new CreateCategoriaMaterialTable1724684700000();
      let createdTable: Table | undefined;

      const createTableSpy = jest
        .fn()
        .mockImplementation((table: Table): Promise<void> => {
          createdTable = table;
          return Promise.resolve();
        });
      const addColumnSpy = jest.fn().mockResolvedValue(undefined);
      const createForeignKeySpy = jest.fn().mockResolvedValue(undefined);

      const mockQueryRunner = {
        connection: {
          options: {
            type: 'mssql',
          },
        },
        createTable: createTableSpy,
        addColumn: addColumnSpy,
        createForeignKey: createForeignKeySpy,
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);

      expect(createTableSpy).toHaveBeenCalled();
      expect(createdTable).toBeDefined();
      expect(createdTable?.name).toBe('CategoriaMaterial');

      const colNames = createdTable?.columns.map((c) => c.name);
      expect(colNames).toEqual([
        'id',
        'nombre',
        'descripcion',
        'activo',
        'createdAt',
        'updatedAt',
      ]);

      const idCol = createdTable?.columns.find((c) => c.name === 'id');
      expect(idCol?.isPrimary).toBe(true);
      expect(idCol?.isGenerated).toBe(true);
      expect(idCol?.generationStrategy).toBe('increment');

      const nombreCol = createdTable?.columns.find((c) => c.name === 'nombre');
      expect(nombreCol?.isNullable).toBe(false);
      expect(nombreCol?.isUnique).toBe(true);
      expect(nombreCol?.length).toBe('100');

      const descCol = createdTable?.columns.find(
        (c) => c.name === 'descripcion',
      );
      expect(descCol?.isNullable).toBe(true);
      expect(descCol?.length).toBe('500');

      const activoCol = createdTable?.columns.find((c) => c.name === 'activo');
      expect(activoCol?.isNullable).toBe(false);

      expect(addColumnSpy).toHaveBeenCalledWith(
        'Material',
        expect.objectContaining({ name: 'idCategoria', isNullable: true }),
      );
      expect(createForeignKeySpy).toHaveBeenCalledWith(
        'Material',
        expect.objectContaining({
          name: 'FK_Material_CategoriaMaterial',
          referencedTableName: 'CategoriaMaterial',
        }),
      );
    });

    it('debe definir la eliminación de FK, columna y tabla en down', async () => {
      const migration = new CreateCategoriaMaterialTable1724684700000();

      const dropForeignKeySpy = jest.fn().mockResolvedValue(undefined);
      const dropColumnSpy = jest.fn().mockResolvedValue(undefined);
      const dropTableSpy = jest.fn().mockResolvedValue(undefined);

      const mockTable = {
        foreignKeys: [{ name: 'FK_Material_CategoriaMaterial' }],
      };

      const mockQueryRunner = {
        getTable: jest.fn().mockResolvedValue(mockTable),
        dropForeignKey: dropForeignKeySpy,
        dropColumn: dropColumnSpy,
        dropTable: dropTableSpy,
      } as unknown as QueryRunner;

      await migration.down(mockQueryRunner);

      expect(dropForeignKeySpy).toHaveBeenCalled();
      expect(dropColumnSpy).toHaveBeenCalledWith('Material', 'idCategoria');
      expect(dropTableSpy).toHaveBeenCalledWith('CategoriaMaterial', true);
    });
  });

  describe('2. Verificación de Estructura Física en Base de Datos SQL Server', () => {
    let dataSource: DataSource | undefined;
    let isConnected = false;

    beforeAll(async () => {
      try {
        const options = buildMigrationDataSourceOptions();
        dataSource = new DataSource(options);
        await dataSource.initialize();
        isConnected = true;
      } catch (error) {
        console.warn(
          '[AVISO QA] SQL Server no está disponible en este entorno local:',
          error instanceof Error ? error.message : error,
        );
      }
    });

    afterAll(async () => {
      if (dataSource?.isInitialized) {
        await dataSource.destroy();
      }
    });

    it('debe confirmar la existencia de la tabla CategoriaMaterial en SQL Server', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const tables = await dataSource.query<TableRow[]>(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'CategoriaMaterial'
      `);

      expect(tables.length).toBeGreaterThanOrEqual(1);
      expect(tables[0]?.TABLE_NAME).toBe('CategoriaMaterial');
    });

    it('debe coincidir la definición de columnas con la entidad CategoriaMaterial en SQL Server', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const columns = await dataSource.query<ColumnRow[]>(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'CategoriaMaterial'
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

      expect(colMap.has('activo')).toBe(true);
      expect(colMap.get('activo')?.DATA_TYPE).toBe('bit');
      expect(colMap.get('activo')?.IS_NULLABLE).toBe('NO');

      expect(colMap.has('createdAt')).toBe(true);
      expect(colMap.get('createdAt')?.IS_NULLABLE).toBe('NO');

      expect(colMap.has('updatedAt')).toBe(true);
      expect(colMap.get('updatedAt')?.IS_NULLABLE).toBe('NO');
    });

    it('debe confirmar la existencia de la columna idCategoria en la tabla Material en SQL Server', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const columns = await dataSource.query<ColumnRow[]>(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Material' AND COLUMN_NAME = 'idCategoria'
      `);

      expect(columns.length).toBe(1);
      expect(columns[0]?.COLUMN_NAME).toBe('idCategoria');
      expect(columns[0]?.DATA_TYPE).toBe('int');
      expect(columns[0]?.IS_NULLABLE).toBe('YES');
    });

    it('debe permitir insertar, consultar y eliminar un registro de prueba en SQL Server', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const insertResult = await dataSource.query<InsertIdRow[]>(`
        INSERT INTO CategoriaMaterial (nombre, descripcion, activo)
        OUTPUT INSERTED.id
        VALUES ('Categoria QA Test', 'Descripcion de prueba QA', 1)
      `);

      const insertedId = insertResult[0]?.id;
      expect(insertedId).toBeDefined();

      const selectResult = await dataSource.query<CategoriaSelectRow[]>(
        `SELECT id, nombre, descripcion, activo FROM CategoriaMaterial WHERE id = @0`,
        [insertedId],
      );

      expect(selectResult.length).toBe(1);
      expect(selectResult[0]?.nombre).toBe('Categoria QA Test');
      expect(selectResult[0]?.descripcion).toBe('Descripcion de prueba QA');
      expect(selectResult[0]?.activo).toBe(true);

      // Limpieza
      await dataSource.query(`DELETE FROM CategoriaMaterial WHERE id = @0`, [
        insertedId,
      ]);
    });

    it('debe confirmar la existencia de la restricción de llave foránea de Material hacia CategoriaMaterial en SQL Server', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const fkRows = await dataSource.query<{ FK_NAME: string }[]>(`
        SELECT fk.name AS FK_NAME
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
        INNER JOIN sys.tables t1 ON t1.object_id = fk.parent_object_id
        INNER JOIN sys.columns col1 ON col1.column_id = fkc.parent_column_id AND col1.object_id = fk.parent_object_id
        INNER JOIN sys.tables t2 ON t2.object_id = fk.referenced_object_id
        WHERE t1.name = 'Material' AND col1.name = 'idCategoria' AND t2.name = 'CategoriaMaterial'
      `);

      expect(fkRows.length).toBe(1);
    });

    it('debe permitir insertar un material vinculado a una categoría, consultar con JOIN y verificar preservación tras desactivación (Rollback Garantizado)', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      try {
        // 1. Insertar Categoría
        const catInsert = (await queryRunner.query(`
          INSERT INTO CategoriaMaterial (nombre, descripcion, activo)
          OUTPUT INSERTED.id
          VALUES ('TEST_TEMP_Cat_${uniqueSuffix}', 'Para pruebas de FK', 1)
        `)) as InsertIdRow[];
        const catId = catInsert[0]?.id;
        expect(catId).toBeDefined();

        // 2. Insertar Material vinculado
        const matInsert = (await queryRunner.query(
          `
          INSERT INTO Material (nombre, unidadMedida, stockMinimo, stockActual, activo, idCategoria)
          OUTPUT INSERTED.id
          VALUES ('TEST_TEMP_Mat_${uniqueSuffix}', 'Unidad', 5, 0, 1, @0)
        `,
          [catId],
        )) as InsertIdRow[];
        const matId = matInsert[0]?.id;
        expect(matId).toBeDefined();

        // 3. Consultar con JOIN
        const joinRows = (await queryRunner.query(
          `
          SELECT m.nombre AS materialNombre, c.nombre AS categoriaNombre, c.activo AS categoriaActivo
          FROM Material m
          INNER JOIN CategoriaMaterial c ON m.idCategoria = c.id
          WHERE m.id = @0
        `,
          [matId],
        )) as {
          materialNombre: string;
          categoriaNombre: string;
          categoriaActivo: boolean;
        }[];

        expect(joinRows.length).toBe(1);
        expect(joinRows[0]?.materialNombre).toBe(
          `TEST_TEMP_Mat_${uniqueSuffix}`,
        );
        expect(joinRows[0]?.categoriaNombre).toBe(
          `TEST_TEMP_Cat_${uniqueSuffix}`,
        );
        expect(joinRows[0]?.categoriaActivo).toBe(true);

        // 4. Desactivar categoría lógicamente
        await queryRunner.query(
          `UPDATE CategoriaMaterial SET activo = 0 WHERE id = @0`,
          [catId],
        );

        // 5. Verificar que el material sigue existiendo y mantiene su relación histórica intacta
        const checkMat = (await queryRunner.query(
          `
          SELECT idCategoria FROM Material WHERE id = @0
        `,
          [matId],
        )) as { idCategoria: number }[];
        expect(checkMat.length).toBe(1);
        expect(checkMat[0]?.idCategoria).toBe(catId);
      } finally {
        if (queryRunner.isTransactionActive) {
          await queryRunner.rollbackTransaction();
        }
        await queryRunner.release();
      }
    });
  });
});
