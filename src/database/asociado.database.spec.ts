import { QueryRunner, Table, TableIndex } from 'typeorm';
import { CreateAsociadoTable1724685940000 } from './migrations/1724685940000-CreateAsociadoTable';

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
});
