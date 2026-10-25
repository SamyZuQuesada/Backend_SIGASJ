import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { MotivoConstanciaServicio } from '../common/enums/motivo-constancia-servicio.enum';

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

describe('Validación física de tabla SolicitudConstanciaServicio en SQL Server', () => {
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

  it('1. Debe confirmar que la tabla SolicitudConstanciaServicio existe en dbo', async () => {
    const rows = await dataSource.query<TableCountRow[]>(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'SolicitudConstanciaServicio'
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
        AND TABLE_NAME = 'SolicitudConstanciaServicio'
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

    requiredVarchar('tipoServicio', 100, 'NO');
    requiredVarchar('nis', 50, 'NO');
    requiredVarchar('propietarioInmueble', 150, 'NO');
    requiredVarchar('nombreSolicitante', 150, 'NO');
    requiredVarchar('identificacionSolicitante', 30, 'NO');
    requiredVarchar('correoElectronico', 150, 'NO');
    requiredVarchar('telefono', 30, 'NO');

    requiredVarchar('folioReal', 50, 'YES');
    requiredVarchar('planoCatastrado', 50, 'YES');
    requiredVarchar('planoAgrimensura', 50, 'YES');
    requiredVarchar('naturalezaInmueble', 80, 'NO');
    requiredVarchar('calidadTitular', 80, 'NO');

    requiredVarchar('provincia', 80, 'NO');
    requiredVarchar('canton', 80, 'NO');
    requiredVarchar('distrito', 80, 'NO');
    requiredVarchar('direccionExacta', 500, 'NO');

    requiredVarchar('motivo', 150, 'NO');
    requiredVarchar('otroMotivo', 255, 'YES');
    requiredVarchar('tramitePorRealizar', 255, 'YES');

    requiredVarchar('medioNotificacionPrincipal', 80, 'NO');
    requiredVarchar('medioNotificacionSecundario', 80, 'YES');

    const firma = colMap.get('firma');
    expect(firma).toBeDefined();
    expect(firma!.CHARACTER_MAXIMUM_LENGTH).toBe(-1);
    expect(firma!.IS_NULLABLE).toBe('YES');

    expect(colMap.get('createdAt')).toBeDefined();
    expect(colMap.get('updatedAt')).toBeDefined();
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
      WHERE tp.name = 'SolicitudConstanciaServicio'
    `);

    const fk = fks.find((f) => f.COLUMN_NAME === 'solicitudId');
    expect(fk).toBeDefined();
    expect(fk!.REF_TABLE).toBe('Solicitud');
    expect(fk!.REF_COLUMN).toBe('id');
    expect(fk!.ON_DELETE).toBe('CASCADE');
  });

  it('4. Debe validar UNIQUE 1:1 en solicitudId e índices', async () => {
    const indices = await dataSource.query<IndexInfo[]>(`
      SELECT
        i.name AS INDEX_NAME,
        c.name AS COLUMN_NAME,
        i.is_unique AS IS_UNIQUE
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      INNER JOIN sys.tables t ON i.object_id = t.object_id
      WHERE t.name = 'SolicitudConstanciaServicio'
    `);

    expect(
      indices.find(
        (idx) => idx.COLUMN_NAME === 'solicitudId' && idx.IS_UNIQUE === true,
      ),
    ).toBeDefined();
    expect(
      indices.find((idx) => idx.INDEX_NAME.includes('_nis')),
    ).toBeDefined();
    expect(
      indices.find((idx) =>
        idx.INDEX_NAME.includes('_identificacionSolicitante'),
      ),
    ).toBeDefined();
    expect(
      indices.find((idx) => idx.INDEX_NAME.includes('_motivo')),
    ).toBeDefined();
  });

  it('5. Debe persistir y borrar en cascada con Solicitud', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    type InsertedIdRow = { id: number };

    try {
      const insertSol = (await queryRunner.query(`
        INSERT INTO Solicitud (tipoSolicitudId, codigoSeguimiento, estado, fechaIngreso, createdAt, updatedAt)
        OUTPUT INSERTED.id
        VALUES (6, 'SOL-TEST-CONSTANCIA-CASCADE', 'PENDIENTE', GETDATE(), GETDATE(), GETDATE())
      `)) as InsertedIdRow[];
      const solId = insertSol[0].id;

      await queryRunner.query(
        `
        INSERT INTO SolicitudConstanciaServicio (
          solicitudId, tipoServicio, nis, propietarioInmueble,
          nombreSolicitante, identificacionSolicitante, correoElectronico, telefono,
          folioReal, planoCatastrado, planoAgrimensura, naturalezaInmueble, calidadTitular,
          provincia, canton, distrito, direccionExacta,
          motivo, otroMotivo, tramitePorRealizar,
          medioNotificacionPrincipal, medioNotificacionSecundario, firma,
          createdAt, updatedAt
        ) VALUES (
          @0, @1, @2, @3, @4, @5, @6, @7, @8, @9, @10, @11, @12, @13, @14, @15,
          @16, @17, @18, @19, @20, @21, @22, GETDATE(), GETDATE()
        )
      `,
        [
          solId,
          'Domiciliar',
          'NIS-99887',
          'Propietario Test',
          'Solicitante Test',
          '1-1111-2222',
          'test@ejemplo.com',
          '8888-0000',
          '778899-000',
          'SJ-9999-2026',
          null,
          'Inscrito',
          'Propietario',
          'San José',
          'Pérez Zeledón',
          'San Isidro',
          '200m sur del parque',
          MotivoConstanciaServicio.BONO_VIVIENDA,
          null,
          'Trámite BANHVI',
          'Correo electrónico',
          null,
          'data:image/png;base64,sample',
        ],
      );

      const rowsAfterInsert = await queryRunner.query<TableCountRow[]>(`
        SELECT COUNT(*) AS total
        FROM SolicitudConstanciaServicio
        WHERE solicitudId = ${solId}
      `);
      expect(Number(rowsAfterInsert[0].total)).toBe(1);

      // Eliminar cabecera Solicitud debe borrar en cascada el detalle
      await queryRunner.query(`
        DELETE FROM Solicitud WHERE id = ${solId}
      `);

      const rowsAfterDelete = await queryRunner.query<TableCountRow[]>(`
        SELECT COUNT(*) AS total
        FROM SolicitudConstanciaServicio
        WHERE solicitudId = ${solId}
      `);
      expect(Number(rowsAfterDelete[0].total)).toBe(0);
    } finally {
      await queryRunner.release();
    }
  });
});
