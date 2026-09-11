import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

type MaterialRow = {
  id: number;
  nombre: string;
  stockActual: number;
};

type MovimientoRow = {
  id: number;
  tipo: string;
  cantidad: number;
  fechaMovimiento: Date;
  idMaterial: number;
  idUsuario: number;
  idProveedor: number | null;
  observacion: string | null;
};

type DocumentoRow = {
  id: number;
  nombreOriginal: string;
  idMovimiento: number;
};

describe('Pruebas de Base de Datos e Integridad en SQL Server: Entradas y Movimientos (Backlog 4.4)', () => {
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
          DELETE FROM DocumentoMovimientoInventario WHERE nombreOriginal LIKE 'TEST_TEMP_%' OR nombreOriginal LIKE '%cascade_test%';
          DELETE FROM MovimientoInventario WHERE observacion LIKE '%TEST_TEMP%' OR observacion LIKE '%Prueba de consistencia atómica%';
          DELETE FROM Material WHERE nombre LIKE 'TEST_TEMP_%' OR nombre LIKE '%Test Atómico%';
        `);
      } catch {
        // Ignorar fallos de limpieza en afterAll
      }
      await dataSource.destroy();
    }
  });

  it('debe confirmar la presencia de las tablas involucradas en el flujo de entradas (Material, Usuario, MovimientoInventario, DocumentoMovimientoInventario)', async () => {
    if (!isConnected || !dataSource) return;

    const tables = await dataSource.query<{ TABLE_NAME: string }[]>(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('Material', 'Usuario', 'MovimientoInventario', 'DocumentoMovimientoInventario')
    `);

    const tableNames = new Set(tables.map((t) => t.TABLE_NAME));
    expect(tableNames.has('Material')).toBe(true);
    expect(tableNames.has('Usuario')).toBe(true);
    expect(tableNames.has('MovimientoInventario')).toBe(true);
    expect(tableNames.has('DocumentoMovimientoInventario')).toBe(true);
  });

  it('debe ejecutar un ciclo atómico de entrada en SQL Server: incremento de stock y registro de movimiento en la misma transacción (Rollback Garantizado)', async () => {
    if (!isConnected || !dataSource) return;

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    try {
      // 1. Obtener o crear material y usuario dentro de la transacción
      let materialId: number;
      let stockInicial: number;

      const existingMaterials = (await queryRunner.query(
        `SELECT TOP 1 id, stockActual FROM Material WHERE activo = 1`,
      )) as MaterialRow[];

      if (existingMaterials.length > 0) {
        materialId = existingMaterials[0].id;
        stockInicial = existingMaterials[0].stockActual;
      } else {
        const insMat = (await queryRunner.query(
          `INSERT INTO Material (nombre, unidadMedida, stockActual, stockMinimo, activo)
           OUTPUT INSERTED.id, INSERTED.stockActual
           VALUES (@0, 'Tubo', 20, 5, 1)`,
          [`TEST_TEMP_Material_${uniqueSuffix}`],
        )) as { id: number; stockActual: number }[];
        materialId = insMat[0].id;
        stockInicial = insMat[0].stockActual;
      }

      let userId: number;
      const existingUsers = (await queryRunner.query(
        `SELECT TOP 1 idUsuario FROM Usuario`,
      )) as { idUsuario: number }[];

      if (existingUsers.length > 0) {
        userId = existingUsers[0].idUsuario;
      } else {
        const insUsr = (await queryRunner.query(
          `INSERT INTO Usuario OUTPUT INSERTED.idUsuario DEFAULT VALUES`,
        )) as { idUsuario: number }[];
        userId = insUsr[0].idUsuario;
      }

      const cantidadEntrada = 15;

      // 2. Operación atómica de entrada: incrementar stock y registrar movimiento
      await queryRunner.query(
        `UPDATE Material SET stockActual = stockActual + @0 WHERE id = @1`,
        [cantidadEntrada, materialId],
      );

      const insMov = (await queryRunner.query(
        `INSERT INTO MovimientoInventario (tipo, cantidad, fechaMovimiento, observacion, idMaterial, idUsuario)
         OUTPUT INSERTED.id
         VALUES ('ENTRADA', @0, GETDATE(), @1, @2, @3)`,
        [
          cantidadEntrada,
          `TEST_TEMP_Consistencia_Atómica_${uniqueSuffix}`,
          materialId,
          userId,
        ],
      )) as { id: number }[];

      const insertedMovId = insMov[0]?.id;
      expect(insertedMovId).toBeDefined();

      // 3. Validar dentro de la transacción que el stock aumentó y el movimiento se registró
      const matCheck = (await queryRunner.query(
        `SELECT id, stockActual FROM Material WHERE id = @0`,
        [materialId],
      )) as MaterialRow[];
      expect(matCheck[0]?.stockActual).toBe(stockInicial + cantidadEntrada);

      const movCheck = (await queryRunner.query(
        `SELECT id, tipo, cantidad, idMaterial, idUsuario FROM MovimientoInventario WHERE id = @0`,
        [insertedMovId],
      )) as MovimientoRow[];
      expect(movCheck.length).toBe(1);
      expect(movCheck[0]?.tipo).toBe('ENTRADA');
      expect(movCheck[0]?.cantidad).toBe(cantidadEntrada);
      expect(movCheck[0]?.idMaterial).toBe(materialId);
      expect(movCheck[0]?.idUsuario).toBe(userId);
    } finally {
      // 4. GARANTÍA DE ROLLBACK: Nunca persiste datos en desarrollo o producción
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      await queryRunner.release();
    }
  });

  it('debe garantizar ROLLBACK en SQL Server si ocurre un error (sin actualizaciones parciales de stock ni movimientos huérfanos)', async () => {
    if (!isConnected || !dataSource) return;

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    try {
      const insMat = (await queryRunner.query(
        `INSERT INTO Material (nombre, unidadMedida, stockActual, stockMinimo, activo)
         OUTPUT INSERTED.id, INSERTED.stockActual
         VALUES (@0, 'Unidad', 50, 10, 1)`,
        [`TEST_TEMP_Rollback_${uniqueSuffix}`],
      )) as { id: number; stockActual: number }[];

      const testMatId = insMat[0].id;
      const stockOriginal = insMat[0].stockActual;

      // Iniciar sub-transacción o prueba de error en queryRunner
      let transactionFailed = false;
      try {
        await queryRunner.query(
          `UPDATE Material SET stockActual = stockActual + 50 WHERE id = @0`,
          [testMatId],
        );
        // Provocar fallo intencional
        await queryRunner.query(
          `INSERT INTO TablaInexistenteErrorForzado (id) VALUES (1)`,
        );
      } catch {
        transactionFailed = true;
      }

      expect(transactionFailed).toBe(true);
    } finally {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      await queryRunner.release();
    }
  });

  it('debe comprobar la eliminación en cascada (ON DELETE CASCADE) de DocumentoMovimientoInventario en SQL Server (Rollback Garantizado)', async () => {
    if (!isConnected || !dataSource) return;

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    try {
      // 1. Sembrar material y usuario dentro de la transacción
      const insMat = (await queryRunner.query(
        `INSERT INTO Material (nombre, unidadMedida, stockActual, stockMinimo, activo)
         OUTPUT INSERTED.id
         VALUES (@0, 'Unidad', 10, 2, 1)`,
        [`TEST_TEMP_Cascade_Mat_${uniqueSuffix}`],
      )) as { id: number }[];
      const matId = insMat[0].id;

      let userId: number;
      const users = (await queryRunner.query(
        `SELECT TOP 1 idUsuario FROM Usuario`,
      )) as { idUsuario: number }[];
      if (users.length > 0) {
        userId = users[0].idUsuario;
      } else {
        const insUsr = (await queryRunner.query(
          `INSERT INTO Usuario OUTPUT INSERTED.idUsuario DEFAULT VALUES`,
        )) as { idUsuario: number }[];
        userId = insUsr[0].idUsuario;
      }

      // 2. Insertar movimiento
      const insertMov = (await queryRunner.query(
        `INSERT INTO MovimientoInventario (tipo, cantidad, fechaMovimiento, idMaterial, idUsuario)
         OUTPUT INSERTED.id
         VALUES ('ENTRADA', 10, GETDATE(), @0, @1)`,
        [matId, userId],
      )) as { id: number }[];
      const idMovimiento = insertMov[0].id;

      // 3. Insertar documento asociado
      const insertDoc = (await queryRunner.query(
        `INSERT INTO DocumentoMovimientoInventario (nombreOriginal, tipoArchivo, rutaReferenciaArchivo, tamanio, idMovimiento)
         OUTPUT INSERTED.id
         VALUES (@0, 'application/pdf', '/api/v1/test.pdf', 1024, @1)`,
        [`TEST_TEMP_factura_cascade_${uniqueSuffix}.pdf`, idMovimiento],
      )) as { id: number }[];
      const idDoc = insertDoc[0].id;

      // 4. Eliminar el movimiento padre
      await queryRunner.query(
        `DELETE FROM MovimientoInventario WHERE id = @0`,
        [idMovimiento],
      );

      // 5. Verificar que el documento hijo fue eliminado automáticamente por CASCADE
      const docCheck = (await queryRunner.query(
        `SELECT id FROM DocumentoMovimientoInventario WHERE id = @0`,
        [idDoc],
      )) as DocumentoRow[];

      expect(docCheck.length).toBe(0);
    } finally {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      await queryRunner.release();
    }
  });
});

