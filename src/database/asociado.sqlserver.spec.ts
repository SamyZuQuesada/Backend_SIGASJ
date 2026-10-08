import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { Asociado } from '../modules/asociados/entities/asociado.entity';

loadEnv();

type ColumnInfo = {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  CHARACTER_MAXIMUM_LENGTH: number | null;
  IS_NULLABLE: string;
  COLUMN_DEFAULT: string | null;
};

type IndexInfo = {
  INDEX_NAME: string;
  COLUMN_NAME: string;
  IS_UNIQUE: boolean;
};

describe('Validación física de tabla Asociado en SQL Server', () => {
  jest.setTimeout(60_000);
  let dataSource: DataSource;

  beforeAll(async () => {
    const options = buildMigrationDataSourceOptions();
    dataSource = new DataSource(options);
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('1. Debe confirmar que la tabla Asociado existe en SQL Server', async () => {
    const rows = await dataSource.query<{ total: number }[]>(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'Asociado'
    `);

    expect(Number(rows[0]?.total)).toBe(1);
  });

  it('2. Debe confirmar que no hay migraciones pendientes', async () => {
    const pending = await dataSource.showMigrations();
    expect(pending).toBe(false);
  });

  it('3. Debe tener todas las columnas requeridas con tipos y longitudes correctas', async () => {
    const cols = await dataSource.query<ColumnInfo[]>(`
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'Asociado'
      ORDER BY ORDINAL_POSITION
    `);

    const colMap = new Map(cols.map((c) => [c.COLUMN_NAME, c]));

    // id (int, identity, not null)
    const id = colMap.get('id');
    expect(id).toBeDefined();
    expect(id?.DATA_TYPE).toBe('int');
    expect(id?.IS_NULLABLE).toBe('NO');

    // nombre (varchar(100), not null)
    const nombre = colMap.get('nombre');
    expect(nombre).toBeDefined();
    expect(nombre?.DATA_TYPE).toBe('varchar');
    expect(nombre?.CHARACTER_MAXIMUM_LENGTH).toBe(100);
    expect(nombre?.IS_NULLABLE).toBe('NO');

    // apellidos (varchar(100), not null)
    const apellidos = colMap.get('apellidos');
    expect(apellidos).toBeDefined();
    expect(apellidos?.DATA_TYPE).toBe('varchar');
    expect(apellidos?.CHARACTER_MAXIMUM_LENGTH).toBe(100);
    expect(apellidos?.IS_NULLABLE).toBe('NO');

    // cedula (varchar(30), not null)
    const cedula = colMap.get('cedula');
    expect(cedula).toBeDefined();
    expect(cedula?.DATA_TYPE).toBe('varchar');
    expect(cedula?.CHARACTER_MAXIMUM_LENGTH).toBe(30);
    expect(cedula?.IS_NULLABLE).toBe('NO');

    // correoElectronico (varchar(150), not null)
    const correo = colMap.get('correoElectronico');
    expect(correo).toBeDefined();
    expect(correo?.DATA_TYPE).toBe('varchar');
    expect(correo?.CHARACTER_MAXIMUM_LENGTH).toBe(150);
    expect(correo?.IS_NULLABLE).toBe('NO');

    // activo (bit, not null)
    const activo = colMap.get('activo');
    expect(activo).toBeDefined();
    expect(activo?.DATA_TYPE).toBe('bit');
    expect(activo?.IS_NULLABLE).toBe('NO');

    // fechaRegistro (datetime2, not null)
    const fechaRegistro = colMap.get('fechaRegistro');
    expect(fechaRegistro).toBeDefined();
    expect(fechaRegistro?.DATA_TYPE).toBe('datetime2');
    expect(fechaRegistro?.IS_NULLABLE).toBe('NO');

    // fechaInactivacion (datetime2, nullable)
    const fechaInactivacion = colMap.get('fechaInactivacion');
    expect(fechaInactivacion).toBeDefined();
    expect(fechaInactivacion?.DATA_TYPE).toBe('datetime2');
    expect(fechaInactivacion?.IS_NULLABLE).toBe('YES');

    // createdAt (datetime2, not null)
    const createdAt = colMap.get('createdAt');
    expect(createdAt).toBeDefined();
    expect(createdAt?.DATA_TYPE).toBe('datetime2');
    expect(createdAt?.IS_NULLABLE).toBe('NO');

    // updatedAt (datetime2, not null)
    const updatedAt = colMap.get('updatedAt');
    expect(updatedAt).toBeDefined();
    expect(updatedAt?.DATA_TYPE).toBe('datetime2');
    expect(updatedAt?.IS_NULLABLE).toBe('NO');
  });

  it('4. Debe tener la restricción de llave primaria en la columna id', async () => {
    const pkRows = await dataSource.query<{ COLUMN_NAME: string }[]>(`
      SELECT kcu.COLUMN_NAME
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
        AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
      WHERE tc.TABLE_NAME = 'Asociado'
        AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
    `);

    expect(pkRows.length).toBe(1);
    expect(pkRows[0]?.COLUMN_NAME).toBe('id');
  });

  it('5. Debe contar con restricción / índice único para la columna cedula', async () => {
    const indices = await dataSource.query<IndexInfo[]>(`
      SELECT
        i.name AS INDEX_NAME,
        c.name AS COLUMN_NAME,
        i.is_unique AS IS_UNIQUE
      FROM sys.indexes i
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.object_id = OBJECT_ID('dbo.Asociado')
        AND c.name = 'cedula'
        AND i.is_unique = 1
    `);

    expect(indices.length).toBeGreaterThanOrEqual(1);
    expect(indices[0]?.IS_UNIQUE).toBe(true);
    expect(indices[0]?.COLUMN_NAME).toBe('cedula');
  });

  it('6. Debe insertar un asociado mediante TypeORM y validar persistencia y fechaInactivacion en NULL', async () => {
    const repo = dataSource.getRepository(Asociado);
    const testCedula = `TEST-${Date.now()}`;

    const nuevoAsociado = repo.create({
      nombre: 'Carlos',
      apellidos: 'Mora Rodríguez',
      cedula: testCedula,
      correoElectronico: 'carlos.mora@asadasanjuan.cr',
      activo: true,
      fechaInactivacion: null,
    });

    const guardado = await repo.save(nuevoAsociado);

    try {
      expect(guardado.id).toBeGreaterThan(0);
      expect(guardado.nombre).toBe('Carlos');
      expect(guardado.apellidos).toBe('Mora Rodríguez');
      expect(guardado.cedula).toBe(testCedula);
      expect(guardado.activo).toBe(true);
      expect(guardado.fechaInactivacion).toBeNull();
      expect(guardado.fechaRegistro).toBeInstanceOf(Date);
      expect(guardado.createdAt).toBeInstanceOf(Date);
      expect(guardado.updatedAt).toBeInstanceOf(Date);

      // Consulta directa desde SQL Server
      const rawRows = await dataSource.query<
        {
          id: number;
          cedula: string;
          activo: boolean | number;
          fechaInactivacion: Date | null;
        }[]
      >(`
        SELECT id, cedula, activo, fechaInactivacion
        FROM Asociado
        WHERE id = ${guardado.id}
      `);

      expect(rawRows.length).toBe(1);
      expect(rawRows[0]?.cedula).toBe(testCedula);
      expect(rawRows[0]?.fechaInactivacion).toBeNull();
    } finally {
      await repo.delete({ id: guardado.id });
    }
  });

  it('7. Debe rechazar la inserción de cédulas duplicadas por la restricción UNIQUE', async () => {
    const repo = dataSource.getRepository(Asociado);
    const testCedulaDuplicada = `DUP-${Date.now()}`;

    const asociado1 = repo.create({
      nombre: 'Asociado Uno',
      apellidos: 'Prueba',
      cedula: testCedulaDuplicada,
      correoElectronico: 'uno@test.cr',
      activo: true,
      fechaInactivacion: null,
    });

    const guardado1 = await repo.save(asociado1);

    try {
      const asociado2 = repo.create({
        nombre: 'Asociado Dos',
        apellidos: 'Prueba',
        cedula: testCedulaDuplicada,
        correoElectronico: 'dos@test.cr',
        activo: true,
        fechaInactivacion: null,
      });

      await expect(repo.save(asociado2)).rejects.toThrow();
    } finally {
      await repo.delete({ id: guardado1.id });
    }
  });
});
