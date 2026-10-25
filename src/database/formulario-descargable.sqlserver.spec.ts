import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { FormularioDescargable } from '../modules/contenido-publico/entities/formulario-descargable.entity';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateFormularioDescargableTable1724686340000 } from './migrations/1724686340000-CreateFormularioDescargableTable';

loadEnv();

type ColumnInfo = {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  CHARACTER_MAXIMUM_LENGTH: number | null;
  IS_NULLABLE: string;
  COLUMN_DEFAULT: string | null;
};

describe('FormularioDescargable contra SQL Server', () => {
  jest.setTimeout(60_000);
  let dataSource: DataSource | null = null;
  let isConnected = false;
  let hasTable = false;

  beforeAll(async () => {
    try {
      const options = buildMigrationDataSourceOptions();
      if (options.type !== 'mssql') {
        return;
      }
      dataSource = new DataSource(options);
      await dataSource.initialize();
      isConnected = true;

      const existing = await dataSource.query<{ total: number }[]>(`
        SELECT COUNT(*) AS total
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'FormularioDescargable'
      `);

      if (Number(existing[0]?.total) === 0) {
        const migration = new CreateFormularioDescargableTable1724686340000();
        const qr = dataSource.createQueryRunner();
        await migration.up(qr);
        await qr.release();
      }

      const tables = await dataSource.query<{ total: number }[]>(`
        SELECT COUNT(*) AS total
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'FormularioDescargable'
      `);
      hasTable = Number(tables[0]?.total) === 1;
    } catch (error) {
      isConnected = false;
      console.warn(
        '[AVISO QA] SQL Server no disponible para FormularioDescargable:',
        error instanceof Error ? error.message : error,
      );
    }
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  const skipIfUnavailable = (): boolean => {
    if (!isConnected || !dataSource || !hasTable) {
      console.warn(
        '[AVISO QA] SQL Server / FormularioDescargable no disponible: prueba omitida',
      );
      return true;
    }
    return false;
  };

  it('valida columnas, tipos, nullables y default de activo', async () => {
    if (skipIfUnavailable() || !dataSource) return;

    const cols = await dataSource.query<ColumnInfo[]>(`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'FormularioDescargable'
    `);
    const colMap = new Map(cols.map((c) => [c.COLUMN_NAME, c]));

    expect(colMap.get('id')?.DATA_TYPE).toBe('int');

    expect(colMap.get('nombre')?.DATA_TYPE).toBe('nvarchar');
    expect(colMap.get('nombre')?.CHARACTER_MAXIMUM_LENGTH).toBe(200);
    expect(colMap.get('nombre')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('descripcion')?.DATA_TYPE).toBe('nvarchar');
    expect(colMap.get('descripcion')?.CHARACTER_MAXIMUM_LENGTH).toBe(1000);
    expect(colMap.get('descripcion')?.IS_NULLABLE).toBe('YES');

    expect(colMap.get('nombreArchivoOriginal')?.DATA_TYPE).toBe('varchar');
    expect(colMap.get('nombreArchivoOriginal')?.CHARACTER_MAXIMUM_LENGTH).toBe(
      255,
    );
    expect(colMap.get('nombreArchivoOriginal')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('nombreArchivoInterno')?.DATA_TYPE).toBe('varchar');
    expect(colMap.get('nombreArchivoInterno')?.CHARACTER_MAXIMUM_LENGTH).toBe(
      255,
    );
    expect(colMap.get('ubicacionArchivo')?.DATA_TYPE).toBe('varchar');
    expect(colMap.get('ubicacionArchivo')?.CHARACTER_MAXIMUM_LENGTH).toBe(255);
    expect(colMap.get('ubicacionArchivo')?.IS_NULLABLE).toBe('NO');

    expect(colMap.get('activo')?.DATA_TYPE).toBe('bit');
    expect(colMap.get('activo')?.IS_NULLABLE).toBe('NO');
    expect(String(colMap.get('activo')?.COLUMN_DEFAULT ?? '')).toMatch(
      /\(?\(?0\)?\)?/,
    );

    expect(['datetime2', 'datetime']).toContain(
      colMap.get('fechaPublicacion')?.DATA_TYPE,
    );
    expect(colMap.get('fechaPublicacion')?.IS_NULLABLE).toBe('YES');

    expect(['datetime2', 'datetime']).toContain(
      colMap.get('createdAt')?.DATA_TYPE,
    );
    expect(colMap.get('createdAt')?.IS_NULLABLE).toBe('NO');
    expect(['datetime2', 'datetime']).toContain(
      colMap.get('updatedAt')?.DATA_TYPE,
    );
    expect(colMap.get('updatedAt')?.IS_NULLABLE).toBe('NO');

    const indexes = await dataSource.query<{ name: string }[]>(`
      SELECT i.name AS name
      FROM sys.indexes i
      INNER JOIN sys.tables t ON t.object_id = i.object_id
      WHERE t.name = 'FormularioDescargable'
        AND i.name = 'IX_FormularioDescargable_activo'
    `);
    expect(indexes.length).toBe(1);
  });

  it('persiste creación, activo, archivo, descripción, fechas y Unicode', async () => {
    if (skipIfUnavailable() || !dataSource) return;

    const repo = dataSource.getRepository(FormularioDescargable);
    const stamp = Date.now();
    const ubicacion = `formularios-descargables/test-${stamp}.pdf`;

    const creado = await repo.save(
      repo.create({
        nombre: 'Formulario de actualización de datos áéíóúñ',
        descripcion: 'Descripción con tildes: áéíóú ñ Ñ.',
        nombreArchivoOriginal: 'actualización-datos.pdf',
        nombreArchivoInterno: `interno-${stamp}.pdf`,
        ubicacionArchivo: ubicacion,
        activo: true,
        fechaPublicacion: new Date('2026-10-25T15:00:00.000Z'),
      }),
    );

    expect(creado.id).toBeGreaterThan(0);
    expect(creado.createdAt).toBeInstanceOf(Date);
    expect(creado.updatedAt).toBeInstanceOf(Date);
    expect(creado.activo).toBe(true);
    expect(creado.nombre).toContain('áéíóúñ');
    expect(creado.descripcion).toContain('ñ Ñ');
    expect(creado.ubicacionArchivo).toBe(ubicacion);
    expect(creado.ubicacionArchivo).not.toMatch(/^[A-Za-z]:\\/);

    const leido = await repo.findOneByOrFail({ id: creado.id });
    expect(leido.activo).toBe(true);
    expect(leido.nombreArchivoOriginal).toBe('actualización-datos.pdf');
    expect(leido.nombreArchivoInterno).toBe(`interno-${stamp}.pdf`);
    expect(leido.fechaPublicacion).toBeInstanceOf(Date);

    const inactivo = await repo.save(
      repo.create({
        nombre: 'Borrador sin publicar',
        descripcion: null,
        nombreArchivoOriginal: 'borrador.pdf',
        nombreArchivoInterno: `borrador-${stamp}.pdf`,
        ubicacionArchivo: `formularios-descargables/borrador-${stamp}.pdf`,
        activo: false,
        fechaPublicacion: null,
      }),
    );
    expect(inactivo.activo).toBe(false);
    expect(inactivo.descripcion).toBeNull();
    expect(inactivo.fechaPublicacion).toBeNull();

    const antesUpdate = inactivo.updatedAt;
    await new Promise((resolve) => setTimeout(resolve, 20));
    inactivo.activo = true;
    inactivo.fechaPublicacion = new Date();
    const actualizado = await repo.save(inactivo);
    expect(actualizado.activo).toBe(true);
    expect(actualizado.updatedAt.getTime()).toBeGreaterThanOrEqual(
      antesUpdate.getTime(),
    );

    const nombreLargo = 'N'.repeat(200);
    const descLarga = 'D'.repeat(1000);
    const largo = await repo.save(
      repo.create({
        nombre: nombreLargo,
        descripcion: descLarga,
        nombreArchivoOriginal: 'largo.pdf',
        nombreArchivoInterno: `largo-${stamp}.pdf`,
        ubicacionArchivo: `formularios-descargables/largo-${stamp}.pdf`,
        activo: false,
        fechaPublicacion: null,
      }),
    );
    expect(largo.nombre).toHaveLength(200);
    expect(largo.descripcion).toHaveLength(1000);

    await repo.delete([creado.id, inactivo.id, largo.id]);
  });
});
