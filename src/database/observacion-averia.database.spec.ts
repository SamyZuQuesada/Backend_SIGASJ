import { QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
import { CreateObservacionAveriaTable1724685700000 } from './migrations/1724685700000-CreateObservacionAveriaTable';

describe('Migración ObservacionAveria', () => {
  it('define CreateObservacionAveriaTable1724685700000', () => {
    const migration = new CreateObservacionAveriaTable1724685700000();
    expect(migration.name).toBe('CreateObservacionAveriaTable1724685700000');
    expect(typeof migration.up).toBe('function');
    expect(typeof migration.down).toBe('function');
  });

  it('crea solo ObservacionAveria con PK, texto, fecha y FK sin CASCADE', async () => {
    const migration = new CreateObservacionAveriaTable1724685700000();
    let createdTable: Table | undefined;
    const foreignKeys: TableForeignKey[] = [];
    const indexes: TableIndex[] = [];

    const mockQueryRunner = {
      connection: {
        options: {
          type: 'mssql',
        },
      },
      hasTable: jest.fn().mockResolvedValue(false),
      createTable: jest.fn().mockImplementation((table: Table) => {
        createdTable = table;
        return Promise.resolve();
      }),
      createForeignKey: jest
        .fn()
        .mockImplementation((_table: string, fk: TableForeignKey) => {
          foreignKeys.push(fk);
          return Promise.resolve();
        }),
      createIndex: jest
        .fn()
        .mockImplementation((_table: string, index: TableIndex) => {
          indexes.push(index);
          return Promise.resolve();
        }),
    } as unknown as QueryRunner;

    await migration.up(mockQueryRunner);

    expect(createdTable?.name).toBe('ObservacionAveria');
    const colMap = new Map(
      (createdTable?.columns ?? []).map((column) => [column.name, column]),
    );
    expect(colMap.get('id')?.isPrimary).toBe(true);
    expect(colMap.get('id')?.isGenerated).toBe(true);
    expect(colMap.get('idAveria')?.isNullable).toBe(false);
    expect(colMap.get('idUsuarioAutor')?.isNullable).toBe(false);
    expect(colMap.get('observacion')?.type).toBe('nvarchar');
    expect(colMap.get('observacion')?.length).toBe('2000');
    expect(colMap.get('observacion')?.isNullable).toBe(false);
    expect(colMap.get('fechaCreacion')?.type).toBe('datetime2');
    expect(colMap.get('fechaCreacion')?.isNullable).toBe(false);
    expect(colMap.has('observacionesAtencion')).toBe(false);

    expect(foreignKeys).toHaveLength(2);
    expect(foreignKeys[0]).toMatchObject({
      name: 'FK_ObservacionAveria_Averia',
      referencedTableName: 'Averia',
      onDelete: 'NO ACTION',
    });
    expect(foreignKeys[1]).toMatchObject({
      name: 'FK_ObservacionAveria_Usuario_Autor',
      referencedTableName: 'Usuario',
      onDelete: 'NO ACTION',
    });
    expect(indexes.map((index) => index.name)).toEqual([
      'IX_ObservacionAveria_idAveria',
      'IX_ObservacionAveria_idUsuarioAutor',
    ]);
  });

  it('no recrea la tabla si ya existe', async () => {
    const migration = new CreateObservacionAveriaTable1724685700000();
    const createTable = jest.fn();
    const mockQueryRunner = {
      connection: { options: { type: 'mssql' } },
      hasTable: jest.fn().mockResolvedValue(true),
      createTable,
    } as unknown as QueryRunner;

    await migration.up(mockQueryRunner);
    expect(createTable).not.toHaveBeenCalled();
  });
});
