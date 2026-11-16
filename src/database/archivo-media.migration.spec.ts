import { QueryRunner, Table } from 'typeorm';
import { CreateArchivoMediaTable1724686410000 } from './migrations/1724686410000-CreateArchivoMediaTable';

describe('Migración ArchivoMedia', () => {
  it('define esquema compatible con Azure SQL Database', async () => {
    const migration = new CreateArchivoMediaTable1724686410000();
    let created: Table | undefined;
    const createIndex = jest.fn().mockResolvedValue(undefined);

    const queryRunner = {
      connection: { options: { type: 'mssql' } },
      hasTable: jest.fn().mockResolvedValue(false),
      getTable: jest.fn().mockResolvedValue({ indices: [] }),
      createTable: jest.fn().mockImplementation((table: Table) => {
        created = table;
        return Promise.resolve();
      }),
      createIndex,
    } as unknown as QueryRunner;

    await migration.up(queryRunner);

    expect(created?.name).toBe('ArchivoMedia');

    const col = (name: string) =>
      created?.columns.find((column) => column.name === name);

    // Clave primaria
    expect(col('id')?.isPrimary).toBe(true);
    expect(col('id')?.isGenerated).toBe(true);

    // Ruta única
    expect(col('ruta')?.type).toBe('varchar');
    expect(col('ruta')?.length).toBe('500');
    expect(col('ruta')?.isNullable).toBe(false);
    expect(col('ruta')?.isUnique).toBe(true);

    // Tipo MIME
    expect(col('mime')?.type).toBe('varchar');
    expect(col('mime')?.length).toBe('120');
    expect(col('mime')?.isNullable).toBe(false);

    // Contenido binario VARBINARY(MAX)
    expect(col('contenido')?.type).toBe('varbinary');
    expect(col('contenido')?.length).toBe('max');
    expect(col('contenido')?.isNullable).toBe(false);

    // Metadatos de gobernanza
    expect(col('tamanoBytes')?.type).toBe('bigint');
    expect(col('tamanoBytes')?.isNullable).toBe(false);
    expect(col('tamanoBytes')?.default).toBe('0');

    expect(col('createdAt')?.type).toBe('datetime2');
    expect(col('createdAt')?.isNullable).toBe(false);
    expect(col('createdAt')?.default).toBe('SYSUTCDATETIME()');

    expect(col('updatedAt')?.type).toBe('datetime2');
    expect(col('updatedAt')?.isNullable).toBe(true);
  });

  it('no vuelve a crear la tabla si ya existe (idempotente)', async () => {
    const migration = new CreateArchivoMediaTable1724686410000();
    const createTable = jest.fn();

    const queryRunner = {
      connection: { options: { type: 'mssql' } },
      hasTable: jest.fn().mockResolvedValue(true),
      createTable,
    } as unknown as QueryRunner;

    await migration.up(queryRunner);
    expect(createTable).not.toHaveBeenCalled();
  });

  it('si la tabla está vacía en rollback, elimina la tabla normalmente', async () => {
    const migration = new CreateArchivoMediaTable1724686410000();
    const dropTable = jest.fn().mockResolvedValue(undefined);
    const query = jest.fn().mockResolvedValue([{ total: 0 }]);

    const queryRunner = {
      connection: { options: { type: 'mssql' } },
      hasTable: jest.fn().mockResolvedValue(true),
      dropTable,
      query,
    } as unknown as QueryRunner;

    await migration.down(queryRunner);
    expect(dropTable).toHaveBeenCalledWith('ArchivoMedia', true, true, true);
  });

  it('si la tabla contiene archivos en rollback, la preserva renombrándola para evitar pérdida de datos', async () => {
    const migration = new CreateArchivoMediaTable1724686410000();
    const dropTable = jest.fn().mockResolvedValue(undefined);
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total: 43 }]) // Conteo de archivos existentes
      .mockResolvedValueOnce([]); // sp_rename

    const queryRunner = {
      connection: { options: { type: 'mssql' } },
      hasTable: jest.fn().mockResolvedValue(true),
      dropTable,
      query,
    } as unknown as QueryRunner;

    await migration.down(queryRunner);

    // NO debe haber hecho dropTable
    expect(dropTable).not.toHaveBeenCalled();

    // Debe haber ejecutado sp_rename para salvaguardar los archivos
    expect(query).toHaveBeenCalledWith(
      `EXEC sp_rename 'dbo.ArchivoMedia', 'ArchivoMedia_Backup_Rollback'`,
    );
  });
});
