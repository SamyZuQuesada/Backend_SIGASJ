import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateSolicitudInfraestructuraLinderosTable1724686150000 } from './migrations/1724686150000-CreateSolicitudInfraestructuraLinderosTable';

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

describe('Validación física de tabla SolicitudInfraestructuraLinderos en SQL Server', () => {
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

  it('1. Debe confirmar que la tabla SolicitudInfraestructuraLinderos existe en dbo', async () => {
    const rows = await dataSource.query<TableCountRow[]>(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'SolicitudInfraestructuraLinderos'
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
        AND TABLE_NAME = 'SolicitudInfraestructuraLinderos'
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

    requiredVarchar('nis', 50, 'NO');
    requiredVarchar('tipoPersona', 40, 'NO');
    requiredVarchar('nombreFisica', 100, 'YES');
    requiredVarchar('apellidosFisica', 100, 'YES');
    requiredVarchar('identificacionFisica', 30, 'YES');
    requiredVarchar('telefonoFisica', 30, 'YES');
    requiredVarchar('razonSocial', 200, 'YES');
    requiredVarchar('cedulaJuridica', 30, 'YES');
    requiredVarchar('nombreRepresentante', 150, 'YES');
    requiredVarchar('identificacionRepresentante', 30, 'YES');
    requiredVarchar('telefonoRepresentante', 30, 'YES');
    requiredVarchar('calidadTitular', 80, 'NO');
    requiredVarchar('provincia', 80, 'NO');
    requiredVarchar('canton', 80, 'NO');
    requiredVarchar('distrito', 80, 'NO');
    requiredVarchar('direccionExacta', 500, 'NO');
    requiredVarchar('folioReal', 50, 'YES');
    requiredVarchar('planoCatastrado', 50, 'YES');
    requiredVarchar('planoAgrimensura', 50, 'YES');
    requiredVarchar('proposito', 120, 'NO');
    requiredVarchar('medioNotificacionPrincipal', 80, 'NO');
    requiredVarchar('valorNotificacionPrincipal', 200, 'YES');
    requiredVarchar('medioNotificacionSecundario', 80, 'YES');
    requiredVarchar('valorNotificacionSecundario', 200, 'YES');

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
      WHERE tp.name = 'SolicitudInfraestructuraLinderos'
    `);

    const fk = fks.find((f) => f.COLUMN_NAME === 'solicitudId');
    expect(fk).toBeDefined();
    expect(fk!.REF_TABLE).toBe('Solicitud');
    expect(fk!.REF_COLUMN).toBe('id');
    expect(fk!.ON_DELETE).toBe('CASCADE');
  });

  it('4. Debe validar UNIQUE 1:1 en solicitudId e índice NIS', async () => {
    const indices = await dataSource.query<IndexInfo[]>(`
      SELECT
        i.name AS INDEX_NAME,
        c.name AS COLUMN_NAME,
        i.is_unique AS IS_UNIQUE
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      INNER JOIN sys.tables t ON i.object_id = t.object_id
      WHERE t.name = 'SolicitudInfraestructuraLinderos'
    `);

    expect(
      indices.find(
        (idx) => idx.COLUMN_NAME === 'solicitudId' && idx.IS_UNIQUE === true,
      ),
    ).toBeDefined();
    expect(
      indices.find((idx) => idx.INDEX_NAME.includes('_nis')),
    ).toBeDefined();
  });

  it('5. Debe persistir persona física y borrar en cascada', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    type InsertedIdRow = { id: number };
    type DetalleRow = {
      nis: string;
      tipoPersona: string;
      nombreFisica: string | null;
      razonSocial: string | null;
      proposito: string;
      provincia: string;
      planoAgrimensura: string | null;
      medioNotificacionSecundario: string | null;
      firma: string | null;
    };

    try {
      const insertSol = (await queryRunner.query(`
        INSERT INTO Solicitud (tipoSolicitudId, codigoSeguimiento, estado, fechaIngreso, createdAt, updatedAt)
        OUTPUT INSERTED.id
        VALUES (3, 'SOL-TEST-INFR-PF', 'PENDIENTE', GETDATE(), GETDATE(), GETDATE())
      `)) as InsertedIdRow[];
      const solId = insertSol[0].id;

      await queryRunner.query(
        `
        INSERT INTO SolicitudInfraestructuraLinderos (
          solicitudId, nis, tipoPersona,
          nombreFisica, apellidosFisica, identificacionFisica, telefonoFisica,
          calidadTitular, provincia, canton, distrito, direccionExacta,
          folioReal, planoCatastrado, planoAgrimensura, proposito,
          medioNotificacionPrincipal, valorNotificacionPrincipal,
          medioNotificacionSecundario, valorNotificacionSecundario, firma,
          createdAt, updatedAt
        ) VALUES (
          @0, @1, @2, @3, @4, @5, @6, @7, @8, @9, @10, @11, @12, @13, @14, @15,
          @16, @17, @18, @19, @20, GETDATE(), GETDATE()
        )
      `,
        [
          solId,
          'NIS-77881',
          'Persona física',
          'María Elena',
          'Rodríguez Vargas',
          '1-1234-0567',
          '8888-1234',
          'Propietario',
          'San José',
          'Pérez Zeledón',
          'San Isidro de El General',
          '100 m norte de la iglesia',
          '123456-000',
          'SJ-1234567-2020',
          'AG-998877-2019',
          'Reunión de fincas',
          'Correo electrónico',
          'maria@ejemplo.com',
          null,
          null,
          'data:image/png;base64,abc',
        ],
      );

      const detalle = (await queryRunner.query(
        `SELECT * FROM SolicitudInfraestructuraLinderos WHERE solicitudId = @0`,
        [solId],
      )) as DetalleRow[];
      expect(detalle.length).toBe(1);
      expect(detalle[0].nis).toBe('NIS-77881');
      expect(detalle[0].tipoPersona).toBe('Persona física');
      expect(detalle[0].nombreFisica).toBe('María Elena');
      expect(detalle[0].razonSocial).toBeNull();
      expect(detalle[0].proposito).toBe('Reunión de fincas');
      expect(detalle[0].provincia).toBe('San José');
      expect(detalle[0].planoAgrimensura).toBe('AG-998877-2019');
      expect(detalle[0].medioNotificacionSecundario).toBeNull();
      expect(detalle[0].firma).toContain('data:image/png;base64');

      await queryRunner.query(`DELETE FROM Solicitud WHERE id = @0`, [solId]);
      const detalleEliminado = (await queryRunner.query(
        `SELECT * FROM SolicitudInfraestructuraLinderos WHERE solicitudId = @0`,
        [solId],
      )) as DetalleRow[];
      expect(detalleEliminado.length).toBe(0);
    } finally {
      await queryRunner.release();
    }
  });

  it('6. Debe persistir persona jurídica', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    type InsertedIdRow = { id: number };
    type DetalleRow = {
      tipoPersona: string;
      razonSocial: string | null;
      cedulaJuridica: string | null;
      nombreRepresentante: string | null;
      nombreFisica: string | null;
    };

    try {
      const insertSol = (await queryRunner.query(`
        INSERT INTO Solicitud (tipoSolicitudId, codigoSeguimiento, estado, fechaIngreso, createdAt, updatedAt)
        OUTPUT INSERTED.id
        VALUES (3, 'SOL-TEST-INFR-PJ', 'PENDIENTE', GETDATE(), GETDATE(), GETDATE())
      `)) as InsertedIdRow[];
      const solId = insertSol[0].id;

      await queryRunner.query(
        `
        INSERT INTO SolicitudInfraestructuraLinderos (
          solicitudId, nis, tipoPersona,
          razonSocial, cedulaJuridica, nombreRepresentante,
          identificacionRepresentante, telefonoRepresentante,
          calidadTitular, provincia, canton, distrito, direccionExacta,
          proposito, medioNotificacionPrincipal, createdAt, updatedAt
        ) VALUES (
          @0, @1, @2, @3, @4, @5, @6, @7, @8, @9, @10, @11, @12, @13, @14,
          GETDATE(), GETDATE()
        )
      `,
        [
          solId,
          'NIS-99001',
          'Persona jurídica',
          'Inversiones del Valle S.A.',
          '3-101-123456',
          'Luis Alberto Mora Chaves',
          '1-0987-6543',
          '8777-4321',
          'Representante legal',
          'San José',
          'Pérez Zeledón',
          'Daniel Flores',
          'Frente a la escuela',
          'Reunión de fincas',
          'Teléfono',
        ],
      );

      const detalle = (await queryRunner.query(
        `SELECT * FROM SolicitudInfraestructuraLinderos WHERE solicitudId = @0`,
        [solId],
      )) as DetalleRow[];
      expect(detalle[0].tipoPersona).toBe('Persona jurídica');
      expect(detalle[0].razonSocial).toBe('Inversiones del Valle S.A.');
      expect(detalle[0].cedulaJuridica).toBe('3-101-123456');
      expect(detalle[0].nombreRepresentante).toBe('Luis Alberto Mora Chaves');
      expect(detalle[0].nombreFisica).toBeNull();

      await queryRunner.query(`DELETE FROM Solicitud WHERE id = @0`, [solId]);
    } finally {
      await queryRunner.release();
    }
  });

  it('7. Debe rechazar detalle con solicitudId inexistente (FK)', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await expect(
        queryRunner.query(
          `
          INSERT INTO SolicitudInfraestructuraLinderos (
            solicitudId, nis, tipoPersona, calidadTitular,
            provincia, canton, distrito, direccionExacta,
            proposito, medioNotificacionPrincipal, createdAt, updatedAt
          ) VALUES (
            @0, @1, @2, @3, @4, @5, @6, @7, @8, @9, GETDATE(), GETDATE()
          )
        `,
          [
            999_999_999,
            'NIS-000',
            'Persona física',
            'Propietario',
            'San José',
            'Pérez Zeledón',
            'San Isidro',
            'Sin dirección',
            'Reunión de fincas',
            'Teléfono',
          ],
        ),
      ).rejects.toThrow();
    } finally {
      await queryRunner.release();
    }
  });

  it('8. Debe probar rollback (down) y re-ejecución (up) de la migración', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    const mig = new CreateSolicitudInfraestructuraLinderosTable1724686150000();

    try {
      await mig.down(queryRunner);
      expect(
        await queryRunner.hasTable('SolicitudInfraestructuraLinderos'),
      ).toBe(false);

      await mig.up(queryRunner);
      expect(
        await queryRunner.hasTable('SolicitudInfraestructuraLinderos'),
      ).toBe(true);

      const table = await queryRunner.getTable(
        'SolicitudInfraestructuraLinderos',
      );
      expect(
        table?.foreignKeys.some(
          (f) => f.name === 'FK_SolicitudInfraestructuraLinderos_Solicitud',
        ),
      ).toBe(true);
    } finally {
      await queryRunner.release();
    }
  });
});
