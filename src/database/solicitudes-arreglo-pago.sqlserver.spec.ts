import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { PlazoArregloPago } from '../common/enums/plazo-arreglo-pago.enum';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateSolicitudArregloPagoTable1724686110000 } from './migrations/1724686110000-CreateSolicitudArregloPagoTable';

loadEnv();

type TableCountRow = { total: number };
type ColumnInfo = {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  CHARACTER_MAXIMUM_LENGTH: number | null;
  NUMERIC_PRECISION: number | null;
  NUMERIC_SCALE: number | null;
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

describe('Validación física de tabla SolicitudArregloPago en SQL Server', () => {
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

  it('1. Debe confirmar que la tabla SolicitudArregloPago existe en dbo', async () => {
    const rows = await dataSource.query<TableCountRow[]>(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'SolicitudArregloPago'
    `);
    expect(Number(rows[0]?.total)).toBe(1);
  });

  it('2. Debe validar las columnas, tipos de datos, precisión y longitudes requeridas', async () => {
    const columns = await dataSource.query<ColumnInfo[]>(`
      SELECT
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        NUMERIC_PRECISION,
        NUMERIC_SCALE,
        IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'SolicitudArregloPago'
    `);

    const colMap = new Map<string, ColumnInfo>();
    columns.forEach((c) => colMap.set(c.COLUMN_NAME, c));

    // Validar id (PK)
    const colId = colMap.get('id');
    expect(colId).toBeDefined();
    expect(colId!.DATA_TYPE).toBe('int');
    expect(colId!.IS_NULLABLE).toBe('NO');

    // Validar solicitudId (FK 1:1)
    const colSolId = colMap.get('solicitudId');
    expect(colSolId).toBeDefined();
    expect(colSolId!.DATA_TYPE).toBe('int');
    expect(colSolId!.IS_NULLABLE).toBe('NO');

    // Validar nombre
    const colNombre = colMap.get('nombre');
    expect(colNombre).toBeDefined();
    expect(colNombre!.CHARACTER_MAXIMUM_LENGTH).toBe(150);
    expect(colNombre!.IS_NULLABLE).toBe('NO');

    // Validar cedula
    const colCedula = colMap.get('cedula');
    expect(colCedula).toBeDefined();
    expect(colCedula!.CHARACTER_MAXIMUM_LENGTH).toBe(30);
    expect(colCedula!.IS_NULLABLE).toBe('NO');

    // Validar vecinoDe
    const colVecino = colMap.get('vecinoDe');
    expect(colVecino).toBeDefined();
    expect(colVecino!.CHARACTER_MAXIMUM_LENGTH).toBe(200);
    expect(colVecino!.IS_NULLABLE).toBe('NO');

    // Validar telefono
    const colTel = colMap.get('telefono');
    expect(colTel).toBeDefined();
    expect(colTel!.CHARACTER_MAXIMUM_LENGTH).toBe(30);
    expect(colTel!.IS_NULLABLE).toBe('NO');

    // Validar numeroCuentaServicio
    const colCuenta = colMap.get('numeroCuentaServicio');
    expect(colCuenta).toBeDefined();
    expect(colCuenta!.CHARACTER_MAXIMUM_LENGTH).toBe(50);
    expect(colCuenta!.IS_NULLABLE).toBe('NO');

    // Validar montoPrimaInicial (decimal 12,2)
    const colPrima = colMap.get('montoPrimaInicial');
    expect(colPrima).toBeDefined();
    expect(colPrima!.DATA_TYPE).toBe('decimal');
    expect(colPrima!.NUMERIC_PRECISION).toBe(12);
    expect(colPrima!.NUMERIC_SCALE).toBe(2);
    expect(colPrima!.IS_NULLABLE).toBe('NO');

    // Validar plazoSeleccionado
    const colPlazo = colMap.get('plazoSeleccionado');
    expect(colPlazo).toBeDefined();
    expect(colPlazo!.CHARACTER_MAXIMUM_LENGTH).toBe(50);
    expect(colPlazo!.IS_NULLABLE).toBe('NO');

    // Validar firma (nvarchar(max))
    const colFirma = colMap.get('firma');
    expect(colFirma).toBeDefined();
    expect(colFirma!.CHARACTER_MAXIMUM_LENGTH).toBe(-1); // -1 representa MAX en SQL Server
    expect(colFirma!.IS_NULLABLE).toBe('YES');
  });

  it('3. Debe validar la llave foránea entre SolicitudArregloPago y Solicitud con borrado en cascada', async () => {
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
      WHERE tp.name = 'SolicitudArregloPago'
    `);

    const fk = fks.find((f) => f.COLUMN_NAME === 'solicitudId');
    expect(fk).toBeDefined();
    expect(fk!.REF_TABLE).toBe('Solicitud');
    expect(fk!.REF_COLUMN).toBe('id');
    expect(fk!.ON_DELETE).toBe('CASCADE');
  });

  it('4. Debe validar la restricción única 1:1 en solicitudId y los índices secundarios', async () => {
    const indices = await dataSource.query<IndexInfo[]>(`
      SELECT
        i.name AS INDEX_NAME,
        c.name AS COLUMN_NAME,
        i.is_unique AS IS_UNIQUE
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      INNER JOIN sys.tables t ON i.object_id = t.object_id
      WHERE t.name = 'SolicitudArregloPago'
    `);

    // UQ_SolicitudArregloPago_solicitudId (Unicidad para relación 1 a 1)
    const uniqueSol = indices.find(
      (idx) => idx.COLUMN_NAME === 'solicitudId' && idx.IS_UNIQUE === true,
    );
    expect(uniqueSol).toBeDefined();

    // IX_SolicitudArregloPago_cedula
    const ixCedula = indices.find(
      (idx) =>
        idx.COLUMN_NAME === 'cedula' && idx.INDEX_NAME.includes('cedula'),
    );
    expect(ixCedula).toBeDefined();

    // IX_SolicitudArregloPago_numeroCuentaServicio
    const ixCuenta = indices.find(
      (idx) =>
        idx.COLUMN_NAME === 'numeroCuentaServicio' &&
        idx.INDEX_NAME.includes('numeroCuentaServicio'),
    );
    expect(ixCuenta).toBeDefined();
  });

  it('5. Debe permitir inserción completa vinculada a una Solicitud y borrado en cascada', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      // 1. Insertar una Solicitud de prueba
      const insertSol = await queryRunner.query(`
        INSERT INTO Solicitud (tipoSolicitudId, codigoSeguimiento, estado, fechaIngreso, createdAt, updatedAt)
        OUTPUT INSERTED.id
        VALUES (1, 'SOL-TEST-ARREGLO-01', 'PENDIENTE', GETDATE(), GETDATE(), GETDATE())
      `);
      const solId = insertSol[0].id;

      // 2. Insertar el detalle en SolicitudArregloPago
      await queryRunner.query(
        `
        INSERT INTO SolicitudArregloPago (
          solicitudId, nombre, cedula, vecinoDe, telefono, numeroCuentaServicio,
          montoPrimaInicial, plazoSeleccionado, firma, createdAt, updatedAt
        ) VALUES (
          @0, @1, @2, @3, @4, @5, @6, @7, @8, GETDATE(), GETDATE()
        )
      `,
        [
          solId,
          'María Elena Rojas Solís',
          '2-0456-0789',
          'San Juan, 150m este del tanque de agua',
          '8765-4321',
          'CTA-88772',
          45000.5,
          PlazoArregloPago.MESES_12,
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...',
        ],
      );

      // 3. Consultar y verificar tipos y montos
      const detalle = await queryRunner.query(
        `SELECT * FROM SolicitudArregloPago WHERE solicitudId = @0`,
        [solId],
      );
      expect(detalle.length).toBe(1);
      expect(detalle[0].nombre).toBe('María Elena Rojas Solís');
      expect(detalle[0].cedula).toBe('2-0456-0789');
      expect(Number(detalle[0].montoPrimaInicial)).toBeCloseTo(45000.5, 2);
      expect(detalle[0].plazoSeleccionado).toBe(PlazoArregloPago.MESES_12);

      // 4. Probar borrado en cascada: al borrar la Solicitud padre, el detalle debe eliminarse
      await queryRunner.query(`DELETE FROM Solicitud WHERE id = @0`, [solId]);
      const detalleEliminado = await queryRunner.query(
        `SELECT * FROM SolicitudArregloPago WHERE solicitudId = @0`,
        [solId],
      );
      expect(detalleEliminado.length).toBe(0);
    } finally {
      await queryRunner.release();
    }
  });

  it('6. Debe probar rollback (down) y re-ejecución (up) de la migración', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    const mig = new CreateSolicitudArregloPagoTable1724686110000();

    try {
      // Down: debe eliminar la tabla
      await mig.down(queryRunner);
      expect(await queryRunner.hasTable('SolicitudArregloPago')).toBe(false);

      // Up: debe recrear la tabla con su FK
      await mig.up(queryRunner);
      expect(await queryRunner.hasTable('SolicitudArregloPago')).toBe(true);

      const table = await queryRunner.getTable('SolicitudArregloPago');
      expect(
        table?.foreignKeys.some(
          (f) => f.name === 'FK_SolicitudArregloPago_Solicitud',
        ),
      ).toBe(true);
    } finally {
      await queryRunner.release();
    }
  });
});
