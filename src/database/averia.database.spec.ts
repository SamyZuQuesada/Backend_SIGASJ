import { config as loadEnv } from 'dotenv';
import { DataSource, QueryRunner, Table } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateAveriaTable1724685100000 } from './migrations/1724685100000-CreateAveriaTable';

loadEnv();

type TableRow = { TABLE_NAME: string };
type ColumnRow = {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
  COLUMN_DEFAULT: string | null;
};
type UniqueRow = { INDEX_NAME: string };
type ForeignKeyRow = {
  FK_NAME: string;
  COLUMN_NAME: string;
  REF_TABLE: string;
  REF_COLUMN: string;
  DELETE_ACTION: string;
};
type InsertIdRow = { id: number };
type AveriaSelectRow = {
  id: number;
  codigoSeguimiento: string;
  nombreReportante: string;
  telefonoReportante: string;
  identificacionReportante: string | null;
  correoReportante: string | null;
  idAbonado: number | null;
  estado: string;
  tipoAveria: string | null;
  prioridad: string | null;
  idFontaneroAsignado: number | null;
  fechaAsignacion: Date | null;
  observacionesAtencion: string | null;
};

describe('Pruebas de Base de Datos: Migración Averia', () => {
  describe('1. Definición de la migración TypeORM', () => {
    it('debe contar con la migración CreateAveriaTable1724685100000', () => {
      const migration = new CreateAveriaTable1724685100000();
      expect(migration.name).toBe('CreateAveriaTable1724685100000');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('crea únicamente la tabla Averia con PK, unique, nullability y FK de Fontanero', async () => {
      const migration = new CreateAveriaTable1724685100000();
      let createdTable: Table | undefined;

      const createTableSpy = jest
        .fn()
        .mockImplementation((table: Table): Promise<void> => {
          createdTable = table;
          return Promise.resolve();
        });
      const createForeignKeySpy = jest.fn().mockResolvedValue(undefined);
      const hasTableSpy = jest.fn().mockResolvedValue(true);
      const querySpy = jest.fn().mockResolvedValue(undefined);

      const mockQueryRunner = {
        connection: {
          options: {
            type: 'mssql',
          },
        },
        hasTable: hasTableSpy,
        query: querySpy,
        createTable: createTableSpy,
        createForeignKey: createForeignKeySpy,
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);

      expect(querySpy).not.toHaveBeenCalled();
      expect(createTableSpy).toHaveBeenCalledTimes(1);
      expect(createdTable?.name).toBe('Averia');

      const colNames = createdTable?.columns.map((c) => c.name);
      expect(colNames).toEqual([
        'id',
        'codigoSeguimiento',
        'fechaReporte',
        'nombreReportante',
        'identificacionReportante',
        'telefonoReportante',
        'correoReportante',
        'idAbonado',
        'ubicacion',
        'sectorComunidad',
        'descripcion',
        'estado',
        'tipoAveria',
        'prioridad',
        'idFontaneroAsignado',
        'fechaAsignacion',
        'fechaInicioAtencion',
        'fechaResolucion',
        'observacionesAtencion',
        'createdAt',
        'updatedAt',
      ]);

      const idCol = createdTable?.columns.find((c) => c.name === 'id');
      expect(idCol?.isPrimary).toBe(true);
      expect(idCol?.isGenerated).toBe(true);
      expect(idCol?.generationStrategy).toBe('increment');

      const codigo = createdTable?.columns.find(
        (c) => c.name === 'codigoSeguimiento',
      );
      expect(codigo?.isUnique).toBe(true);
      expect(codigo?.isNullable).toBe(false);

      const telefono = createdTable?.columns.find(
        (c) => c.name === 'telefonoReportante',
      );
      expect(telefono?.isNullable).toBe(false);

      const identificacion = createdTable?.columns.find(
        (c) => c.name === 'identificacionReportante',
      );
      expect(identificacion?.isNullable).toBe(true);

      const estado = createdTable?.columns.find((c) => c.name === 'estado');
      expect(estado?.default).toBe("'RECIBIDA'");
      expect(estado?.isNullable).toBe(false);

      const fechaAsignacion = createdTable?.columns.find(
        (c) => c.name === 'fechaAsignacion',
      );
      expect(fechaAsignacion?.isNullable).toBe(true);
      expect(fechaAsignacion?.default).toBeUndefined();

      expect(createForeignKeySpy).toHaveBeenCalledWith(
        'Averia',
        expect.objectContaining({
          name: 'FK_Averia_Usuario_FontaneroAsignado',
          referencedTableName: 'Usuario',
          referencedColumnNames: ['idUsuario'],
          onDelete: 'SET NULL',
        }),
      );
    });

    it('no toca tablas ajenas en down: solo elimina FK y tabla Averia', async () => {
      const migration = new CreateAveriaTable1724685100000();
      const dropForeignKeySpy = jest.fn().mockResolvedValue(undefined);
      const dropTableSpy = jest.fn().mockResolvedValue(undefined);
      const mockTable = {
        foreignKeys: [{ name: 'FK_Averia_Usuario_FontaneroAsignado' }],
      };

      const mockQueryRunner = {
        getTable: jest.fn().mockResolvedValue(mockTable),
        dropForeignKey: dropForeignKeySpy,
        dropTable: dropTableSpy,
      } as unknown as QueryRunner;

      await migration.down(mockQueryRunner);

      expect(dropForeignKeySpy).toHaveBeenCalledWith(
        'Averia',
        mockTable.foreignKeys[0],
      );
      expect(dropTableSpy).toHaveBeenCalledWith('Averia', true);
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
          '[AVISO QA] SQL Server no está disponible en este entorno local:',
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

    it('confirma la existencia de la tabla Averia', async () => {
      const db = requireSqlServer();

      const tables = await db.query<TableRow[]>(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = 'Averia'
      `);

      expect(tables.length).toBeGreaterThanOrEqual(1);
      expect(tables[0]?.TABLE_NAME).toBe('Averia');
    });

    it('coincide la definición de columnas, tipos, nullability y default de estado', async () => {
      const db = requireSqlServer();

      const columns = await db.query<ColumnRow[]>(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Averia'
        ORDER BY ORDINAL_POSITION
      `);

      const colMap = new Map(columns.map((c) => [c.COLUMN_NAME, c]));

      expect(colMap.get('id')?.DATA_TYPE).toBe('int');
      expect(colMap.get('id')?.IS_NULLABLE).toBe('NO');

      expect(colMap.get('codigoSeguimiento')?.IS_NULLABLE).toBe('NO');
      expect(colMap.get('telefonoReportante')?.IS_NULLABLE).toBe('NO');
      expect(colMap.get('nombreReportante')?.IS_NULLABLE).toBe('NO');
      expect(colMap.get('ubicacion')?.IS_NULLABLE).toBe('NO');
      expect(colMap.get('sectorComunidad')?.IS_NULLABLE).toBe('NO');
      expect(colMap.get('descripcion')?.IS_NULLABLE).toBe('NO');
      expect(colMap.get('estado')?.IS_NULLABLE).toBe('NO');
      expect(String(colMap.get('estado')?.COLUMN_DEFAULT)).toContain(
        'RECIBIDA',
      );

      expect(colMap.get('identificacionReportante')?.IS_NULLABLE).toBe('YES');
      expect(colMap.get('correoReportante')?.IS_NULLABLE).toBe('YES');
      expect(colMap.get('idAbonado')?.IS_NULLABLE).toBe('YES');
      expect(colMap.get('tipoAveria')?.IS_NULLABLE).toBe('YES');
      expect(colMap.get('prioridad')?.IS_NULLABLE).toBe('YES');
      expect(colMap.get('idFontaneroAsignado')?.IS_NULLABLE).toBe('YES');
      expect(colMap.get('fechaAsignacion')?.IS_NULLABLE).toBe('YES');
      expect(colMap.get('fechaInicioAtencion')?.IS_NULLABLE).toBe('YES');
      expect(colMap.get('fechaResolucion')?.IS_NULLABLE).toBe('YES');
      expect(colMap.get('observacionesAtencion')?.IS_NULLABLE).toBe('YES');

      expect(colMap.get('fechaReporte')?.DATA_TYPE).toBe('datetime2');
      expect(colMap.get('createdAt')?.DATA_TYPE).toBe('datetime2');
      expect(colMap.get('updatedAt')?.DATA_TYPE).toBe('datetime2');
    });

    it('garantiza UNIQUE sobre codigoSeguimiento', async () => {
      const db = requireSqlServer();

      const indexes = await db.query<UniqueRow[]>(`
        SELECT i.name AS INDEX_NAME
        FROM sys.indexes i
        INNER JOIN sys.index_columns ic
          ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        INNER JOIN sys.columns c
          ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        INNER JOIN sys.tables t ON t.object_id = i.object_id
        WHERE t.name = 'Averia'
          AND c.name = 'codigoSeguimiento'
          AND i.is_unique = 1
      `);

      expect(indexes.length).toBeGreaterThanOrEqual(1);
    });

    it('confirma FK de Fontanero asignado hacia Usuario con ON DELETE SET NULL', async () => {
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
        WHERE t1.name = 'Averia' AND col1.name = 'idFontaneroAsignado'
      `);

      expect(foreignKeys.length).toBe(1);
      expect(foreignKeys[0]?.REF_TABLE).toBe('Usuario');
      expect(foreignKeys[0]?.REF_COLUMN).toBe('idUsuario');
      expect(foreignKeys[0]?.DELETE_ACTION).toBe('SET_NULL');
    });

    it('inserta una avería mínima sin Abonado y hace rollback', async () => {
      const db = requireSqlServer();

      const queryRunner = db.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();
      const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

      try {
        const insertResult = (await queryRunner.query(`
          INSERT INTO Averia (
            codigoSeguimiento, nombreReportante, telefonoReportante,
            ubicacion, sectorComunidad, descripcion
          )
          OUTPUT INSERTED.id
          VALUES (
            'AVR-QA-${suffix}', 'QA Reportante', '2680-0000',
            'Dirección de prueba QA', 'San Juan', 'Fuga de prueba QA'
          )
        `)) as InsertIdRow[];

        const insertedId = insertResult[0]?.id;
        expect(insertedId).toBeDefined();

        const rows = (await queryRunner.query(
          `SELECT id, codigoSeguimiento, nombreReportante, telefonoReportante,
                  identificacionReportante, correoReportante, idAbonado, estado,
                  tipoAveria, prioridad, idFontaneroAsignado, fechaAsignacion,
                  observacionesAtencion
           FROM Averia WHERE id = @0`,
          [insertedId],
        )) as AveriaSelectRow[];

        expect(rows.length).toBe(1);
        expect(rows[0]?.estado).toBe('RECIBIDA');
        expect(rows[0]?.idAbonado).toBeNull();
        expect(rows[0]?.identificacionReportante).toBeNull();
        expect(rows[0]?.correoReportante).toBeNull();
        expect(rows[0]?.tipoAveria).toBeNull();
        expect(rows[0]?.prioridad).toBeNull();
        expect(rows[0]?.idFontaneroAsignado).toBeNull();
        expect(rows[0]?.fechaAsignacion).toBeNull();
        expect(rows[0]?.observacionesAtencion).toBeNull();
      } finally {
        if (queryRunner.isTransactionActive) {
          await queryRunner.rollbackTransaction();
        }
        await queryRunner.release();
      }
    });
  });
});
