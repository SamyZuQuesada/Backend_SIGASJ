import { DataSource, QueryRunner, Table } from 'typeorm';
import { AddObservacionesHistorialSolicitud1724686350000 } from './migrations/1724686350000-AddObservacionesHistorialSolicitud';
import { CreateHistorialSolicitudTable1724686220000 } from './migrations/1724686220000-CreateHistorialSolicitudTable';

describe('Migración HistorialSolicitud', () => {
  it('define columnas, FKs e índices para SQL Server (main 622)', async () => {
    const migration = new CreateHistorialSolicitudTable1724686220000();
    let created: Table | undefined;
    const createForeignKey = jest.fn().mockResolvedValue(undefined);
    const createIndex = jest.fn().mockResolvedValue(undefined);
    const queryRunner = {
      connection: { options: { type: 'mssql' } },
      hasTable: jest.fn().mockResolvedValue(false),
      createTable: jest.fn().mockImplementation((table: Table) => {
        created = table;
        return Promise.resolve();
      }),
      createForeignKey,
      createIndex,
    } as unknown as QueryRunner;

    await migration.up(queryRunner);

    expect(created?.name).toBe('HistorialSolicitud');

    const col = (name: string) =>
      created?.columns.find((column) => column.name === name);

    expect(col('solicitudId')?.isNullable).toBe(false);
    expect(col('evento')?.isNullable).toBe(false);
    expect(col('tipoEvento')?.isNullable).toBe(true);
    expect(col('descripcion')?.isNullable).toBe(true);
    expect(col('estadoAnterior')?.isNullable).toBe(true);
    expect(col('estadoAnterior')?.length).toBe('30');
    expect(col('estadoNuevo')?.isNullable).toBe(false);
    expect(col('estadoNuevo')?.length).toBe('30');
    expect(col('idUsuario')?.isNullable).toBe(true);
    expect(col('fechaHora')?.type).toBe('datetime2');
    expect(col('fechaHora')?.isNullable).toBe(false);

    expect(createForeignKey).toHaveBeenCalledWith(
      'HistorialSolicitud',
      expect.objectContaining({
        name: 'FK_HistorialSolicitud_Solicitud',
        columnNames: ['solicitudId'],
        referencedTableName: 'Solicitud',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
      }),
    );
    expect(createForeignKey).toHaveBeenCalledWith(
      'HistorialSolicitud',
      expect.objectContaining({
        name: 'FK_HistorialSolicitud_Usuario',
        columnNames: ['idUsuario'],
        referencedTableName: 'Usuario',
        referencedColumnNames: ['idUsuario'],
        onDelete: 'SET NULL',
      }),
    );
    expect(createIndex).toHaveBeenCalledWith(
      'HistorialSolicitud',
      expect.objectContaining({
        name: 'IX_HistorialSolicitud_solicitudId_fechaHora',
      }),
    );
  });

  it('añade observacionPublica y notaInterna (635)', async () => {
    const migration = new AddObservacionesHistorialSolicitud1724686350000();
    const addColumn = jest.fn().mockResolvedValue(undefined);
    const queryRunner = {
      connection: { options: { type: 'mssql' } },
      getTable: jest.fn().mockResolvedValue({
        findColumnByName: () => undefined,
      }),
      addColumn,
    } as unknown as QueryRunner;

    await migration.up(queryRunner);

    expect(addColumn).toHaveBeenCalledWith(
      'HistorialSolicitud',
      expect.objectContaining({ name: 'observacionPublica' }),
    );
    expect(addColumn).toHaveBeenCalledWith(
      'HistorialSolicitud',
      expect.objectContaining({ name: 'notaInterna' }),
    );
  });

  it('crea y revierte la tabla cuando Solicitud y Usuario ya existen (sql.js)', async () => {
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
      'CREATE TABLE "Solicitud" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL)',
    );
    const migration = new CreateHistorialSolicitudTable1724686220000();

    await migration.up(queryRunner);
    expect(await queryRunner.getTable('HistorialSolicitud')).toBeTruthy();

    await migration.up(queryRunner);
    expect(await queryRunner.getTable('HistorialSolicitud')).toBeTruthy();

    await migration.down(queryRunner);
    expect(await queryRunner.getTable('HistorialSolicitud')).toBeFalsy();
    await dataSource.destroy();
  });
});
