import { QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
import { CreateIntentoSmsAveriaTable1724685910000 } from './migrations/1724685910000-CreateIntentoSmsAveriaTable';
import { CreateNotificacionAveriaTable1724685900000 } from './migrations/1724685900000-CreateNotificacionAveriaTable';

describe('Migraciones PBI 2.8 — NotificacionAveria e IntentoSmsAveria', () => {
  it('define CreateNotificacionAveriaTable1724685900000', () => {
    const migration = new CreateNotificacionAveriaTable1724685900000();
    expect(migration.name).toBe('CreateNotificacionAveriaTable1724685900000');
    expect(typeof migration.up).toBe('function');
    expect(typeof migration.down).toBe('function');
  });

  it('define CreateIntentoSmsAveriaTable1724685910000', () => {
    const migration = new CreateIntentoSmsAveriaTable1724685910000();
    expect(migration.name).toBe('CreateIntentoSmsAveriaTable1724685910000');
    expect(typeof migration.up).toBe('function');
    expect(typeof migration.down).toBe('function');
  });

  it('crea NotificacionAveria con destinatario, avería, tipo, lectura y único', async () => {
    const migration = new CreateNotificacionAveriaTable1724685900000();
    let createdTable: Table | undefined;
    const foreignKeys: TableForeignKey[] = [];
    const indexes: TableIndex[] = [];

    const mockQueryRunner = {
      connection: { options: { type: 'mssql' } },
      hasTable: jest.fn((name: string) =>
        Promise.resolve(name !== 'NotificacionAveria'),
      ),
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

    expect(createdTable?.name).toBe('NotificacionAveria');
    const colMap = new Map(
      (createdTable?.columns ?? []).map((column) => [column.name, column]),
    );
    expect(colMap.get('id')?.isPrimary).toBe(true);
    expect(colMap.get('idUsuarioDestinatario')?.isNullable).toBe(false);
    expect(colMap.get('idAveria')?.isNullable).toBe(false);
    expect(colMap.get('tipo')?.isNullable).toBe(false);
    expect(colMap.get('titulo')?.isNullable).toBe(false);
    expect(colMap.get('mensaje')?.isNullable).toBe(false);
    expect(colMap.get('leida')?.isNullable).toBe(false);
    expect(colMap.has('telefono')).toBe(false);
    expect(colMap.has('nombreReportante')).toBe(false);

    expect(foreignKeys.map((fk) => fk.onDelete)).toEqual([
      'NO ACTION',
      'NO ACTION',
    ]);
    expect(indexes.some((index) => index.isUnique)).toBe(true);
  });

  it('crea IntentoSmsAveria separado, sin teléfono ni estado ENTREGADA', async () => {
    const migration = new CreateIntentoSmsAveriaTable1724685910000();
    let createdTable: Table | undefined;

    const mockQueryRunner = {
      connection: { options: { type: 'mssql' } },
      hasTable: jest.fn((name: string) =>
        Promise.resolve(name !== 'IntentoSmsAveria'),
      ),
      createTable: jest.fn().mockImplementation((table: Table) => {
        createdTable = table;
        return Promise.resolve();
      }),
      createForeignKey: jest.fn().mockResolvedValue(undefined),
      createIndex: jest.fn().mockResolvedValue(undefined),
    } as unknown as QueryRunner;

    await migration.up(mockQueryRunner);

    const colMap = new Map(
      (createdTable?.columns ?? []).map((column) => [column.name, column]),
    );
    expect(createdTable?.name).toBe('IntentoSmsAveria');
    expect(colMap.has('telefono')).toBe(false);
    expect(colMap.has('telefonoReportante')).toBe(false);
    expect(colMap.get('estadoEnvio')?.isNullable).toBe(false);
    expect(colMap.get('motivoBloqueo')?.isNullable).toBe(false);
  });

  it('no recrea las tablas si ya existen', async () => {
    const notificacion = new CreateNotificacionAveriaTable1724685900000();
    const sms = new CreateIntentoSmsAveriaTable1724685910000();
    const createTable = jest.fn();
    const mockQueryRunner = {
      connection: { options: { type: 'mssql' } },
      hasTable: jest.fn().mockResolvedValue(true),
      createTable,
    } as unknown as QueryRunner;

    await notificacion.up(mockQueryRunner);
    await sms.up(mockQueryRunner);
    expect(createTable).not.toHaveBeenCalled();
  });
});
