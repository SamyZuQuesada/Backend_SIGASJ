import { config as loadEnv } from 'dotenv';
import {
  DataSource,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateDocumentoMovimientoInventarioTable1724685000000 } from './migrations/1724685000000-CreateDocumentoMovimientoInventarioTable';

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
  ON_DELETE: string;
};
type IndexRow = {
  INDEX_NAME: string;
  TABLE_NAME: string;
  COLUMN_NAME: string;
};
type InsertIdRow = { id: number };

describe('Pruebas de Base de Datos: Migración DocumentoMovimientoInventario', () => {
  describe('1. Definición y Estructura de la Migración TypeORM', () => {
    it('debe contar con la migración CreateDocumentoMovimientoInventarioTable1724685000000', () => {
      const migration =
        new CreateDocumentoMovimientoInventarioTable1724685000000();
      expect(migration.name).toBe(
        'CreateDocumentoMovimientoInventarioTable1724685000000',
      );
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('debe definir la creación de la tabla DocumentoMovimientoInventario, FK e índice en up', async () => {
      const migration =
        new CreateDocumentoMovimientoInventarioTable1724685000000();
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
      expect(createdTable?.name).toBe('DocumentoMovimientoInventario');

      const colNames = createdTable?.columns.map((c) => c.name);
      expect(colNames).toEqual([
        'id',
        'nombreOriginal',
        'tipoArchivo',
        'rutaReferenciaArchivo',
        'tamanio',
        'idMovimiento',
        'createdAt',
        'updatedAt',
      ]);

      const idCol = createdTable?.columns.find((c) => c.name === 'id');
      expect(idCol?.isPrimary).toBe(true);
      expect(idCol?.isGenerated).toBe(true);
      expect(idCol?.generationStrategy).toBe('increment');

      const nombreCol = createdTable?.columns.find(
        (c) => c.name === 'nombreOriginal',
      );
      expect(nombreCol?.isNullable).toBe(false);
      expect(nombreCol?.length).toBe('255');

      const movCol = createdTable?.columns.find(
        (c) => c.name === 'idMovimiento',
      );
      expect(movCol?.isNullable).toBe(false);
      expect(movCol?.type).toBe('int');

      // Llave foránea
      expect(createForeignKeySpy).toHaveBeenCalledTimes(1);
      const fk = createdForeignKeys[0];
      expect(fk?.name).toBe('FK_DocumentoMovimientoInventario_Movimiento');
      expect(fk?.columnNames).toEqual(['idMovimiento']);
      expect(fk?.referencedTableName).toBe('MovimientoInventario');
      expect(fk?.referencedColumnNames).toEqual(['id']);
      expect(fk?.onDelete).toBe('CASCADE');

      // Índice
      expect(createIndexSpy).toHaveBeenCalledTimes(1);
      const idx = createdIndices[0];
      expect(idx?.name).toBe('IX_DocumentoMovimientoInventario_idMovimiento');
      expect(idx?.columnNames).toEqual(['idMovimiento']);
    });

    it('debe definir la reversión de índice, FK y tabla en down', async () => {
      const migration =
        new CreateDocumentoMovimientoInventarioTable1724685000000();

      const dropForeignKeySpy = jest.fn().mockResolvedValue(undefined);
      const dropIndexSpy = jest.fn().mockResolvedValue(undefined);
      const dropTableSpy = jest.fn().mockResolvedValue(undefined);

      const mockTable = {
        indices: [{ name: 'IX_DocumentoMovimientoInventario_idMovimiento' }],
        foreignKeys: [{ name: 'FK_DocumentoMovimientoInventario_Movimiento' }],
      };

      const mockQueryRunner = {
        getTable: jest.fn().mockResolvedValue(mockTable),
        dropForeignKey: dropForeignKeySpy,
        dropIndex: dropIndexSpy,
        dropTable: dropTableSpy,
      } as unknown as QueryRunner;

      await migration.down(mockQueryRunner);

      expect(dropIndexSpy).toHaveBeenCalled();
      expect(dropForeignKeySpy).toHaveBeenCalled();
      expect(dropTableSpy).toHaveBeenCalledWith(
        'DocumentoMovimientoInventario',
        true,
      );
    });
  });

  describe('2. Verificación de Integridad en SQL Server', () => {
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

    it('debe confirmar la existencia de la tabla DocumentoMovimientoInventario en SQL Server', async () => {
      if (!isConnected || !dataSource) return;

      const tables = await dataSource.query<TableRow[]>(`
        SELECT TABLE_NAME 
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_NAME = 'DocumentoMovimientoInventario'
      `);

      expect(tables.length).toBeGreaterThanOrEqual(1);
      expect(tables[0]?.TABLE_NAME).toBe('DocumentoMovimientoInventario');
    });

    it('debe coincidir la definición de columnas en SQL Server', async () => {
      if (!isConnected || !dataSource) return;

      const columns = await dataSource.query<ColumnRow[]>(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'DocumentoMovimientoInventario'
        ORDER BY ORDINAL_POSITION
      `);

      const colMap = new Map(columns.map((c) => [c.COLUMN_NAME, c]));

      expect(colMap.has('id')).toBe(true);
      expect(colMap.get('id')?.DATA_TYPE).toBe('int');

      expect(colMap.has('nombreOriginal')).toBe(true);
      expect(colMap.get('nombreOriginal')?.DATA_TYPE).toBe('varchar');

      expect(colMap.has('tipoArchivo')).toBe(true);
      expect(colMap.get('tipoArchivo')?.DATA_TYPE).toBe('varchar');

      expect(colMap.has('rutaReferenciaArchivo')).toBe(true);
      expect(colMap.get('rutaReferenciaArchivo')?.DATA_TYPE).toBe('varchar');

      expect(colMap.has('tamanio')).toBe(true);
      expect(colMap.get('tamanio')?.DATA_TYPE).toBe('int');

      expect(colMap.has('idMovimiento')).toBe(true);
      expect(colMap.get('idMovimiento')?.DATA_TYPE).toBe('int');

      expect(colMap.has('createdAt')).toBe(true);
      expect(colMap.has('updatedAt')).toBe(true);
    });

    it('debe confirmar la existencia de la llave foránea con CASCADE en SQL Server', async () => {
      if (!isConnected || !dataSource) return;

      const fks = await dataSource.query<ForeignKeyRow[]>(`
        SELECT 
          fk.name AS FK_NAME,
          t1.name AS TABLE_NAME,
          col1.name AS COLUMN_NAME,
          t2.name AS REF_TABLE,
          col2.name AS REF_COLUMN,
          fk.delete_referential_action_desc AS ON_DELETE
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
        INNER JOIN sys.tables t1 ON t1.object_id = fk.parent_object_id
        INNER JOIN sys.columns col1 ON col1.column_id = fkc.parent_column_id AND col1.object_id = fk.parent_object_id
        INNER JOIN sys.tables t2 ON t2.object_id = fk.referenced_object_id
        INNER JOIN sys.columns col2 ON col2.column_id = fkc.referenced_column_id AND col2.object_id = fk.referenced_object_id
        WHERE t1.name = 'DocumentoMovimientoInventario'
      `);

      expect(fks.length).toBeGreaterThanOrEqual(1);
      const fkMov = fks.find(
        (f) =>
          f.COLUMN_NAME === 'idMovimiento' &&
          f.REF_TABLE === 'MovimientoInventario',
      );
      expect(fkMov).toBeDefined();
      expect(fkMov?.COLUMN_NAME).toBe('idMovimiento');
      expect(fkMov?.REF_TABLE).toBe('MovimientoInventario');
      expect(fkMov?.REF_COLUMN).toBe('id');
      expect(fkMov?.ON_DELETE).toBe('CASCADE');
    });

    it('debe confirmar la existencia del índice IX_DocumentoMovimientoInventario_idMovimiento', async () => {
      if (!isConnected || !dataSource) return;

      const indices = await dataSource.query<IndexRow[]>(`
        SELECT 
          i.name AS INDEX_NAME,
          t.name AS TABLE_NAME,
          c.name AS COLUMN_NAME
        FROM sys.indexes i
        INNER JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        INNER JOIN sys.tables t ON t.object_id = i.object_id
        INNER JOIN sys.columns c ON c.object_id = t.object_id AND c.column_id = ic.column_id
        WHERE t.name = 'DocumentoMovimientoInventario' AND i.is_primary_key = 0
      `);

      const idxCols = new Set(indices.map((i) => i.COLUMN_NAME));
      expect(idxCols.has('idMovimiento')).toBe(true);
    });

    it('debe permitir insertar un documento de prueba vinculado a un movimiento y limpiarlo (Rollback Garantizado)', async () => {
      if (!isConnected || !dataSource) return;

      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      try {
        // Obtener o sembrar material, usuario y movimiento dentro de la transacción
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
            [`TEST_TEMP_Material_Doc_${uniqueSuffix}`],
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

        const movs = (await queryRunner.query(
          `SELECT TOP 1 id FROM MovimientoInventario`,
        )) as { id: number }[];
        let idMovimiento: number;
        if (movs.length > 0) {
          idMovimiento = movs[0].id;
        } else {
          const insMov = (await queryRunner.query(
            `INSERT INTO MovimientoInventario (tipo, cantidad, fechaMovimiento, observacion, idMaterial, idUsuario)
             OUTPUT INSERTED.id
             VALUES ('ENTRADA', 10, GETDATE(), @0, @1, @2)`,
            [`TEST_TEMP_Mov_Doc_${uniqueSuffix}`, idMaterial, idUsuario],
          )) as { id: number }[];
          idMovimiento = insMov[0].id;
        }

        const insertResult = (await queryRunner.query(
          `
          INSERT INTO DocumentoMovimientoInventario (
            nombreOriginal, tipoArchivo, rutaReferenciaArchivo, tamanio, idMovimiento
          )
          OUTPUT INSERTED.id
          VALUES (@0, 'application/pdf', @1, 2048, @2)
        `,
          [
            `TEST_TEMP_factura_${uniqueSuffix}.pdf`,
            `/api/v1/inventario/movimientos/${idMovimiento}/documentos/test.pdf`,
            idMovimiento,
          ],
        )) as InsertIdRow[];

        const docId = insertResult[0]?.id;
        expect(docId).toBeDefined();

        const selectResult = (await queryRunner.query(
          `SELECT id, nombreOriginal FROM DocumentoMovimientoInventario WHERE id = @0`,
          [docId],
        )) as { id: number; nombreOriginal: string }[];

        expect(selectResult.length).toBe(1);
        expect(selectResult[0]?.nombreOriginal).toBe(
          `TEST_TEMP_factura_${uniqueSuffix}.pdf`,
        );
      } finally {
        if (queryRunner.isTransactionActive) {
          await queryRunner.rollbackTransaction();
        }
        await queryRunner.release();
      }
    });
  });
});
