import { QueryRunner, Table, TableIndex } from 'typeorm';
import { CreateAsociadoTable1724685940000 } from './migrations/1724685940000-CreateAsociadoTable';
import { EnsureAsociadoCedulaUniqueAndNormalized1724685980000 } from './migrations/1724685980000-EnsureAsociadoCedulaUniqueAndNormalized';

describe('Pruebas de Base de Datos e Integridad: Migración Asociado', () => {
  describe('1. Definición y Estructura de la Migración TypeORM', () => {
    it('debe contar con la migración CreateAsociadoTable1724685940000 bien nombrada', () => {
      const migration = new CreateAsociadoTable1724685940000();
      expect(migration.name).toBe('CreateAsociadoTable1724685940000');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('debe definir la creación de la tabla Asociado con las columnas y restricciones adecuadas en up', async () => {
      const migration = new CreateAsociadoTable1724685940000();
      let createdTable: Table | undefined;
      let createdIndex: TableIndex | undefined;

      const createTableSpy = jest
        .fn()
        .mockImplementation((table: Table): Promise<void> => {
          createdTable = table;
          return Promise.resolve();
        });

      const createIndexSpy = jest
        .fn()
        .mockImplementation(
          (tableName: string, index: TableIndex): Promise<void> => {
            createdIndex = index;
            return Promise.resolve();
          },
        );

      const mockQueryRunner = {
        connection: {
          options: {
            type: 'mssql',
          },
        },
        hasTable: jest.fn().mockResolvedValue(false),
        createTable: createTableSpy,
        createIndex: createIndexSpy,
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);

      expect(createTableSpy).toHaveBeenCalled();
      expect(createdTable).toBeDefined();
      expect(createdTable?.name).toBe('Asociado');

      const colNames = createdTable?.columns.map((c) => c.name);
      expect(colNames).toEqual([
        'id',
        'nombre',
        'apellidos',
        'cedula',
        'correoElectronico',
        'activo',
        'fechaRegistro',
        'fechaInactivacion',
        'createdAt',
        'updatedAt',
      ]);

      // Verificar llave primaria
      const idCol = createdTable?.columns.find((c) => c.name === 'id');
      expect(idCol?.isPrimary).toBe(true);
      expect(idCol?.isGenerated).toBe(true);
      expect(idCol?.generationStrategy).toBe('increment');

      // Verificar campos obligatorios y longitudes
      const nombreCol = createdTable?.columns.find((c) => c.name === 'nombre');
      expect(nombreCol?.isNullable).toBe(false);
      expect(nombreCol?.length).toBe('100');

      const apellidosCol = createdTable?.columns.find(
        (c) => c.name === 'apellidos',
      );
      expect(apellidosCol?.isNullable).toBe(false);
      expect(apellidosCol?.length).toBe('100');

      const cedulaCol = createdTable?.columns.find((c) => c.name === 'cedula');
      expect(cedulaCol?.isNullable).toBe(false);
      expect(cedulaCol?.length).toBe('30');
      expect(cedulaCol?.isUnique).toBe(true);

      const correoCol = createdTable?.columns.find(
        (c) => c.name === 'correoElectronico',
      );
      expect(correoCol?.isNullable).toBe(false);
      expect(correoCol?.length).toBe('150');

      // Verificar activo y su valor por defecto
      const activoCol = createdTable?.columns.find((c) => c.name === 'activo');
      expect(activoCol?.isNullable).toBe(false);

      // Verificar fechas
      const fechaRegCol = createdTable?.columns.find(
        (c) => c.name === 'fechaRegistro',
      );
      expect(fechaRegCol?.isNullable).toBe(false);

      const fechaInactCol = createdTable?.columns.find(
        (c) => c.name === 'fechaInactivacion',
      );
      expect(fechaInactCol?.isNullable).toBe(true);

      // Verificar índice único en up
      expect(createIndexSpy).toHaveBeenCalled();
      expect(createdIndex?.isUnique).toBe(true);
      expect(createdIndex?.columnNames).toContain('cedula');
    });

    it('debe revertir la creación de la tabla en down', async () => {
      const migration = new CreateAsociadoTable1724685940000();
      const dropTableSpy = jest.fn().mockResolvedValue(undefined);
      const dropIndexSpy = jest.fn().mockResolvedValue(undefined);
      const getTableSpy = jest.fn().mockResolvedValue({
        indices: [{ name: 'UQ_Asociado_cedula' }],
      });

      const mockQueryRunner = {
        getTable: getTableSpy,
        dropIndex: dropIndexSpy,
        dropTable: dropTableSpy,
      } as unknown as QueryRunner;

      await migration.down(mockQueryRunner);

      expect(getTableSpy).toHaveBeenCalledWith('Asociado');
      expect(dropIndexSpy).toHaveBeenCalled();
      expect(dropTableSpy).toHaveBeenCalledWith('Asociado', true);
    });
  });

  describe('2. Migración EnsureAsociadoCedulaUniqueAndNormalized', () => {
    it('debe contar con la migración EnsureAsociadoCedulaUniqueAndNormalized1724685980000 bien nombrada', () => {
      const migration =
        new EnsureAsociadoCedulaUniqueAndNormalized1724685980000();
      expect(migration.name).toBe(
        'EnsureAsociadoCedulaUniqueAndNormalized1724685980000',
      );
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('debe normalizar registros existentes y asegurar el índice único UQ_Asociado_cedula en up', async () => {
      const migration =
        new EnsureAsociadoCedulaUniqueAndNormalized1724685980000();
      const querySpy = jest.fn().mockImplementation((queryStr: string) => {
        if (queryStr.includes('SELECT id, cedula FROM Asociado')) {
          return Promise.resolve([
            { id: 1, cedula: '112340567' },
            { id: 2, cedula: '2-0456-0789' },
          ]);
        }
        return Promise.resolve();
      });

      let createdIndex: TableIndex | undefined;
      const createIndexSpy = jest
        .fn()
        .mockImplementation(
          (_tableName: string, index: TableIndex): Promise<void> => {
            createdIndex = index;
            return Promise.resolve();
          },
        );

      const mockTable = new Table({
        name: 'Asociado',
        columns: [
          { name: 'id', type: 'int' },
          { name: 'cedula', type: 'varchar' },
        ],
        indices: [], // Simula que no tiene el índice aún
      });

      const mockQueryRunner = {
        connection: { options: { type: 'mssql' } },
        getTable: jest.fn().mockResolvedValue(mockTable),
        query: querySpy,
        createIndex: createIndexSpy,
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);

      // Debe haber actualizado el registro no normalizado
      expect(querySpy).toHaveBeenCalledWith(
        'UPDATE Asociado SET cedula = @0 WHERE id = @1',
        ['1-1234-0567', 1],
      );

      // Debe haber creado el índice único
      expect(createIndexSpy).toHaveBeenCalled();
      expect(createdIndex?.name).toBe('UQ_Asociado_cedula');
      expect(createdIndex?.isUnique).toBe(true);
      expect(createdIndex?.columnNames).toEqual(['cedula']);
    });

    it('no debe duplicar el índice si ya existe en up', async () => {
      const migration =
        new EnsureAsociadoCedulaUniqueAndNormalized1724685980000();
      const createIndexSpy = jest.fn();

      const mockTable = new Table({
        name: 'Asociado',
        columns: [
          { name: 'id', type: 'int' },
          { name: 'cedula', type: 'varchar' },
        ],
        indices: [
          new TableIndex({
            name: 'UQ_Asociado_cedula',
            columnNames: ['cedula'],
            isUnique: true,
          }),
        ],
      });

      const mockQueryRunner = {
        connection: { options: { type: 'mssql' } },
        getTable: jest.fn().mockResolvedValue(mockTable),
        query: jest.fn().mockResolvedValue([]),
        createIndex: createIndexSpy,
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);

      expect(createIndexSpy).not.toHaveBeenCalled();
    });

    it('debe eliminar el índice en down si existe', async () => {
      const migration =
        new EnsureAsociadoCedulaUniqueAndNormalized1724685980000();
      const dropIndexSpy = jest.fn().mockResolvedValue(undefined);

      const existingIndex = new TableIndex({
        name: 'UQ_Asociado_cedula',
        columnNames: ['cedula'],
        isUnique: true,
      });

      const mockTable = new Table({
        name: 'Asociado',
        columns: [],
        indices: [existingIndex],
      });

      const mockQueryRunner = {
        getTable: jest.fn().mockResolvedValue(mockTable),
        dropIndex: dropIndexSpy,
      } as unknown as QueryRunner;

      await migration.down(mockQueryRunner);

      expect(dropIndexSpy).toHaveBeenCalledWith('Asociado', existingIndex);
    });
  });
});
