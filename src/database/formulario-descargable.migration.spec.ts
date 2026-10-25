import { DataSource, QueryRunner, Table } from 'typeorm';
import { CreateFormularioDescargableTable1724686340000 } from './migrations/1724686340000-CreateFormularioDescargableTable';

describe('Migración FormularioDescargable', () => {
  it('define columnas e índice activo para SQL Server', async () => {
    const migration = new CreateFormularioDescargableTable1724686340000();
    let created: Table | undefined;
    const createIndex = jest.fn().mockResolvedValue(undefined);
    const queryRunner = {
      connection: { options: { type: 'mssql' } },
      hasTable: jest.fn().mockResolvedValue(false),
      createTable: jest.fn().mockImplementation((table: Table) => {
        created = table;
        return Promise.resolve();
      }),
      createIndex,
    } as unknown as QueryRunner;

    await migration.up(queryRunner);

    expect(created?.name).toBe('FormularioDescargable');

    const col = (name: string) =>
      created?.columns.find((column) => column.name === name);

    expect(col('id')?.isPrimary).toBe(true);
    expect(col('id')?.isGenerated).toBe(true);

    expect(col('nombre')?.type).toBe('nvarchar');
    expect(col('nombre')?.length).toBe('200');
    expect(col('nombre')?.isNullable).toBe(false);

    expect(col('descripcion')?.type).toBe('nvarchar');
    expect(col('descripcion')?.length).toBe('1000');
    expect(col('descripcion')?.isNullable).toBe(true);

    expect(col('nombreArchivoOriginal')?.type).toBe('varchar');
    expect(col('nombreArchivoOriginal')?.length).toBe('255');
    expect(col('nombreArchivoOriginal')?.isNullable).toBe(false);

    expect(col('nombreArchivoInterno')?.type).toBe('varchar');
    expect(col('nombreArchivoInterno')?.length).toBe('255');
    expect(col('nombreArchivoInterno')?.isNullable).toBe(false);

    expect(col('ubicacionArchivo')?.type).toBe('varchar');
    expect(col('ubicacionArchivo')?.length).toBe('255');
    expect(col('ubicacionArchivo')?.isNullable).toBe(false);

    expect(col('activo')?.type).toBe('bit');
    expect(col('activo')?.default).toBe(0);
    expect(col('activo')?.isNullable).toBe(false);

    expect(col('fechaPublicacion')?.type).toBe('datetime2');
    expect(col('fechaPublicacion')?.isNullable).toBe(true);

    expect(col('createdAt')?.type).toBe('datetime2');
    expect(col('createdAt')?.isNullable).toBe(false);
    expect(col('updatedAt')?.type).toBe('datetime2');
    expect(col('updatedAt')?.isNullable).toBe(false);

    expect(createIndex).toHaveBeenCalledWith(
      'FormularioDescargable',
      expect.objectContaining({
        name: 'IX_FormularioDescargable_activo',
      }),
    );
  });

  it('crea y revierte la tabla (sql.js)', async () => {
    const dataSource = new DataSource({
      type: 'sqljs',
      entities: [],
      synchronize: false,
    });
    await dataSource.initialize();
    const qr = dataSource.createQueryRunner();
    const migration = new CreateFormularioDescargableTable1724686340000();

    await migration.up(qr);
    expect(await qr.hasTable('FormularioDescargable')).toBe(true);

    await migration.down(qr);
    expect(await qr.hasTable('FormularioDescargable')).toBe(false);

    await qr.release();
    await dataSource.destroy();
  });
});
