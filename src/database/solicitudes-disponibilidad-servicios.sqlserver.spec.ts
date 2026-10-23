import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateSolicitudDisponibilidadServiciosTable1724686180000 } from './migrations/1724686180000-CreateSolicitudDisponibilidadServiciosTable';

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
type InsertedIdRow = { id: number };

describe('Validación física de tabla SolicitudDisponibilidadServicios en SQL Server', () => {
  jest.setTimeout(60_000);
  let dataSource: DataSource;
  let tipoDisponibilidadId: number;

  beforeAll(async () => {
    const options = buildMigrationDataSourceOptions();
    dataSource = new DataSource(options);
    await dataSource.initialize();
    await dataSource.runMigrations();

    const tipos = await dataSource.query<{ id: number }[]>(
      `SELECT TOP 1 id FROM TipoSolicitud WHERE slug = 'disponibilidad-servicios'`,
    );
    tipoDisponibilidadId = Number(tipos[0]?.id);
    expect(tipoDisponibilidadId).toBeGreaterThan(0);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('1. Debe confirmar que la tabla SolicitudDisponibilidadServicios existe en dbo', async () => {
    const rows = await dataSource.query<TableCountRow[]>(`
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'dbo'
        AND TABLE_NAME = 'SolicitudDisponibilidadServicios'
    `);
    expect(Number(rows[0]?.total)).toBe(1);
  });

  it('2. Debe validar columnas, tipos, longitudes, nullability y decimales', async () => {
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
        AND TABLE_NAME = 'SolicitudDisponibilidadServicios'
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

    requiredVarchar('tipoPersona', 40, 'NO');
    requiredVarchar('nombreFisica', 100, 'YES');
    requiredVarchar('primerApellidoFisica', 100, 'YES');
    requiredVarchar('segundoApellidoFisica', 100, 'YES');
    requiredVarchar('identificacionFisica', 30, 'YES');
    requiredVarchar('telefonoFisica', 30, 'YES');
    requiredVarchar('razonSocial', 200, 'YES');
    requiredVarchar('identificacionJuridica', 30, 'YES');
    requiredVarchar('nombreRepresentante', 150, 'YES');
    requiredVarchar('identificacionRepresentante', 30, 'YES');
    requiredVarchar('telefonoRepresentante', 30, 'YES');
    requiredVarchar('medioNotificacionPrincipal', 80, 'NO');
    requiredVarchar('valorNotificacionPrincipal', 200, 'YES');
    requiredVarchar('medioNotificacionSecundario', 80, 'YES');
    requiredVarchar('valorNotificacionSecundario', 200, 'YES');
    requiredVarchar('provincia', 80, 'NO');
    requiredVarchar('canton', 80, 'NO');
    requiredVarchar('distrito', 80, 'NO');
    requiredVarchar('direccionExacta', 500, 'NO');
    requiredVarchar('folioReal', 50, 'YES');
    requiredVarchar('planoCatastrado', 50, 'YES');
    requiredVarchar('planoAgrimensura', 50, 'YES');
    requiredVarchar('nis', 50, 'YES');
    requiredVarchar('naturalezaInmueble', 80, 'NO');
    requiredVarchar('calidadTitular', 80, 'NO');
    requiredVarchar('proposito', 120, 'NO');
    requiredVarchar('numeroDisponibilidadAnterior', 50, 'YES');
    requiredVarchar('descripcionProyecto', 2000, 'YES');

    expect(colMap.get('cantidadDormitorios')?.DATA_TYPE).toBe('int');
    expect(colMap.get('cantidadDormitorios')?.IS_NULLABLE).toBe('YES');
    expect(colMap.get('unidadesHabitacionales')?.DATA_TYPE).toBe('int');
    expect(colMap.get('unidadesHabitacionales')?.IS_NULLABLE).toBe('YES');
    expect(colMap.get('niveles')?.DATA_TYPE).toBe('int');
    expect(colMap.get('niveles')?.IS_NULLABLE).toBe('YES');

    const area = colMap.get('areaConstruccion');
    expect(area?.DATA_TYPE).toBe('decimal');
    expect(area?.NUMERIC_PRECISION).toBe(12);
    expect(area?.NUMERIC_SCALE).toBe(2);
    expect(area?.IS_NULLABLE).toBe('YES');

    const caudal = colMap.get('caudalRequerido');
    expect(caudal?.DATA_TYPE).toBe('decimal');
    expect(caudal?.NUMERIC_PRECISION).toBe(12);
    expect(caudal?.NUMERIC_SCALE).toBe(4);
    expect(caudal?.IS_NULLABLE).toBe('YES');

    expect(colMap.get('autorizacionInspeccion')?.DATA_TYPE).toBe('bit');
    expect(colMap.get('autorizacionInspeccion')?.IS_NULLABLE).toBe('NO');

    const firma = colMap.get('firma');
    expect(firma).toBeDefined();
    expect(firma!.CHARACTER_MAXIMUM_LENGTH).toBe(-1);
    expect(firma!.IS_NULLABLE).toBe('YES');
  });

  it('3. Debe validar FK hacia Solicitud con ON DELETE CASCADE', async () => {
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
      INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
      INNER JOIN sys.columns cp
        ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
      INNER JOIN sys.columns cr
        ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
      WHERE tp.name = 'SolicitudDisponibilidadServicios'
    `);

    const fk = fks.find(
      (row) => row.FK_NAME === 'FK_SolicitudDisponibilidadServicios_Solicitud',
    );
    expect(fk).toBeDefined();
    expect(fk!.COLUMN_NAME).toBe('solicitudId');
    expect(fk!.REF_TABLE).toBe('Solicitud');
    expect(fk!.REF_COLUMN).toBe('id');
    expect(fk!.ON_DELETE).toBe('CASCADE');
  });

  it('4. Debe validar índices UNIQUE solicitudId e índices de consulta', async () => {
    const indexes = await dataSource.query<IndexInfo[]>(`
      SELECT
        i.name AS INDEX_NAME,
        c.name AS COLUMN_NAME,
        i.is_unique AS IS_UNIQUE
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic
        ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c
        ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      INNER JOIN sys.tables t ON i.object_id = t.object_id
      WHERE t.name = 'SolicitudDisponibilidadServicios'
        AND i.is_primary_key = 0
    `);

    const uq = indexes.find(
      (i) =>
        i.INDEX_NAME === 'UQ_SolicitudDisponibilidadServicios_solicitudId' ||
        (i.COLUMN_NAME === 'solicitudId' && i.IS_UNIQUE),
    );
    expect(uq).toBeDefined();
    expect(uq!.IS_UNIQUE).toBeTruthy();

    const ixNis = indexes.find(
      (i) =>
        i.INDEX_NAME === 'IX_SolicitudDisponibilidadServicios_nis' ||
        i.COLUMN_NAME === 'nis',
    );
    expect(ixNis).toBeDefined();

    const ixProp = indexes.find(
      (i) =>
        i.INDEX_NAME === 'IX_SolicitudDisponibilidadServicios_proposito' ||
        i.COLUMN_NAME === 'proposito',
    );
    expect(ixProp).toBeDefined();
  });

  it('5. Debe persistir persona física con proyecto, decimales y firma', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    type DetalleRow = {
      tipoPersona: string;
      nombreFisica: string | null;
      razonSocial: string | null;
      proposito: string;
      areaConstruccion: number | string | null;
      caudalRequerido: number | string | null;
      cantidadDormitorios: number | null;
      unidadesHabitacionales: number | null;
      niveles: number | null;
      numeroDisponibilidadAnterior: string | null;
      autorizacionInspeccion: boolean | number;
      firma: string | null;
      nis: string | null;
    };

    try {
      const insertSol = (await queryRunner.query(
        `
        INSERT INTO Solicitud (tipoSolicitudId, codigoSeguimiento, estado, fechaIngreso, createdAt, updatedAt)
        OUTPUT INSERTED.id
        VALUES (@0, 'SOL-TEST-DISP-PF', 'PENDIENTE', GETDATE(), GETDATE(), GETDATE())
      `,
        [tipoDisponibilidadId],
      )) as InsertedIdRow[];
      const solId = insertSol[0].id;

      await queryRunner.query(
        `
        INSERT INTO SolicitudDisponibilidadServicios (
          solicitudId, tipoPersona,
          nombreFisica, primerApellidoFisica, segundoApellidoFisica,
          identificacionFisica, telefonoFisica,
          medioNotificacionPrincipal, valorNotificacionPrincipal,
          provincia, canton, distrito, direccionExacta,
          folioReal, planoCatastrado, planoAgrimensura, nis,
          naturalezaInmueble, calidadTitular, proposito,
          numeroDisponibilidadAnterior, descripcionProyecto,
          cantidadDormitorios, unidadesHabitacionales, areaConstruccion,
          niveles, caudalRequerido, autorizacionInspeccion, firma,
          createdAt, updatedAt
        ) VALUES (
          @0, @1, @2, @3, @4, @5, @6, @7, @8, @9, @10, @11, @12, @13, @14, @15,
          @16, @17, @18, @19, @20, @21, @22, @23, @24, @25, @26, @27, @28,
          GETDATE(), GETDATE()
        )
      `,
        [
          solId,
          'Persona física',
          'María Elena',
          'Rodríguez',
          'Vargas',
          '1-1234-0567',
          '8888-1234',
          'Correo electrónico',
          'maria@ejemplo.com',
          'San José',
          'Pérez Zeledón',
          'San Isidro de El General',
          '100 m norte de la iglesia',
          '123456-000',
          'SJ-1234567-2020',
          'AG-998877-2019',
          'NIS-45892',
          'Inscrito',
          'Propietario',
          'Fraccionamiento',
          'DISP-2024-00123',
          'Construcción de 4 unidades habitacionales',
          3,
          4,
          185.5,
          2,
          0.75,
          true,
          'data:image/png;base64,abc',
        ],
      );

      const detalle = (await queryRunner.query(
        `SELECT * FROM SolicitudDisponibilidadServicios WHERE solicitudId = @0`,
        [solId],
      )) as DetalleRow[];

      expect(detalle.length).toBe(1);
      expect(detalle[0].tipoPersona).toBe('Persona física');
      expect(detalle[0].nombreFisica).toBe('María Elena');
      expect(detalle[0].razonSocial).toBeNull();
      expect(detalle[0].proposito).toBe('Fraccionamiento');
      expect(Number(detalle[0].areaConstruccion)).toBeCloseTo(185.5, 2);
      expect(Number(detalle[0].caudalRequerido)).toBeCloseTo(0.75, 4);
      expect(detalle[0].cantidadDormitorios).toBe(3);
      expect(detalle[0].unidadesHabitacionales).toBe(4);
      expect(detalle[0].niveles).toBe(2);
      expect(detalle[0].numeroDisponibilidadAnterior).toBe('DISP-2024-00123');
      expect(Boolean(detalle[0].autorizacionInspeccion)).toBe(true);
      expect(detalle[0].firma).toContain('data:image/png;base64');
      expect(detalle[0].nis).toBe('NIS-45892');

      await queryRunner.query(`DELETE FROM Solicitud WHERE id = @0`, [solId]);
      const detalleEliminado = (await queryRunner.query(
        `SELECT * FROM SolicitudDisponibilidadServicios WHERE solicitudId = @0`,
        [solId],
      )) as DetalleRow[];
      expect(detalleEliminado.length).toBe(0);
    } finally {
      await queryRunner.release();
    }
  });

  it('6. Debe persistir persona jurídica con campos físicos NULL', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    type DetalleRow = {
      tipoPersona: string;
      razonSocial: string | null;
      identificacionJuridica: string | null;
      nombreRepresentante: string | null;
      nombreFisica: string | null;
      primerApellidoFisica: string | null;
    };

    try {
      const insertSol = (await queryRunner.query(
        `
        INSERT INTO Solicitud (tipoSolicitudId, codigoSeguimiento, estado, fechaIngreso, createdAt, updatedAt)
        OUTPUT INSERTED.id
        VALUES (@0, 'SOL-TEST-DISP-PJ', 'PENDIENTE', GETDATE(), GETDATE(), GETDATE())
      `,
        [tipoDisponibilidadId],
      )) as InsertedIdRow[];
      const solId = insertSol[0].id;

      await queryRunner.query(
        `
        INSERT INTO SolicitudDisponibilidadServicios (
          solicitudId, tipoPersona,
          razonSocial, identificacionJuridica, nombreRepresentante,
          identificacionRepresentante, telefonoRepresentante,
          medioNotificacionPrincipal, provincia, canton, distrito, direccionExacta,
          naturalezaInmueble, calidadTitular, proposito, autorizacionInspeccion,
          createdAt, updatedAt
        ) VALUES (
          @0, @1, @2, @3, @4, @5, @6, @7, @8, @9, @10, @11, @12, @13, @14, @15,
          GETDATE(), GETDATE()
        )
      `,
        [
          solId,
          'Persona jurídica',
          'Inversiones del Valle S.A.',
          '3-101-123456',
          'Luis Alberto Mora Chaves',
          '1-0987-6543',
          '8777-4321',
          'Teléfono',
          'San José',
          'Pérez Zeledón',
          'Daniel Flores',
          'Frente a la escuela',
          'Inscrito',
          'Representante legal',
          'Urbanización',
          true,
        ],
      );

      const detalle = (await queryRunner.query(
        `SELECT * FROM SolicitudDisponibilidadServicios WHERE solicitudId = @0`,
        [solId],
      )) as DetalleRow[];
      expect(detalle[0].tipoPersona).toBe('Persona jurídica');
      expect(detalle[0].razonSocial).toBe('Inversiones del Valle S.A.');
      expect(detalle[0].identificacionJuridica).toBe('3-101-123456');
      expect(detalle[0].nombreRepresentante).toBe('Luis Alberto Mora Chaves');
      expect(detalle[0].nombreFisica).toBeNull();
      expect(detalle[0].primerApellidoFisica).toBeNull();

      await queryRunner.query(`DELETE FROM Solicitud WHERE id = @0`, [solId]);
    } finally {
      await queryRunner.release();
    }
  });

  it('7. Debe persistir campos condicionales como NULL (no 0 / N/A)', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    type DetalleRow = {
      nis: string | null;
      numeroDisponibilidadAnterior: string | null;
      descripcionProyecto: string | null;
      cantidadDormitorios: number | null;
      unidadesHabitacionales: number | null;
      areaConstruccion: number | string | null;
      niveles: number | null;
      caudalRequerido: number | string | null;
      folioReal: string | null;
      planoCatastrado: string | null;
      planoAgrimensura: string | null;
      firma: string | null;
    };

    try {
      const insertSol = (await queryRunner.query(
        `
        INSERT INTO Solicitud (tipoSolicitudId, codigoSeguimiento, estado, fechaIngreso, createdAt, updatedAt)
        OUTPUT INSERTED.id
        VALUES (@0, 'SOL-TEST-DISP-NULL', 'PENDIENTE', GETDATE(), GETDATE(), GETDATE())
      `,
        [tipoDisponibilidadId],
      )) as InsertedIdRow[];
      const solId = insertSol[0].id;

      await queryRunner.query(
        `
        INSERT INTO SolicitudDisponibilidadServicios (
          solicitudId, tipoPersona,
          nombreFisica, primerApellidoFisica, identificacionFisica, telefonoFisica,
          medioNotificacionPrincipal, provincia, canton, distrito, direccionExacta,
          naturalezaInmueble, calidadTitular, proposito, autorizacionInspeccion,
          createdAt, updatedAt
        ) VALUES (
          @0, @1, @2, @3, @4, @5, @6, @7, @8, @9, @10, @11, @12, @13, @14,
          GETDATE(), GETDATE()
        )
      `,
        [
          solId,
          'Persona física',
          'Ana',
          'Mora',
          '1-1111-2222',
          '8000-1111',
          'Correo electrónico',
          'San José',
          'Pérez Zeledón',
          'San Isidro',
          'Calle principal',
          'Sin inscribir',
          'Poseedor',
          'Propiedades en derechos',
          false,
        ],
      );

      const detalle = (await queryRunner.query(
        `SELECT * FROM SolicitudDisponibilidadServicios WHERE solicitudId = @0`,
        [solId],
      )) as DetalleRow[];

      expect(detalle[0].nis).toBeNull();
      expect(detalle[0].numeroDisponibilidadAnterior).toBeNull();
      expect(detalle[0].descripcionProyecto).toBeNull();
      expect(detalle[0].cantidadDormitorios).toBeNull();
      expect(detalle[0].unidadesHabitacionales).toBeNull();
      expect(detalle[0].areaConstruccion).toBeNull();
      expect(detalle[0].niveles).toBeNull();
      expect(detalle[0].caudalRequerido).toBeNull();
      expect(detalle[0].folioReal).toBeNull();
      expect(detalle[0].planoCatastrado).toBeNull();
      expect(detalle[0].planoAgrimensura).toBeNull();
      expect(detalle[0].firma).toBeNull();

      await queryRunner.query(`DELETE FROM Solicitud WHERE id = @0`, [solId]);
    } finally {
      await queryRunner.release();
    }
  });

  it('8. Debe conservar precisión decimal de área y caudal', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      const insertSol = (await queryRunner.query(
        `
        INSERT INTO Solicitud (tipoSolicitudId, codigoSeguimiento, estado, fechaIngreso, createdAt, updatedAt)
        OUTPUT INSERTED.id
        VALUES (@0, 'SOL-TEST-DISP-DEC', 'PENDIENTE', GETDATE(), GETDATE(), GETDATE())
      `,
        [tipoDisponibilidadId],
      )) as InsertedIdRow[];
      const solId = insertSol[0].id;

      await queryRunner.query(
        `
        INSERT INTO SolicitudDisponibilidadServicios (
          solicitudId, tipoPersona, nombreFisica, primerApellidoFisica,
          identificacionFisica, telefonoFisica, medioNotificacionPrincipal,
          provincia, canton, distrito, direccionExacta,
          naturalezaInmueble, calidadTitular, proposito,
          areaConstruccion, caudalRequerido, autorizacionInspeccion,
          createdAt, updatedAt
        ) VALUES (
          @0, @1, @2, @3, @4, @5, @6, @7, @8, @9, @10, @11, @12, @13, @14, @15, @16,
          GETDATE(), GETDATE()
        )
      `,
        [
          solId,
          'Persona física',
          'Luis',
          'Chaves',
          '1-3333-4444',
          '8111-2222',
          'Teléfono',
          'San José',
          'Pérez Zeledón',
          'Rivas',
          'Barrio Centro',
          'Inscrito',
          'Propietario',
          'Estación de combustible',
          1234.56,
          12.3456,
          true,
        ],
      );

      const detalle = (await queryRunner.query(
        `SELECT areaConstruccion, caudalRequerido
         FROM SolicitudDisponibilidadServicios WHERE solicitudId = @0`,
        [solId],
      )) as {
        areaConstruccion: number | string;
        caudalRequerido: number | string;
      }[];

      expect(Number(detalle[0].areaConstruccion)).toBeCloseTo(1234.56, 2);
      expect(Number(detalle[0].caudalRequerido)).toBeCloseTo(12.3456, 4);

      await queryRunner.query(`DELETE FROM Solicitud WHERE id = @0`, [solId]);
    } finally {
      await queryRunner.release();
    }
  });

  it('9. Debe rechazar detalle con solicitudId inexistente (FK)', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await expect(
        queryRunner.query(
          `
          INSERT INTO SolicitudDisponibilidadServicios (
            solicitudId, tipoPersona, calidadTitular, naturalezaInmueble,
            provincia, canton, distrito, direccionExacta,
            proposito, medioNotificacionPrincipal, autorizacionInspeccion,
            createdAt, updatedAt
          ) VALUES (
            @0, @1, @2, @3, @4, @5, @6, @7, @8, @9, @10, GETDATE(), GETDATE()
          )
        `,
          [
            999_999_999,
            'Persona física',
            'Propietario',
            'Inscrito',
            'San José',
            'Pérez Zeledón',
            'San Isidro',
            'Sin dirección',
            'Fraccionamiento',
            'Teléfono',
            true,
          ],
        ),
      ).rejects.toThrow();
    } finally {
      await queryRunner.release();
    }
  });

  it('10. Debe probar rollback (down) y re-ejecución (up) de la migración', async () => {
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    const mig = new CreateSolicitudDisponibilidadServiciosTable1724686180000();

    try {
      await mig.down(queryRunner);
      expect(
        await queryRunner.hasTable('SolicitudDisponibilidadServicios'),
      ).toBe(false);

      await mig.up(queryRunner);
      expect(
        await queryRunner.hasTable('SolicitudDisponibilidadServicios'),
      ).toBe(true);
    } finally {
      await queryRunner.release();
    }
  });
});
