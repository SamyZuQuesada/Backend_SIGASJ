import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

describe('Pruebas de Base de Datos e Integridad en SQL Server: SolicitudMaterial y Detalle (Backlog 4.6)', () => {
  let dataSource: DataSource | null = null;
  let isConnected = false;

  beforeAll(async () => {
    try {
      const options = buildMigrationDataSourceOptions();
      if (options.type === 'mssql') {
        dataSource = new DataSource(options);
        await dataSource.initialize();
        isConnected = true;
      }
    } catch (error) {
      isConnected = false;
      console.warn(
        '[AVISO QA] SQL Server no está disponible en este entorno local:',
        error instanceof Error ? error.message : error,
      );
    }
  }, 15000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      try {
        await dataSource.query(`
          DELETE FROM DetalleSolicitudMaterial WHERE observacion LIKE '%TEST_SOL_TEMP%';
          DELETE FROM SolicitudMaterial WHERE observacion LIKE '%TEST_SOL_TEMP%';
          DELETE FROM Material WHERE nombre LIKE 'TEST_SOL_TEMP_%';
        `);
      } catch {
        // Ignorar fallos de limpieza en afterAll
      }
      await dataSource.destroy();
    }
  });

  it('debe verificar la presencia de las tablas SolicitudMaterial y DetalleSolicitudMaterial', async () => {
    if (!isConnected || !dataSource) return;

    const tables = await dataSource.query<{ TABLE_NAME: string }[]>(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('SolicitudMaterial', 'DetalleSolicitudMaterial', 'Material', 'Usuario')
    `);

    const tableNames = new Set(tables.map((t) => t.TABLE_NAME));
    expect(tableNames.has('SolicitudMaterial')).toBe(true);
    expect(tableNames.has('DetalleSolicitudMaterial')).toBe(true);
    expect(tableNames.has('Material')).toBe(true);
    expect(tableNames.has('Usuario')).toBe(true);
  });

  it('debe verificar las columnas estructurales de SolicitudMaterial', async () => {
    if (!isConnected || !dataSource) return;

    const columns = await dataSource.query<{ COLUMN_NAME: string }[]>(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'SolicitudMaterial'
    `);

    const colNames = new Set(columns.map((c) => c.COLUMN_NAME));
    expect(colNames.has('id')).toBe(true);
    expect(colNames.has('codigo')).toBe(true);
    expect(colNames.has('fechaSolicitud')).toBe(true);
    expect(colNames.has('estado')).toBe(true);
    expect(colNames.has('observacion')).toBe(true);
    expect(colNames.has('idFontanero')).toBe(true);
    expect(colNames.has('idAveria')).toBe(true);
    expect(colNames.has('createdAt')).toBe(true);
    expect(colNames.has('updatedAt')).toBe(true);
  });

  it('debe verificar las columnas estructurales de DetalleSolicitudMaterial', async () => {
    if (!isConnected || !dataSource) return;

    const columns = await dataSource.query<{ COLUMN_NAME: string }[]>(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'DetalleSolicitudMaterial'
    `);

    const colNames = new Set(columns.map((c) => c.COLUMN_NAME));
    expect(colNames.has('id')).toBe(true);
    expect(colNames.has('idSolicitud')).toBe(true);
    expect(colNames.has('idMaterial')).toBe(true);
    expect(colNames.has('cantidad')).toBe(true);
    expect(colNames.has('observacion')).toBe(true);
    expect(colNames.has('createdAt')).toBe(true);
    expect(colNames.has('updatedAt')).toBe(true);
  });

  it('debe verificar las llaves foráneas de integridad referencial', async () => {
    if (!isConnected || !dataSource) return;

    const fks = await dataSource.query<{ CONSTRAINT_NAME: string }[]>(`
      SELECT CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
      WHERE CONSTRAINT_TYPE = 'FOREIGN KEY' 
        AND TABLE_NAME IN ('SolicitudMaterial', 'DetalleSolicitudMaterial')
    `);

    const fkNames = new Set(fks.map((f) => f.CONSTRAINT_NAME));
    expect(fkNames.has('FK_SolicitudMaterial_Usuario_Fontanero')).toBe(true);
    expect(fkNames.has('FK_DetalleSolicitudMaterial_Solicitud')).toBe(true);
  });

  it('debe ejecutar un ciclo atómico de solicitud con múltiples materiales (Rollback Garantizado)', async () => {
    if (!isConnected || !dataSource) return;

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    try {
      // 1. Obtener fontanero existente
      const users = (await queryRunner.query(
        `SELECT TOP 1 idUsuario FROM Usuario`,
      )) as { idUsuario: number }[];

      let userId: number;
      if (users.length > 0) {
        userId = users[0].idUsuario;
      } else {
        await queryRunner.query(`INSERT INTO Usuario DEFAULT VALUES`);
        const lastUser = (await queryRunner.query(
          `SELECT TOP 1 idUsuario FROM Usuario ORDER BY idUsuario DESC`,
        )) as { idUsuario: number }[];
        userId = lastUser[0].idUsuario;
      }

      // 2. Crear dos materiales
      const mat1 = (await queryRunner.query(
        `INSERT INTO Material (nombre, unidadMedida, stockActual, stockMinimo, activo)
         OUTPUT INSERTED.id
         VALUES (@0, 'Metros', 50, 5, 1)`,
        [`TEST_SOL_TEMP_Tubo_${uniqueSuffix}`],
      )) as { id: number }[];

      const mat2 = (await queryRunner.query(
        `INSERT INTO Material (nombre, unidadMedida, stockActual, stockMinimo, activo)
         OUTPUT INSERTED.id
         VALUES (@0, 'Unidad', 30, 2, 1)`,
        [`TEST_SOL_TEMP_Codo_${uniqueSuffix}`],
      )) as { id: number }[];

      // 3. Insertar cabecera de SolicitudMaterial
      const insSol = (await queryRunner.query(
        `INSERT INTO SolicitudMaterial (codigo, fechaSolicitud, estado, observacion, idFontanero)
         OUTPUT INSERTED.id, INSERTED.codigo
         VALUES (@0, GETDATE(), 'PENDIENTE', @1, @2)`,
        [`SOL-${uniqueSuffix.slice(-6)}`, 'TEST_SOL_TEMP_Obs_Cabecera', userId],
      )) as { id: number; codigo: string }[];

      const solicitudId = insSol[0].id;
      expect(solicitudId).toBeGreaterThan(0);

      // 4. Insertar renglones de DetalleSolicitudMaterial (1:N)
      await queryRunner.query(
        `INSERT INTO DetalleSolicitudMaterial (idSolicitud, idMaterial, cantidad, observacion)
         VALUES (@0, @1, 5, 'TEST_SOL_TEMP_Item1'),
                (@0, @2, 2, 'TEST_SOL_TEMP_Item2')`,
        [solicitudId, mat1[0].id, mat2[0].id],
      );

      // 5. Consultar y verificar integridad 1:N
      const detalles = (await queryRunner.query(
        `SELECT d.id, d.cantidad, d.observacion, m.nombre as nombreMaterial
         FROM DetalleSolicitudMaterial d
         INNER JOIN Material m ON d.idMaterial = m.id
         WHERE d.idSolicitud = @0
         ORDER BY d.id ASC`,
        [solicitudId],
      )) as {
        id: number;
        cantidad: number;
        observacion: string;
        nombreMaterial: string;
      }[];

      expect(detalles.length).toBe(2);
      expect(detalles[0].cantidad).toBe(5);
      expect(detalles[1].cantidad).toBe(2);
      expect(detalles[0].nombreMaterial).toContain('TEST_SOL_TEMP_Tubo_');
      expect(detalles[1].nombreMaterial).toContain('TEST_SOL_TEMP_Codo_');
    } finally {
      // Rollback forzado para garantizar que ningún dato de prueba persista
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
    }
  });

  it('debe verificar directamente en SQL Server que el registro de una solicitud NO altera existencias ni genera movimientos de inventario', async () => {
    if (!isConnected || !dataSource) return;

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const uniqueSuffix = `stock_test_${Date.now()}`;

    try {
      // 1. Crear material con stock conocido (ej: 100 unidades)
      const insMat = (await queryRunner.query(
        `INSERT INTO Material (nombre, unidadMedida, stockActual, stockMinimo, activo)
         OUTPUT INSERTED.id, INSERTED.stockActual
         VALUES (@0, 'Unidad', 100, 10, 1)`,
        [`TEST_SOL_STOCK_${uniqueSuffix}`],
      )) as { id: number; stockActual: number }[];

      const materialId = insMat[0].id;
      const stockInicial = insMat[0].stockActual;

      // 2. Obtener conteo actual de filas en MovimientoInventario
      const countMovsAntes = (await queryRunner.query(
        `SELECT COUNT(*) as total FROM MovimientoInventario`,
      )) as { total: number }[];
      const totalMovsAntes = countMovsAntes[0].total;

      // 3. Obtener o crear usuario
      const users = (await queryRunner.query(
        `SELECT TOP 1 idUsuario FROM Usuario`,
      )) as { idUsuario: number }[];

      let userId: number;
      if (users && users.length > 0) {
        userId = users[0].idUsuario;
      } else {
        await queryRunner.query(`INSERT INTO Usuario DEFAULT VALUES`);
        const lastUser = (await queryRunner.query(
          `SELECT TOP 1 idUsuario FROM Usuario ORDER BY idUsuario DESC`,
        )) as { idUsuario: number }[];
        userId = lastUser[0].idUsuario;
      }

      // 4. Registrar SolicitudMaterial y su Detalle con cantidad 35
      const insSol = (await queryRunner.query(
        `INSERT INTO SolicitudMaterial (codigo, fechaSolicitud, estado, observacion, idFontanero)
         OUTPUT INSERTED.id
         VALUES (@0, GETDATE(), 'PENDIENTE', 'Prueba de no afectación de stock', @1)`,
        [`SOL-STK-${uniqueSuffix.slice(-6)}`, userId],
      )) as { id: number }[];

      await queryRunner.query(
        `INSERT INTO DetalleSolicitudMaterial (idSolicitud, idMaterial, cantidad, observacion)
         VALUES (@0, @1, 35, 'Detalle de prueba stock')`,
        [insSol[0].id, materialId],
      );

      // 5. Verificar que el stockActual del Material SIGUE SIENDO EXACTAMENTE 100 (inmutable)
      const matVerificado = (await queryRunner.query(
        `SELECT stockActual, stockMinimo FROM Material WHERE id = @0`,
        [materialId],
      )) as { stockActual: number; stockMinimo: number }[];

      expect(matVerificado[0].stockActual).toBe(stockInicial);
      expect(matVerificado[0].stockActual).toBe(100);

      // 6. Verificar que la tabla MovimientoInventario NO haya recibido registros
      const countMovsDespues = (await queryRunner.query(
        `SELECT COUNT(*) as total FROM MovimientoInventario`,
      )) as { total: number }[];
      const totalMovsDespues = countMovsDespues[0].total;

      expect(totalMovsDespues).toBe(totalMovsAntes);
    } finally {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
    }
  });
});
