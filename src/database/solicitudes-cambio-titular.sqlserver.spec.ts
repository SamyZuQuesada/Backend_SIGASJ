import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateSolicitudCambioTitularTable1724686140000 } from './migrations/1724686140000-CreateSolicitudCambioTitularTable';

loadEnv();

type TableCountRow = { total: number };
type ColumnInfo = {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  CHARACTER_MAXIMUM_LENGTH: number | null;
  IS_NULLABLE: string;
};
type ForeignKeyInfo = {
  FK_NAME: string;
  TABLE_NAME: string;
  COLUMN_NAME: string;
  REF_TABLE: string;
  REF_COLUMN: string;
  ON_DELETE: string;
};
type IndexInfo = {
  INDEX_NAME: string;
  COLUMN_NAME: string;
  IS_UNIQUE: boolean;
};

describe('Validación física de tabla SolicitudCambioTitular en SQL Server', () => {
  jest.setTimeout(60_000);
  let dataSource: DataSource;

  beforeAll(async () => {
    const options = buildMigrationDataSourceOptions();
    dataSource = new DataSource(options);
    await dataSource.initialize();
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('1. Debe confirmar que la tabla SolicitudCambioTitular existe en dbo', async () => {
    const rows = await dataSource.query<TableCountRow[]>(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'SolicitudCambioTitular'
    `);
    expect(Number(rows[0]?.total)).toBe(1);
  });

  it('2. Debe validar columnas, tipos, longitudes y nullability', async () => {
    const columns = await dataSource.query<ColumnInfo[]>(`
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'SolicitudCambioTitular'
    `);

    const colMap = new Map<string, ColumnInfo>();
    columns.forEach((c) => colMap.set(c.COLUMN_NAME, c));

    const requiredVarchar = (
      name: string,
      length: number,
      nullable: 'YES' | 'NO',
    ) => {
      const col = colMap.get(name);
      expect(col).toBeDefined();
      expect(col!.DATA_TYPE).toMatch(/^(n?varchar|varchar)$/);
      expect(col!.CHARACTER_MAXIMUM_LENGTH).toBe(length);
      expect(col!.IS_NULLABLE).toBe(nullable);
    };

    expect(colMap.get('id')?.DATA_TYPE).toBe('int');
    expect(colMap.get('id')?.IS_NULLABLE).toBe('NO');
    expect(colMap.get('solicitudId')?.DATA_TYPE).toBe('int');
    expect(colMap.get('solicitudId')?.IS_NULLABLE).toBe('NO');

    requiredVarchar('nombreSolicitante', 150, 'NO');
    requiredVarchar('identificacionSolicitante', 30, 'NO');
    requiredVarchar('telefono', 30, 'NO');
    requiredVarchar('nombrePropietarioRegistral', 150, 'NO');
    requiredVarchar('identificacionPropietario', 30, 'NO');
    requiredVarchar('folioReal', 50, 'YES');
    requiredVarchar('planoCatastrado', 50, 'YES');
    requiredVarchar('planoAgrimensura', 50, 'YES');
    requiredVarchar('naturalezaInmueble', 80, 'NO');
    requiredVarchar('calidadTitular', 80, 'NO');
    requiredVarchar('nis', 50, 'NO');
    requiredVarchar('facturaANombreDe', 150, 'NO');
    requiredVarchar('medioNotificacionPrincipal', 80, 'NO');
    requiredVarchar('medioNotificacionSecundario', 80, 'YES');

    const firma = colMap.get('firma');
    expect(firma).toBeDefined();
    expect(firma!.CHARACTER_MAXIMUM_LENGTH).toBe(-1);
    expect(firma!.IS_NULLABLE).toBe('YES');
  });

  it('3. Debe validar FK CASCADE hacia Solicitud', async () => {
    const fks = await dataSource.query<ForeignKeyInfo[]>(`
      SELECT
        fk.name AS FK_NAME,
        tp.name AS TABLE_NAME,
        cp.name AS COLUMN_NAME,
        tr.name AS REF_TABLE,
        cr.name AS REF_COLUMN,
        fk.delete_referential_action_desc AS ON_DELETE
      FROM sys.foreign_keys fk
      INNER JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
      INNER JOIN sys.tables tr ON fk.referenced_object_id = tr.object_id
      INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
      INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
      WHERE tp.name = 'SolicitudCambioTitular'
    `);

    const fk = fks.find((f) => f.COLUMN_NAME === 'solicitudId');
    expect(fk).toBeDefined();
    expect(fk!.REF_TABLE).toBe('Solicitud');
    expect(fk!.REF_COLUMN).toBe('id');
    expect(fk!.ON_DELETE).toBe('CASCADE');
  });

  it('4. Debe validar UNIQUE 1:1 en solicitudId e índices secundarios', async () => {
    const indices = await dataSource.query<IndexInfo[]>(`
      SELECT
        i.name AS INDEX_NAME,
        c.name AS COLUMN_NAME,
        i.is_unique AS IS_UNIQUE
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      INNER JOIN sys.tables t ON i.object_id = t.object_id
      WHERE t.name = 'SolicitudCambioTitular'
    `);

    expect(
      indices.find(
        (idx) => idx.COLUMN_NAME === 'solicitudId' && idx.IS_UNIQUE === true,
      ),
    ).toBeDefined();
    expect(
      indices.find((idx) =>
        idx.INDEX_NAME.includes('identificacionSolicitante'),
      ),
    ).toBeDefined();
    expect(
      indices.find((idx) => idx.INDEX_NAME.includes('_nis')),
    ).toBeDefined();
  });

  it('5. Debe persistir un detalle completo y borrar en cascada', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    type InsertedIdRow = { id: number };
    type DetalleRow = {
      nombreSolicitante: string;
      identificacionSolicitante: string;
      nombrePropietarioRegistral: string;
      folioReal: string | null;
      planoAgrimensura: string | null;
      naturalezaInmueble: string;
      calidadTitular: string;
      nis: string;
      medioNotificacionSecundario: string | null;
      firma: string | null;
    };

    try {
      const insertSol = (await queryRunner.query(`
        INSERT INTO Solicitud (tipoSolicitudId, codigoSeguimiento, estado, fechaIngreso, createdAt, updatedAt)
        OUTPUT INSERTED.id
        VALUES (2, 'SOL-TEST-CTIT-01', 'PENDIENTE', GETDATE(), GETDATE(), GETDATE())
      `)) as InsertedIdRow[];
      const solId = insertSol[0].id;

      await queryRunner.query(
        `
        INSERT INTO SolicitudCambioTitular (
          solicitudId, nombreSolicitante, identificacionSolicitante, telefono,
          nombrePropietarioRegistral, identificacionPropietario,
          folioReal, planoCatastrado, planoAgrimensura,
          naturalezaInmueble, calidadTitular, nis, facturaANombreDe,
          medioNotificacionPrincipal, medioNotificacionSecundario, firma,
          createdAt, updatedAt
        ) VALUES (
          @0, @1, @2, @3, @4, @5, @6, @7, @8, @9, @10, @11, @12, @13, @14, @15,
          GETDATE(), GETDATE()
        )
      `,
        [
          solId,
          'Ana Lucía Vargas Quirós',
          '1-1234-0567',
          '8888-1234',
          'Carlos Alberto Mora Jiménez',
          '1-0987-6543',
          '123456-000',
          'SJ-1234567-2020',
          null,
          'Inscrito',
          'Propietario',
          'NIS-45892',
          'Carlos Alberto Mora Jiménez',
          'Correo electrónico',
          null,
          'data:image/png;base64,abc',
        ],
      );

      const detalle = (await queryRunner.query(
        `SELECT * FROM SolicitudCambioTitular WHERE solicitudId = @0`,
        [solId],
      )) as DetalleRow[];
      expect(detalle.length).toBe(1);
      expect(detalle[0].nombreSolicitante).toBe('Ana Lucía Vargas Quirós');
      expect(detalle[0].identificacionSolicitante).toBe('1-1234-0567');
      expect(detalle[0].nombrePropietarioRegistral).toBe(
        'Carlos Alberto Mora Jiménez',
      );
      expect(detalle[0].folioReal).toBe('123456-000');
      expect(detalle[0].planoAgrimensura).toBeNull();
      expect(detalle[0].naturalezaInmueble).toBe('Inscrito');
      expect(detalle[0].calidadTitular).toBe('Propietario');
      expect(detalle[0].nis).toBe('NIS-45892');
      expect(detalle[0].medioNotificacionSecundario).toBeNull();
      expect(detalle[0].firma).toContain('data:image/png;base64');

      await queryRunner.query(`DELETE FROM Solicitud WHERE id = @0`, [solId]);
      const detalleEliminado = (await queryRunner.query(
        `SELECT * FROM SolicitudCambioTitular WHERE solicitudId = @0`,
        [solId],
      )) as DetalleRow[];
      expect(detalleEliminado.length).toBe(0);
    } finally {
      await queryRunner.release();
    }
  });

  it('6. Debe rechazar detalle con solicitudId inexistente (FK)', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await expect(
        queryRunner.query(
          `
          INSERT INTO SolicitudCambioTitular (
            solicitudId, nombreSolicitante, identificacionSolicitante, telefono,
            nombrePropietarioRegistral, identificacionPropietario,
            naturalezaInmueble, calidadTitular, nis, facturaANombreDe,
            medioNotificacionPrincipal, createdAt, updatedAt
          ) VALUES (
            @0, @1, @2, @3, @4, @5, @6, @7, @8, @9, @10, GETDATE(), GETDATE()
          )
        `,
          [
            999_999_999,
            'Persona Sin Solicitud',
            '1-0000-0001',
            '8000-0000',
            'Propietario X',
            '1-0000-0002',
            'Inscrito',
            'Propietario',
            'NIS-000',
            'Propietario X',
            'Teléfono',
          ],
        ),
      ).rejects.toThrow();
    } finally {
      await queryRunner.release();
    }
  });

  it('7. Debe probar rollback (down) y re-ejecución (up) de la migración', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    const mig = new CreateSolicitudCambioTitularTable1724686140000();

    try {
      await mig.down(queryRunner);
      expect(await queryRunner.hasTable('SolicitudCambioTitular')).toBe(false);

      await mig.up(queryRunner);
      expect(await queryRunner.hasTable('SolicitudCambioTitular')).toBe(true);

      const table = await queryRunner.getTable('SolicitudCambioTitular');
      expect(
        table?.foreignKeys.some(
          (f) => f.name === 'FK_SolicitudCambioTitular_Solicitud',
        ),
      ).toBe(true);
    } finally {
      await queryRunner.release();
    }
  });
});
