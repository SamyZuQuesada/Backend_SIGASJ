import { QueryRunner, Table, TableForeignKey } from 'typeorm';
import { CreateSolicitudTable1724686100000 } from './migrations/1724686100000-CreateSolicitudTable';

describe('Pruebas de Base de Datos e Integridad: Migración Solicitud', () => {
  describe('1. Definición y Estructura de la Migración TypeORM', () => {
    it('debe tener el nombre correcto de migración y métodos up y down', () => {
      const migration = new CreateSolicitudTable1724686100000();
      expect(migration.name).toBe('CreateSolicitudTable1724686100000');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('debe definir la tabla Solicitud con todas las columnas, restricciones, índices y foreign keys', async () => {
      const migration = new CreateSolicitudTable1724686100000();
      let createdTable: Table | undefined;
      let createdFk: TableForeignKey | undefined;

      const createTableSpy = jest
        .fn()
        .mockImplementation((table: Table): Promise<void> => {
          createdTable = table;
          return Promise.resolve();
        });

      const createFkSpy = jest
        .fn()
        .mockImplementation(
          (tableName: string, fk: TableForeignKey): Promise<void> => {
            createdFk = fk;
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
        createForeignKey: createFkSpy,
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);

      expect(mockQueryRunner.hasTable).toHaveBeenCalledWith('Solicitud');
      expect(createTableSpy).toHaveBeenCalled();
      expect(createdTable).toBeDefined();
      expect(createdTable?.name).toBe('Solicitud');

      // 1. Columnas presentes
      const colNames = createdTable?.columns.map((c) => c.name);
      expect(colNames).toEqual([
        'id',
        'tipoSolicitudId',
        'codigoSeguimiento',
        'estado',
        'fechaIngreso',
        'deletedAt',
        'createdAt',
        'updatedAt',
      ]);

      // 2. Llave primaria
      const idCol = createdTable?.columns.find((c) => c.name === 'id');
      expect(idCol?.isPrimary).toBe(true);
      expect(idCol?.isGenerated).toBe(true);
      expect(idCol?.generationStrategy).toBe('increment');

      // 3. Foreign key id
      const tipoIdCol = createdTable?.columns.find(
        (c) => c.name === 'tipoSolicitudId',
      );
      expect(tipoIdCol?.type).toBe('int');
      expect(tipoIdCol?.isNullable).toBe(false);

      // 4. Código de seguimiento único
      const codigoCol = createdTable?.columns.find(
        (c) => c.name === 'codigoSeguimiento',
      );
      expect(codigoCol?.type).toBe('varchar');
      expect(codigoCol?.length).toBe('50');
      expect(codigoCol?.isUnique).toBe(true);
      expect(codigoCol?.isNullable).toBe(false);

      // 5. Estado
      const estadoCol = createdTable?.columns.find((c) => c.name === 'estado');
      expect(estadoCol?.type).toBe('varchar');
      expect(estadoCol?.length).toBe('30');
      expect(estadoCol?.default).toBe("'PENDIENTE'");
      expect(estadoCol?.isNullable).toBe(false);

      // 6. Fecha de ingreso
      const fechaIngresoCol = createdTable?.columns.find(
        (c) => c.name === 'fechaIngreso',
      );
      expect(fechaIngresoCol?.type).toBe('datetime2');
      expect(fechaIngresoCol?.default).toBe('GETDATE()');
      expect(fechaIngresoCol?.isNullable).toBe(false);

      // 7. DeletedAt (soft delete para evitar borrado físico)
      const deletedAtCol = createdTable?.columns.find(
        (c) => c.name === 'deletedAt',
      );
      expect(deletedAtCol?.type).toBe('datetime2');
      expect(deletedAtCol?.isNullable).toBe(true);

      // 8. Timestamps
      const createdCol = createdTable?.columns.find(
        (c) => c.name === 'createdAt',
      );
      expect(createdCol?.type).toBe('datetime2');
      expect(createdCol?.isNullable).toBe(false);

      const updatedCol = createdTable?.columns.find(
        (c) => c.name === 'updatedAt',
      );
      expect(updatedCol?.type).toBe('datetime2');
      expect(updatedCol?.isNullable).toBe(false);

      // 9. Índices
      const indices = createdTable?.indices || [];
      const indexNames = indices.map((i) => i.name);
      expect(indexNames).toContain('UQ_Solicitud_codigoSeguimiento');
      expect(indexNames).toContain('IX_Solicitud_tipoSolicitudId');
      expect(indexNames).toContain('IX_Solicitud_estado');
      expect(indexNames).toContain('IX_Solicitud_fechaIngreso');

      const uqCodigo = indices.find(
        (i) => i.name === 'UQ_Solicitud_codigoSeguimiento',
      );
      expect(uqCodigo?.isUnique).toBe(true);
      expect(uqCodigo?.columnNames).toEqual(['codigoSeguimiento']);

      // 10. Clave foránea con restricción de eliminación (sin CASCADE)
      expect(createFkSpy).toHaveBeenCalledWith(
        'Solicitud',
        expect.any(TableForeignKey),
      );
      expect(createdFk).toBeDefined();
      expect(createdFk?.name).toBe('FK_Solicitud_TipoSolicitud');
      expect(createdFk?.columnNames).toEqual(['tipoSolicitudId']);
      expect(createdFk?.referencedTableName).toBe('TipoSolicitud');
      expect(createdFk?.referencedColumnNames).toEqual(['id']);
      expect(createdFk?.onDelete).toBe('NO ACTION');
    });

    it('no debe volver a crear la tabla si ya existe', async () => {
      const migration = new CreateSolicitudTable1724686100000();
      const createTableSpy = jest.fn();

      const mockQueryRunner = {
        connection: {
          options: {
            type: 'mssql',
          },
        },
        hasTable: jest.fn().mockResolvedValue(true),
        createTable: createTableSpy,
      } as unknown as QueryRunner;

      await migration.up(mockQueryRunner);

      expect(mockQueryRunner.hasTable).toHaveBeenCalledWith('Solicitud');
      expect(createTableSpy).not.toHaveBeenCalled();
    });

    it('debe revertir la tabla y su clave foránea en down', async () => {
      const migration = new CreateSolicitudTable1724686100000();
      const dropForeignKeySpy = jest.fn().mockResolvedValue(undefined);
      const dropTableSpy = jest.fn().mockResolvedValue(undefined);

      const fk = new TableForeignKey({
        name: 'FK_Solicitud_TipoSolicitud',
        columnNames: ['tipoSolicitudId'],
        referencedTableName: 'TipoSolicitud',
        referencedColumnNames: ['id'],
      });

      const mockQueryRunner = {
        hasTable: jest.fn().mockResolvedValue(true),
        getTable: jest.fn().mockResolvedValue({
          foreignKeys: [fk],
        }),
        dropForeignKey: dropForeignKeySpy,
        dropTable: dropTableSpy,
      } as unknown as QueryRunner;

      await migration.down(mockQueryRunner);

      expect(mockQueryRunner.hasTable).toHaveBeenCalledWith('Solicitud');
      expect(dropForeignKeySpy).toHaveBeenCalledWith('Solicitud', fk);
      expect(dropTableSpy).toHaveBeenCalledWith('Solicitud', true);
    });
  });
});
