import { config as loadEnv } from 'dotenv';
import { DataSource, QueryRunner, Table } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateProveedorTable1724684800000 } from './migrations/1724684800000-CreateProveedorTable';

loadEnv();

type TableRow = { TABLE_NAME: string };
type ColumnRow = {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
};
type ForeignKeyRow = {
  FK_NAME: string;
  TABLE_NAME: string;
  COLUMN_NAME: string;
  REF_TABLE: string;
  REF_COLUMN: string;
};
type InsertIdRow = { id: number };
type ProveedorSelectRow = {
  id: number;
  nombre: string;
  razonSocial: string | null;
  identificacion: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  personaContacto: string | null;
  activo: boolean;
};

describe('Pruebas de Base de Datos e Integridad: Migración Proveedor', () => {
  describe('1. Definición y Estructura de la Migración TypeORM', () => {
    it('debe contar con la migración CreateProveedorTable1724684800000 bien nombrada', () => {
      const migration = new CreateProveedorTable1724684800000();
      expect(migration.name).toBe('CreateProveedorTable1724684800000');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('debe definir la creación de la tabla Proveedor y la columna foránea en up', async () => {
      const migration = new CreateProveedorTable1724684800000();
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
      expect(createdTable?.name).toBe('Proveedor');

      const colNames = createdTable?.columns.map((c) => c.name);
      expect(colNames).toEqual([
        'id',
        'nombre',
        'razonSocial',
        'identificacion',
        'telefono',
        'correo',
        'direccion',
        'personaContacto',
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
      expect(nombreCol?.length).toBe('150');

      const razonCol = createdTable?.columns.find(
        (c) => c.name === 'razonSocial',
      );
      expect(razonCol?.isNullable).toBe(true);
      expect(razonCol?.length).toBe('200');

      const idenCol = createdTable?.columns.find(
        (c) => c.name === 'identificacion',
      );
      expect(idenCol?.isNullable).toBe(true);
      expect(idenCol?.length).toBe('50');

      const telCol = createdTable?.columns.find((c) => c.name === 'telefono');
      expect(telCol?.isNullable).toBe(true);
      expect(telCol?.length).toBe('50');

      const correoCol = createdTable?.columns.find((c) => c.name === 'correo');
      expect(correoCol?.isNullable).toBe(true);
      expect(correoCol?.length).toBe('150');

      const dirCol = createdTable?.columns.find((c) => c.name === 'direccion');
      expect(dirCol?.isNullable).toBe(true);
      expect(dirCol?.length).toBe('500');

      const contactoCol = createdTable?.columns.find(
        (c) => c.name === 'personaContacto',
      );
      expect(contactoCol?.isNullable).toBe(true);
      expect(contactoCol?.length).toBe('150');

      const activoCol = createdTable?.columns.find((c) => c.name === 'activo');
      expect(activoCol?.isNullable).toBe(false);

      expect(addColumnSpy).toHaveBeenCalledWith(
        'Material',
        expect.objectContaining({ name: 'idProveedor', isNullable: true }),
      );
      expect(createForeignKeySpy).toHaveBeenCalledWith(
        'Material',
        expect.objectContaining({
          name: 'FK_Material_Proveedor',
          referencedTableName: 'Proveedor',
        }),
      );
    });

    it('debe definir la eliminación de FK, columna y tabla en down', async () => {
      const migration = new CreateProveedorTable1724684800000();

      const dropForeignKeySpy = jest.fn().mockResolvedValue(undefined);
      const dropColumnSpy = jest.fn().mockResolvedValue(undefined);
      const dropTableSpy = jest.fn().mockResolvedValue(undefined);

      const mockTable = {
        foreignKeys: [
          {
            name: 'FK_Material_Proveedor',
          },
        ],
      };

      const mockQueryRunner = {
        getTable: jest.fn().mockResolvedValue(mockTable),
        dropForeignKey: dropForeignKeySpy,
        dropColumn: dropColumnSpy,
        dropTable: dropTableSpy,
      } as unknown as QueryRunner;

      await migration.down(mockQueryRunner);

      expect(dropForeignKeySpy).toHaveBeenCalledWith(
        'Material',
        mockTable.foreignKeys[0],
      );
      expect(dropColumnSpy).toHaveBeenCalledWith('Material', 'idProveedor');
      expect(dropTableSpy).toHaveBeenCalledWith('Proveedor', true);
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
      } catch (error) {
        isConnected = false;
        console.warn(
          '[AVISO QA] SQL Server no está disponible en este entorno local:',
          error instanceof Error ? error.message : error,
        );
      }
    }, 15000);

    afterAll(async () => {
      if (dataSource?.isInitialized) {
        await dataSource.destroy();
      }
    });

    it('debe confirmar la existencia de la tabla Proveedor en SQL Server', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const tables = await dataSource.query<TableRow[]>(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'Proveedor'
      `);

      expect(tables.length).toBeGreaterThanOrEqual(1);
      expect(tables[0]?.TABLE_NAME).toBe('Proveedor');
    });

    it('debe coincidir la definición de columnas con la entidad Proveedor en SQL Server', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const columns = await dataSource.query<ColumnRow[]>(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Proveedor'
        ORDER BY ORDINAL_POSITION
      `);

      const colMap = new Map(columns.map((c) => [c.COLUMN_NAME, c]));

      expect(colMap.has('id')).toBe(true);
      expect(colMap.get('id')?.DATA_TYPE).toBe('int');
      expect(colMap.get('id')?.IS_NULLABLE).toBe('NO');

      expect(colMap.has('nombre')).toBe(true);
      expect(colMap.get('nombre')?.DATA_TYPE).toBe('varchar');
      expect(colMap.get('nombre')?.IS_NULLABLE).toBe('NO');

      expect(colMap.has('razonSocial')).toBe(true);
      expect(colMap.get('razonSocial')?.DATA_TYPE).toBe('varchar');
      expect(colMap.get('razonSocial')?.IS_NULLABLE).toBe('YES');

      expect(colMap.has('identificacion')).toBe(true);
      expect(colMap.get('identificacion')?.DATA_TYPE).toBe('varchar');
      expect(colMap.get('identificacion')?.IS_NULLABLE).toBe('YES');

      expect(colMap.has('telefono')).toBe(true);
      expect(colMap.get('telefono')?.DATA_TYPE).toBe('varchar');
      expect(colMap.get('telefono')?.IS_NULLABLE).toBe('YES');

      expect(colMap.has('correo')).toBe(true);
      expect(colMap.get('correo')?.DATA_TYPE).toBe('varchar');
      expect(colMap.get('correo')?.IS_NULLABLE).toBe('YES');

      expect(colMap.has('direccion')).toBe(true);
      expect(colMap.get('direccion')?.DATA_TYPE).toBe('varchar');
      expect(colMap.get('direccion')?.IS_NULLABLE).toBe('YES');

      expect(colMap.has('personaContacto')).toBe(true);
      expect(colMap.get('personaContacto')?.DATA_TYPE).toBe('varchar');
      expect(colMap.get('personaContacto')?.IS_NULLABLE).toBe('YES');

      expect(colMap.has('activo')).toBe(true);
      expect(colMap.get('activo')?.DATA_TYPE).toBe('bit');
      expect(colMap.get('activo')?.IS_NULLABLE).toBe('NO');

      expect(colMap.has('createdAt')).toBe(true);
      expect(colMap.get('createdAt')?.IS_NULLABLE).toBe('NO');

      expect(colMap.has('updatedAt')).toBe(true);
      expect(colMap.get('updatedAt')?.IS_NULLABLE).toBe('NO');
    });

    it('debe confirmar la existencia de la columna idProveedor en la tabla Material en SQL Server', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const columns = await dataSource.query<ColumnRow[]>(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Material' AND COLUMN_NAME = 'idProveedor'
      `);

      expect(columns.length).toBe(1);
      expect(columns[0]?.COLUMN_NAME).toBe('idProveedor');
      expect(columns[0]?.DATA_TYPE).toBe('int');
      expect(columns[0]?.IS_NULLABLE).toBe('YES');
    });

    it('debe confirmar la existencia de la llave foránea FK_Material_Proveedor en SQL Server', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const foreignKeys = await dataSource.query<ForeignKeyRow[]>(`
        SELECT 
          fk.name AS FK_NAME,
          t1.name AS TABLE_NAME,
          col1.name AS COLUMN_NAME,
          t2.name AS REF_TABLE,
          col2.name AS REF_COLUMN
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
        INNER JOIN sys.tables t1 ON t1.object_id = fk.parent_object_id
        INNER JOIN sys.columns col1 ON col1.column_id = fkc.parent_column_id AND col1.object_id = fk.parent_object_id
        INNER JOIN sys.tables t2 ON t2.object_id = fk.referenced_object_id
        INNER JOIN sys.columns col2 ON col2.column_id = fkc.referenced_column_id AND col2.object_id = fk.referenced_object_id
        WHERE t1.name = 'Material' AND col1.name = 'idProveedor' AND t2.name = 'Proveedor'
      `);

      expect(foreignKeys.length).toBe(1);
      expect(foreignKeys[0]?.TABLE_NAME).toBe('Material');
      expect(foreignKeys[0]?.COLUMN_NAME).toBe('idProveedor');
      expect(foreignKeys[0]?.REF_TABLE).toBe('Proveedor');
      expect(foreignKeys[0]?.REF_COLUMN).toBe('id');
    });

    it('debe permitir insertar, consultar y limpiar un proveedor de prueba en SQL Server (Rollback Garantizado)', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      try {
        const insertResult = (await queryRunner.query(`
          INSERT INTO Proveedor (nombre, razonSocial, identificacion, telefono, correo, activo)
          OUTPUT INSERTED.id
          VALUES ('TEST_TEMP_Proveedor_${uniqueSuffix}', 'QA S.A.', '3-101-778899', '2680-1234', 'test@qa.cr', 1)
        `)) as InsertIdRow[];

        const insertedId = insertResult[0]?.id;
        expect(insertedId).toBeDefined();

        const selectResult = (await queryRunner.query(
          `SELECT id, nombre, razonSocial, identificacion, telefono, correo, activo FROM Proveedor WHERE id = @0`,
          [insertedId],
        )) as ProveedorSelectRow[];

        expect(selectResult.length).toBe(1);
        expect(selectResult[0]?.nombre).toBe(`TEST_TEMP_Proveedor_${uniqueSuffix}`);
        expect(selectResult[0]?.identificacion).toBe('3-101-778899');
        expect(selectResult[0]?.activo).toBe(true);
      } finally {
        if (queryRunner.isTransactionActive) {
          await queryRunner.rollbackTransaction();
        }
        await queryRunner.release();
      }
    });
  });
});
