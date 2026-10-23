import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateSolicitudAfiliacionTable1724686160000 } from './migrations/1724686160000-CreateSolicitudAfiliacionTable';

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
type InsertedIdRow = { id: number };

describe('Validación física de tabla SolicitudAfiliacion en SQL Server', () => {
  jest.setTimeout(60_000);
  let dataSource: DataSource;
  let tipoAfiliacionId: number;

  beforeAll(async () => {
    const options = buildMigrationDataSourceOptions();
    dataSource = new DataSource(options);
    await dataSource.initialize();
    await dataSource.runMigrations();

    const tipos = await dataSource.query<{ id: number }[]>(
      `SELECT TOP 1 id FROM TipoSolicitud WHERE slug = 'afiliacion'`,
    );
    tipoAfiliacionId = Number(tipos[0]?.id);
    expect(tipoAfiliacionId).toBeGreaterThan(0);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('1. Debe confirmar que la tabla SolicitudAfiliacion existe en dbo', async () => {
    const rows = await dataSource.query<TableCountRow[]>(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'SolicitudAfiliacion'
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
        AND TABLE_NAME = 'SolicitudAfiliacion'
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
    expect(colMap.get('solicitudId')?.DATA_TYPE).toBe('int');
    expect(colMap.get('solicitudId')?.IS_NULLABLE).toBe('NO');
    expect(colMap.get('fechaSolicitud')?.DATA_TYPE).toBe('date');
    expect(colMap.get('fechaSolicitud')?.IS_NULLABLE).toBe('NO');

    requiredVarchar('nombre', 150, 'NO');
    requiredVarchar('identificacion', 30, 'NO');
    requiredVarchar('vecinoDe', 200, 'NO');
    requiredVarchar('estadoCivil', 40, 'NO');
    requiredVarchar('telefono', 30, 'NO');
    requiredVarchar('correoElectronico', 150, 'NO');
    requiredVarchar('numeroAbonado', 50, 'NO');
    requiredVarchar('numeroPlano', 50, 'NO');
    requiredVarchar('folioReal', 50, 'YES');
    requiredVarchar('recomendacion1Nombre', 150, 'NO');
    requiredVarchar('recomendacion1Identificacion', 30, 'NO');
    requiredVarchar('recomendacion1NumeroAbonado', 50, 'NO');
    requiredVarchar('recomendacion2Nombre', 150, 'NO');
    requiredVarchar('recomendacion2Identificacion', 30, 'NO');
    requiredVarchar('recomendacion2NumeroAbonado', 50, 'NO');

    for (const firmaCol of [
      'firmaSolicitante',
      'recomendacion1Firma',
      'recomendacion2Firma',
    ]) {
      const firma = colMap.get(firmaCol);
      expect(firma).toBeDefined();
      expect(firma!.CHARACTER_MAXIMUM_LENGTH).toBe(-1);
      expect(firma!.IS_NULLABLE).toBe('YES');
    }

    expect(colMap.has('juntaDirectivaFechaSesion')).toBe(false);
    expect(colMap.has('numeroAcuerdo')).toBe(false);
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
      WHERE tp.name = 'SolicitudAfiliacion'
    `);

    const fk = fks.find((f) => f.COLUMN_NAME === 'solicitudId');
    expect(fk).toBeDefined();
    expect(fk!.FK_NAME).toBe('FK_SolicitudAfiliacion_Solicitud');
    expect(fk!.REF_TABLE).toBe('Solicitud');
    expect(fk!.REF_COLUMN).toBe('id');
    expect(fk!.ON_DELETE).toBe('CASCADE');
  });

  it('4. Debe validar UNIQUE 1:1 e índices de consulta', async () => {
    const indices = await dataSource.query<IndexInfo[]>(`
      SELECT
        i.name AS INDEX_NAME,
        c.name AS COLUMN_NAME,
        i.is_unique AS IS_UNIQUE
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      INNER JOIN sys.tables t ON i.object_id = t.object_id
      WHERE t.name = 'SolicitudAfiliacion'
    `);

    expect(
      indices.find(
        (idx) => idx.COLUMN_NAME === 'solicitudId' && idx.IS_UNIQUE === true,
      ),
    ).toBeDefined();
    expect(
      indices.find((idx) => idx.COLUMN_NAME === 'identificacion'),
    ).toBeDefined();
    expect(
      indices.find((idx) => idx.COLUMN_NAME === 'numeroAbonado'),
    ).toBeDefined();
  });

  it('5. Debe persistir Solicitud + detalle con ambas recomendaciones y firmas', async () => {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    try {
      const insertSol = (await qr.query(
        `
        INSERT INTO Solicitud (tipoSolicitudId, codigoSeguimiento, estado, fechaIngreso, createdAt, updatedAt)
        OUTPUT INSERTED.id
        VALUES (@0, 'SOL-TEST-AFI-001', 'PENDIENTE', GETDATE(), GETDATE(), GETDATE())
      `,
        [tipoAfiliacionId],
      )) as InsertedIdRow[];
      const solId = insertSol[0].id;

      await qr.query(
        `
        INSERT INTO SolicitudAfiliacion (
          solicitudId, fechaSolicitud, nombre, identificacion, vecinoDe, estadoCivil,
          telefono, correoElectronico, numeroAbonado, numeroPlano, folioReal, firmaSolicitante,
          recomendacion1Nombre, recomendacion1Identificacion, recomendacion1NumeroAbonado, recomendacion1Firma,
          recomendacion2Nombre, recomendacion2Identificacion, recomendacion2NumeroAbonado, recomendacion2Firma,
          createdAt, updatedAt
        ) VALUES (
          @0, @1, @2, @3, @4, @5, @6, @7, @8, @9, @10, @11,
          @12, @13, @14, @15, @16, @17, @18, @19,
          GETDATE(), GETDATE()
        )
      `,
        [
          solId,
          '2026-10-23',
          'María Elena Rodríguez Vargas',
          '01-0234-0567',
          'San Juan, 200 m norte de la plaza',
          'Casado(a)',
          '8888-1234',
          'maria@ejemplo.com',
          '0045892',
          'SJ-1234567-2020',
          '123456-000',
          'data:image/png;base64,solicitante',
          'Carlos Alberto Mora Chaves',
          '1-0987-6543',
          '12045',
          'data:image/png;base64,rec1',
          'Ana Lucía Vargas Quirós',
          '1-2345-6789',
          '13088',
          'data:image/png;base64,rec2',
        ],
      );

      const rows = (await qr.query(
        `SELECT * FROM SolicitudAfiliacion WHERE solicitudId = @0`,
        [solId],
      )) as Record<string, unknown>[];

      expect(rows.length).toBe(1);
      expect(Number(rows[0].solicitudId)).toBe(Number(solId));
      expect(rows[0].nombre).toBe('María Elena Rodríguez Vargas');
      expect(rows[0].identificacion).toBe('01-0234-0567');
      expect(rows[0].numeroAbonado).toBe('0045892');
      expect(rows[0].numeroPlano).toBe('SJ-1234567-2020');
      expect(rows[0].folioReal).toBe('123456-000');
      expect(String(rows[0].firmaSolicitante)).toContain('solicitante');
      expect(rows[0].recomendacion1Nombre).toBe('Carlos Alberto Mora Chaves');
      expect(rows[0].recomendacion1NumeroAbonado).toBe('12045');
      expect(rows[0].recomendacion2Nombre).toBe('Ana Lucía Vargas Quirós');
      expect(rows[0].recomendacion2NumeroAbonado).toBe('13088');
      expect(String(rows[0].recomendacion1Firma)).toContain('rec1');
      expect(String(rows[0].recomendacion2Firma)).toContain('rec2');

      await qr.query(`DELETE FROM Solicitud WHERE id = @0`, [solId]);
      const after = (await qr.query(
        `SELECT * FROM SolicitudAfiliacion WHERE solicitudId = @0`,
        [solId],
      )) as unknown[];
      expect(after.length).toBe(0);
    } finally {
      await qr.release();
    }
  });

  it('6. Debe permitir creación pública sin firmas (nullable) y folio nulo', async () => {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    try {
      const insertSol = (await qr.query(
        `
        INSERT INTO Solicitud (tipoSolicitudId, codigoSeguimiento, estado, fechaIngreso, createdAt, updatedAt)
        OUTPUT INSERTED.id
        VALUES (@0, 'SOL-TEST-AFI-002', 'PENDIENTE', GETDATE(), GETDATE(), GETDATE())
      `,
        [tipoAfiliacionId],
      )) as InsertedIdRow[];
      const solId = insertSol[0].id;

      await qr.query(
        `
        INSERT INTO SolicitudAfiliacion (
          solicitudId, fechaSolicitud, nombre, identificacion, vecinoDe, estadoCivil,
          telefono, correoElectronico, numeroAbonado, numeroPlano, folioReal, firmaSolicitante,
          recomendacion1Nombre, recomendacion1Identificacion, recomendacion1NumeroAbonado, recomendacion1Firma,
          recomendacion2Nombre, recomendacion2Identificacion, recomendacion2NumeroAbonado, recomendacion2Firma,
          createdAt, updatedAt
        ) VALUES (
          @0, @1, @2, @3, @4, @5, @6, @7, @8, @9, NULL, NULL,
          @10, @11, @12, NULL, @13, @14, @15, NULL,
          GETDATE(), GETDATE()
        )
      `,
        [
          solId,
          '2026-10-20',
          'Luis Mora',
          '1-1111-2222',
          'San Juan',
          'Soltero(a)',
          '8777-0000',
          'luis@ejemplo.com',
          '99901',
          'PZ-1',
          'Rec Uno',
          '1-0001-0001',
          '10001',
          'Rec Dos',
          '1-0002-0002',
          '10002',
        ],
      );

      const rows = (await qr.query(
        `SELECT folioReal, firmaSolicitante, recomendacion1Firma, recomendacion2Firma
         FROM SolicitudAfiliacion WHERE solicitudId = @0`,
        [solId],
      )) as Record<string, unknown>[];
      expect(rows[0].folioReal).toBeNull();
      expect(rows[0].firmaSolicitante).toBeNull();
      expect(rows[0].recomendacion1Firma).toBeNull();
      expect(rows[0].recomendacion2Firma).toBeNull();

      await qr.query(`DELETE FROM Solicitud WHERE id = @0`, [solId]);
    } finally {
      await qr.release();
    }
  });

  it('7. Debe rechazar detalle con solicitudId inexistente (FK)', async () => {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    try {
      await expect(
        qr.query(
          `
          INSERT INTO SolicitudAfiliacion (
            solicitudId, fechaSolicitud, nombre, identificacion, vecinoDe, estadoCivil,
            telefono, correoElectronico, numeroAbonado, numeroPlano,
            recomendacion1Nombre, recomendacion1Identificacion, recomendacion1NumeroAbonado,
            recomendacion2Nombre, recomendacion2Identificacion, recomendacion2NumeroAbonado,
            createdAt, updatedAt
          ) VALUES (
            999999999, '2026-10-23', 'X', '1-1', 'Y', 'Z', '8', 'a@b.c', '1', 'P',
            'R1', '1-2', '2', 'R2', '1-3', '3', GETDATE(), GETDATE()
          )
        `,
        ),
      ).rejects.toThrow();
    } finally {
      await qr.release();
    }
  });

  it('8. Migration down/up debe recrear la tabla (entorno de prueba)', async () => {
    const migration = new CreateSolicitudAfiliacionTable1724686160000();
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    try {
      await migration.down(qr);
      const afterDown = await dataSource.query<TableCountRow[]>(`
        SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'SolicitudAfiliacion'
      `);
      expect(Number(afterDown[0]?.total)).toBe(0);

      await migration.up(qr);
      const afterUp = await dataSource.query<TableCountRow[]>(`
        SELECT COUNT(*) AS total FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'SolicitudAfiliacion'
      `);
      expect(Number(afterUp[0]?.total)).toBe(1);
    } finally {
      await qr.release();
    }
  });
});
