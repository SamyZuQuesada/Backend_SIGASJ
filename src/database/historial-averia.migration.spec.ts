import { DataSource, QueryRunner, Table } from 'typeorm';
import { CreateHistorialAveriaTable1724685920000 } from './migrations/1724685920000-CreateHistorialAveriaTable';

describe('Migración HistorialAveria', () => {
  it('define columnas, FKs e índices para SQL Server', async () => {
    const migration = new CreateHistorialAveriaTable1724685920000();
    let created: Table | undefined;
    const createForeignKey = jest.fn().mockResolvedValue(undefined);
    const queryRunner = {
      connection: { options: { type: 'mssql' } },
      hasTable: jest.fn().mockResolvedValue(false),
      createTable: jest.fn().mockImplementation((table: Table) => {
        created = table;
        return Promise.resolve();
      }),
      createForeignKey,
      createIndex: jest.fn().mockResolvedValue(undefined),
    } as unknown as QueryRunner;

    await migration.up(queryRunner);

    expect(created?.name).toBe('HistorialAveria');
    const fecha = created?.columns.find(
      (column) => column.name === 'fechaHora',
    );
    expect(fecha?.type).toBe('datetime2');
    expect(fecha?.isNullable).toBe(false);
    expect(
      created?.columns.find((column) => column.name === 'estadoAnterior')
        ?.isNullable,
    ).toBe(true);
    expect(
      created?.columns.find((column) => column.name === 'idUsuario')
        ?.isNullable,
    ).toBe(true);
    expect(createForeignKey).toHaveBeenCalledWith(
      'HistorialAveria',
      expect.objectContaining({
        name: 'FK_HistorialAveria_Averia',
        onDelete: 'NO ACTION',
      }),
    );
    expect(createForeignKey).toHaveBeenCalledWith(
      'HistorialAveria',
      expect.objectContaining({
        name: 'FK_HistorialAveria_Usuario',
        onDelete: 'SET NULL',
      }),
    );
  });

  it('crea y revierte la tabla cuando Averia y Usuario ya existen', async () => {
    const dataSource = new DataSource({
      type: 'sqljs',
      entities: [],
      synchronize: false,
    });
    await dataSource.initialize();
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.query(
      'CREATE TABLE "Usuario" ("idUsuario" integer PRIMARY KEY AUTOINCREMENT NOT NULL)',
    );
    await queryRunner.query(
      'CREATE TABLE "Averia" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL)',
    );
    const migration = new CreateHistorialAveriaTable1724685920000();

    await migration.up(queryRunner);
    expect(await queryRunner.getTable('HistorialAveria')).toBeTruthy();

    await migration.up(queryRunner);
    expect(await queryRunner.getTable('HistorialAveria')).toBeTruthy();

    await migration.down(queryRunner);
    expect(await queryRunner.getTable('HistorialAveria')).toBeFalsy();
    await dataSource.destroy();
  });
});
