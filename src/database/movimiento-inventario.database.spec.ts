import { config as loadEnv } from 'dotenv';
import { DataSource, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateMovimientoInventarioTable1724684900000 } from './migrations/1724684900000-CreateMovimientoInventarioTable';

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
type IndexRow = {
  INDEX_NAME: string;
  TABLE_NAME: string;
  COLUMN_NAME: string;
};
type InsertIdRow = { id: number };
type MovimientoSelectRow = {
  id: number;
  tipo: string;
  cantidad: number;
  fechaMovimiento: Date;
  observacion: string | null;
  idMaterial: number;
  idUsuario: number;
  idProveedor: number | null;
  createdAt: Date;
};

describe('Pruebas de Base de Datos e Integridad: Migración MovimientoInventario', () => {
  describe('1. Definición y Estructura de la Migración TypeORM', () => {
    it('debe contar con la migración CreateMovimientoInventarioTable1724684900000 bien nombrada', () => {
      const migration = new CreateMovimientoInventarioTable1724684900000();
      expect(migration.name).toBe('CreateMovimientoInventarioTable1724684900000');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('debe definir la creación de la tabla MovimientoInventario, FKs e índices en up', async () => {
      const migration = new CreateMovimientoInventarioTable1724684900000();
      let createdTable: Table | undefined;
      const createdForeignKeys: TableForeignKey[] = [];
      const createdIndices: TableIndex[] = [];

      const createTableSpy = jest
        .fn()
        .mockImplementation((table: Table): Promise<void> => {
          createdTable = table;
          return Promise.resolve();
        });
      const createForeignKeySpy = jest
        .fn()
        .mockImplementation((tableName: string, fk: TableForeignKey) => {
          createdForeignKeys.push(fk);
          return Promise.resolve();
        });
      const createIndexSpy = jest
        .fn()
        .mockImplementation((tableName: string, idx: TableIndex) => {
          createdIndices.push(idx);
          return Promise.resolve();
        });

      const mockQueryRunner = {
        connection: {
          options: {
            type: 'mssql',
          },
        },
        createTable: createTableSpy,
        createForeignKey: createForeignKeySpy,
        createIndex: createIndexSpy,
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);

      expect(createTableSpy).toHaveBeenCalled();
      expect(createdTable).toBeDefined();
      expect(createdTable?.name).toBe('MovimientoInventario');

      const colNames = createdTable?.columns.map((c) => c.name);
      expect(colNames).toEqual([
        'id',
        'tipo',
        'cantidad',
        'fechaMovimiento',
        'observacion',
        'idMaterial',
        'idUsuario',
        'idProveedor',
        'idAveria',
        'idSolicitud',
        'idProyecto',
        'createdAt',
      ]);

      const idCol = createdTable?.columns.find((c) => c.name === 'id');
      expect(idCol?.isPrimary).toBe(true);
      expect(idCol?.isGenerated).toBe(true);
      expect(idCol?.generationStrategy).toBe('increment');

      const tipoCol = createdTable?.columns.find((c) => c.name === 'tipo');
      expect(tipoCol?.isNullable).toBe(false);
      expect(tipoCol?.length).toBe('20');

      const cantCol = createdTable?.columns.find((c) => c.name === 'cantidad');
      expect(cantCol?.isNullable).toBe(false);
      expect(cantCol?.type).toBe('int');

      const matCol = createdTable?.columns.find((c) => c.name === 'idMaterial');
      expect(matCol?.isNullable).toBe(false);

      const usrCol = createdTable?.columns.find((c) => c.name === 'idUsuario');
      expect(usrCol?.isNullable).toBe(false);

      const provCol = createdTable?.columns.find((c) => c.name === 'idProveedor');
      expect(provCol?.isNullable).toBe(true);

      const obsCol = createdTable?.columns.find((c) => c.name === 'observacion');
      expect(obsCol?.isNullable).toBe(true);

      // Verificación de Llaves Foráneas
      expect(createForeignKeySpy).toHaveBeenCalledTimes(3);
      const fkMaterial = createdForeignKeys.find(
        (f) => f.name === 'FK_MovimientoInventario_Material',
      );
      expect(fkMaterial).toBeDefined();
      expect(fkMaterial?.columnNames).toEqual(['idMaterial']);
      expect(fkMaterial?.referencedTableName).toBe('Material');
      expect(fkMaterial?.referencedColumnNames).toEqual(['id']);

      const fkUsuario = createdForeignKeys.find(
        (f) => f.name === 'FK_MovimientoInventario_Usuario',
      );
      expect(fkUsuario).toBeDefined();
      expect(fkUsuario?.columnNames).toEqual(['idUsuario']);
      expect(fkUsuario?.referencedTableName).toBe('Usuario');
      expect(fkUsuario?.referencedColumnNames).toEqual(['idUsuario']);

      const fkProveedor = createdForeignKeys.find(
        (f) => f.name === 'FK_MovimientoInventario_Proveedor',
      );
      expect(fkProveedor).toBeDefined();
      expect(fkProveedor?.columnNames).toEqual(['idProveedor']);
      expect(fkProveedor?.referencedTableName).toBe('Proveedor');
      expect(fkProveedor?.referencedColumnNames).toEqual(['id']);
      expect(fkProveedor?.onDelete).toBe('SET NULL');

      // Verificación de Índices
      expect(createIndexSpy).toHaveBeenCalledTimes(3);
      const idxMaterial = createdIndices.find(
        (i) => i.name === 'IX_MovimientoInventario_idMaterial',
      );
      expect(idxMaterial).toBeDefined();
      expect(idxMaterial?.columnNames).toEqual(['idMaterial']);

      const idxUsuario = createdIndices.find(
        (i) => i.name === 'IX_MovimientoInventario_idUsuario',
      );
      expect(idxUsuario).toBeDefined();
      expect(idxUsuario?.columnNames).toEqual(['idUsuario']);

      const idxFecha = createdIndices.find(
        (i) => i.name === 'IX_MovimientoInventario_fechaMovimiento',
      );
      expect(idxFecha).toBeDefined();
      expect(idxFecha?.columnNames).toEqual(['fechaMovimiento']);
    });

    it('debe definir la eliminación de índices, FKs y tabla en down', async () => {
      const migration = new CreateMovimientoInventarioTable1724684900000();

      const dropForeignKeySpy = jest.fn().mockResolvedValue(undefined);
      const dropIndexSpy = jest.fn().mockResolvedValue(undefined);
      const dropTableSpy = jest.fn().mockResolvedValue(undefined);

      const mockTable = {
        indices: [
          { name: 'IX_MovimientoInventario_fechaMovimiento' },
          { name: 'IX_MovimientoInventario_idUsuario' },
          { name: 'IX_MovimientoInventario_idMaterial' },
        ],
        foreignKeys: [
          { name: 'FK_MovimientoInventario_Proveedor' },
          { name: 'FK_MovimientoInventario_Usuario' },
          { name: 'FK_MovimientoInventario_Material' },
        ],
      };

      const mockQueryRunner = {
        getTable: jest.fn().mockResolvedValue(mockTable),
        dropForeignKey: dropForeignKeySpy,
        dropIndex: dropIndexSpy,
        dropTable: dropTableSpy,
      } as unknown as QueryRunner;

      await migration.down(mockQueryRunner);

      expect(dropIndexSpy).toHaveBeenCalledTimes(3);
      expect(dropForeignKeySpy).toHaveBeenCalledTimes(3);
      expect(dropTableSpy).toHaveBeenCalledWith('MovimientoInventario', true);
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

    it('debe confirmar la existencia de la tabla MovimientoInventario en SQL Server', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const tables = await dataSource.query<TableRow[]>(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'MovimientoInventario'
      `);

      expect(tables.length).toBeGreaterThanOrEqual(1);
      expect(tables[0]?.TABLE_NAME).toBe('MovimientoInventario');
    });

    it('debe coincidir la definición de columnas con la entidad MovimientoInventario en SQL Server', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const columns = await dataSource.query<ColumnRow[]>(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'MovimientoInventario'
        ORDER BY ORDINAL_POSITION
      `);

      const colMap = new Map(columns.map((c) => [c.COLUMN_NAME, c]));

      expect(colMap.has('id')).toBe(true);
      expect(colMap.get('id')?.DATA_TYPE).toBe('int');
      expect(colMap.get('id')?.IS_NULLABLE).toBe('NO');

      expect(colMap.has('tipo')).toBe(true);
      expect(colMap.get('tipo')?.DATA_TYPE).toBe('varchar');
      expect(colMap.get('tipo')?.IS_NULLABLE).toBe('NO');

      expect(colMap.has('cantidad')).toBe(true);
      expect(colMap.get('cantidad')?.DATA_TYPE).toBe('int');
      expect(colMap.get('cantidad')?.IS_NULLABLE).toBe('NO');

      expect(colMap.has('fechaMovimiento')).toBe(true);
      expect(colMap.get('fechaMovimiento')?.IS_NULLABLE).toBe('NO');

      expect(colMap.has('observacion')).toBe(true);
      expect(colMap.get('observacion')?.IS_NULLABLE).toBe('YES');

      expect(colMap.has('idMaterial')).toBe(true);
      expect(colMap.get('idMaterial')?.DATA_TYPE).toBe('int');
      expect(colMap.get('idMaterial')?.IS_NULLABLE).toBe('NO');

      expect(colMap.has('idUsuario')).toBe(true);
      expect(colMap.get('idUsuario')?.DATA_TYPE).toBe('int');
      expect(colMap.get('idUsuario')?.IS_NULLABLE).toBe('NO');

      expect(colMap.has('idProveedor')).toBe(true);
      expect(colMap.get('idProveedor')?.DATA_TYPE).toBe('int');
      expect(colMap.get('idProveedor')?.IS_NULLABLE).toBe('YES');

      expect(colMap.has('idAveria')).toBe(true);
      expect(colMap.get('idAveria')?.IS_NULLABLE).toBe('YES');

      expect(colMap.has('idSolicitud')).toBe(true);
      expect(colMap.get('idSolicitud')?.IS_NULLABLE).toBe('YES');

      expect(colMap.has('idProyecto')).toBe(true);
      expect(colMap.get('idProyecto')?.IS_NULLABLE).toBe('YES');

      expect(colMap.has('createdAt')).toBe(true);
      expect(colMap.get('createdAt')?.IS_NULLABLE).toBe('NO');
    });

    it('debe confirmar la existencia de las llaves foráneas en SQL Server', async () => {
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
        WHERE t1.name = 'MovimientoInventario'
      `);

      const fkMap = new Map(foreignKeys.map((f) => [f.COLUMN_NAME, f]));

      expect(fkMap.has('idMaterial')).toBe(true);
      const fkMat = fkMap.get('idMaterial');
      expect(fkMat?.REF_TABLE).toBe('Material');
      expect(fkMat?.REF_COLUMN).toBe('id');

      expect(fkMap.has('idUsuario')).toBe(true);
      const fkUsr = fkMap.get('idUsuario');
      expect(fkUsr?.REF_TABLE).toBe('Usuario');
      expect(fkUsr?.REF_COLUMN).toBe('idUsuario');

      expect(fkMap.has('idProveedor')).toBe(true);
      const fkProv = fkMap.get('idProveedor');
      expect(fkProv?.REF_TABLE).toBe('Proveedor');
      expect(fkProv?.REF_COLUMN).toBe('id');
    });

    it('debe confirmar la existencia de los índices creados en SQL Server', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const indices = await dataSource.query<IndexRow[]>(`
        SELECT 
          i.name AS INDEX_NAME,
          t.name AS TABLE_NAME,
          c.name AS COLUMN_NAME
        FROM sys.indexes i
        INNER JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        INNER JOIN sys.tables t ON t.object_id = i.object_id
        INNER JOIN sys.columns c ON c.object_id = t.object_id AND c.column_id = ic.column_id
        WHERE t.name = 'MovimientoInventario' AND i.is_primary_key = 0
      `);

      const idxCols = new Set(indices.map((i) => i.COLUMN_NAME));
      expect(idxCols.has('idMaterial')).toBe(true);
      expect(idxCols.has('idUsuario')).toBe(true);
      expect(idxCols.has('fechaMovimiento')).toBe(true);
    });

    it('debe permitir insertar, consultar y limpiar un movimiento de prueba con integridad referencial en SQL Server (Rollback Garantizado)', async () => {
      if (!isConnected || !dataSource) {
        return;
      }

      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      try {
        // Obtener o crear material y usuario dentro de la transacción
        const materials = (await queryRunner.query(
          `SELECT TOP 1 id FROM Material`,
        )) as { id: number }[];
        let idMaterial: number;
        if (materials.length > 0) {
          idMaterial = materials[0].id;
        } else {
          const insMat = (await queryRunner.query(
            `INSERT INTO Material (nombre, unidadMedida, stockMinimo, stockActual, activo)
             OUTPUT INSERTED.id
             VALUES (@0, 'Unidad', 5, 10, 1)`,
            [`TEST_TEMP_Material_Mov_${uniqueSuffix}`],
          )) as { id: number }[];
          idMaterial = insMat[0].id;
        }

        const users = (await queryRunner.query(
          `SELECT TOP 1 idUsuario FROM Usuario`,
        )) as { idUsuario: number }[];
        let idUsuario: number;
        if (users.length > 0) {
          idUsuario = users[0].idUsuario;
        } else {
          const insUsr = (await queryRunner.query(
            `INSERT INTO Usuario OUTPUT INSERTED.idUsuario DEFAULT VALUES`,
          )) as { idUsuario: number }[];
          idUsuario = insUsr[0].idUsuario;
        }

        const insertResult = (await queryRunner.query(
          `
          INSERT INTO MovimientoInventario (tipo, cantidad, fechaMovimiento, observacion, idMaterial, idUsuario)
          OUTPUT INSERTED.id
          VALUES ('ENTRADA', 10, GETDATE(), @0, @1, @2)
        `,
          [`TEST_TEMP_Mov_${uniqueSuffix}`, idMaterial, idUsuario],
        )) as InsertIdRow[];

        const insertedId = insertResult[0]?.id;
        expect(insertedId).toBeDefined();

        const selectResult = (await queryRunner.query(
          `SELECT id, tipo, cantidad, observacion, idMaterial, idUsuario FROM MovimientoInventario WHERE id = @0`,
          [insertedId],
        )) as MovimientoSelectRow[];

        expect(selectResult.length).toBe(1);
        expect(selectResult[0]?.tipo).toBe('ENTRADA');
        expect(selectResult[0]?.cantidad).toBe(10);
        expect(selectResult[0]?.idMaterial).toBe(idMaterial);
        expect(selectResult[0]?.idUsuario).toBe(idUsuario);
      } finally {
        if (queryRunner.isTransactionActive) {
          await queryRunner.rollbackTransaction();
        }
        await queryRunner.release();
      }
    });
  });
});
