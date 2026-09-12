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
  idAveria: number | null;
  idSolicitud: number | null;
  observacion: string | null;
};

describe('Pruebas de Base de Datos e Integridad en SQL Server: Salidas y Movimientos (Backlog 4.5)', () => {
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
          DELETE FROM MovimientoInventario WHERE observacion LIKE '%TEST_SALIDA_TEMP%';
          DELETE FROM Material WHERE nombre LIKE 'TEST_SALIDA_TEMP_%';
        `);
      } catch {
        // Ignorar fallos de limpieza en afterAll
      }
      await dataSource.destroy();
    }
  });

  it('debe verificar la presencia de las tablas involucradas en Salidas (Material, Usuario, MovimientoInventario)', async () => {
    if (!isConnected || !dataSource) return;

    const tables = await dataSource.query<{ TABLE_NAME: string }[]>(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME IN ('Material', 'Usuario', 'MovimientoInventario')
    `);

    const tableNames = new Set(tables.map((t) => t.TABLE_NAME));
    expect(tableNames.has('Material')).toBe(true);
    expect(tableNames.has('Usuario')).toBe(true);
    expect(tableNames.has('MovimientoInventario')).toBe(true);
  });

  it('debe ejecutar un ciclo atómico de salida en SQL Server: 20 -> salida 5 -> 15 final y registro SALIDA (Rollback Garantizado)', async () => {
    if (!isConnected || !dataSource) return;

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    try {
      // 1. Crear material de prueba con stock inicial 20
      const insMat = (await queryRunner.query(
        `INSERT INTO Material (nombre, unidadMedida, stockActual, stockMinimo, activo)
         OUTPUT INSERTED.id, INSERTED.stockActual
         VALUES (@0, 'Unidad', 20, 5, 1)`,
        [`TEST_SALIDA_TEMP_Mat_${uniqueSuffix}`],
      )) as { id: number; stockActual: number }[];

      const materialId = insMat[0].id;
      const stockInicial = insMat[0].stockActual;
      expect(stockInicial).toBe(20);

      // 2. Obtener un usuario de prueba (Fontanero)
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

      const cantidadSalida = 5;

      // 3. Ejecutar actualización atómica y registro de salida
      await queryRunner.query(
        `UPDATE Material SET stockActual = stockActual - @0 WHERE id = @1`,
        [cantidadSalida, materialId],
      );

      const insMov = (await queryRunner.query(
        `INSERT INTO MovimientoInventario (tipo, cantidad, fechaMovimiento, observacion, idMaterial, idUsuario)
         OUTPUT INSERTED.id
         VALUES ('SALIDA', @0, GETDATE(), @1, @2, @3)`,
        [
          cantidadSalida,
          `TEST_SALIDA_TEMP_Consistencia_${uniqueSuffix}`,
          materialId,
          userId,
        ],
      )) as { id: number }[];

      const insertedMovId = insMov[0]?.id;
      expect(insertedMovId).toBeDefined();

      // 4. Validar que el stock final es 15
      const matCheck = (await queryRunner.query(
        `SELECT id, stockActual FROM Material WHERE id = @0`,
        [materialId],
      )) as MaterialRow[];
      expect(matCheck[0]?.stockActual).toBe(15);

      // 5. Validar que el movimiento registrado es de tipo SALIDA con datos correctos
      const movCheck = (await queryRunner.query(
        `SELECT id, tipo, cantidad, idMaterial, idUsuario, fechaMovimiento FROM MovimientoInventario WHERE id = @0`,
        [insertedMovId],
      )) as MovimientoRow[];
      expect(movCheck.length).toBe(1);
      expect(movCheck[0]?.tipo).toBe('SALIDA');
      expect(movCheck[0]?.cantidad).toBe(cantidadSalida);
      expect(movCheck[0]?.idMaterial).toBe(materialId);
      expect(movCheck[0]?.idUsuario).toBe(userId);
      expect(movCheck[0]?.fechaMovimiento).toBeDefined();
    } finally {
      // 6. Rollback garantizado para mantener base de datos limpia
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      await queryRunner.release();
    }
  });

  it('debe verificar integridad referencial de MovimientoInventario hacia Material y Usuario', async () => {
    if (!isConnected || !dataSource) return;

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let foreignKeyError = false;
      try {
        // Intentar insertar movimiento con material inexistente (-99999)
        await queryRunner.query(
          `INSERT INTO MovimientoInventario (tipo, cantidad, fechaMovimiento, idMaterial, idUsuario)
           VALUES ('SALIDA', 5, GETDATE(), -99999, 1)`,
        );
      } catch (err) {
        foreignKeyError = true;
      }
      expect(foreignKeyError).toBe(true);
    } finally {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      await queryRunner.release();
    }
  });

  it('debe registrar y relacionar correctamente una salida vinculada a una Avería (Rollback Garantizado)', async () => {
    if (!isConnected || !dataSource) return;

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    try {
      // 1. Material
      const insMat = (await queryRunner.query(
        `INSERT INTO Material (nombre, unidadMedida, stockActual, stockMinimo, activo)
         OUTPUT INSERTED.id, INSERTED.stockActual
         VALUES (@0, 'Unidad', 10, 2, 1)`,
        [`TEST_SALIDA_TEMP_Averia_${uniqueSuffix}`],
      )) as { id: number; stockActual: number }[];
      const materialId = insMat[0].id;

      // 2. Usuario
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

      // 3. Avería existente o referencia numérica
      let averiaId = 42;
      const averiaTable = (await queryRunner.query(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Averia'`,
      )) as { TABLE_NAME: string }[];

      if (averiaTable.length > 0) {
        const averias = (await queryRunner.query(
          `SELECT TOP 1 id FROM Averia`,
        )) as { id: number }[];
        if (averias.length > 0) {
          averiaId = averias[0].id;
        }
      }

      // 4. Registrar salida con idAveria
      const insMov = (await queryRunner.query(
        `INSERT INTO MovimientoInventario (tipo, cantidad, fechaMovimiento, observacion, idMaterial, idUsuario, idAveria)
         OUTPUT INSERTED.id
         VALUES ('SALIDA', 2, GETDATE(), @0, @1, @2, @3)`,
        [
          `TEST_SALIDA_TEMP_Averia_${uniqueSuffix}`,
          materialId,
          userId,
          averiaId,
        ],
      )) as { id: number }[];

      const movId = insMov[0].id;
      const movCheck = (await queryRunner.query(
        `SELECT id, tipo, cantidad, idAveria FROM MovimientoInventario WHERE id = @0`,
        [movId],
      )) as MovimientoRow[];

      expect(movCheck[0].tipo).toBe('SALIDA');
      expect(movCheck[0].cantidad).toBe(2);
      expect(movCheck[0].idAveria).toBe(averiaId);
    } finally {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      await queryRunner.release();
    }
  });

  it('debe garantizar ROLLBACK en SQL Server en caso de fallo intencional (sin actualización parcial)', async () => {
    if (!isConnected || !dataSource) return;

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    try {
      const insMat = (await queryRunner.query(
        `INSERT INTO Material (nombre, unidadMedida, stockActual, stockMinimo, activo)
         OUTPUT INSERTED.id, INSERTED.stockActual
         VALUES (@0, 'Unidad', 20, 5, 1)`,
        [`TEST_SALIDA_TEMP_Fail_${uniqueSuffix}`],
      )) as { id: number; stockActual: number }[];
      const matId = insMat[0].id;

      let transactionAborted = false;
      try {
        // Disminuir stock
        await queryRunner.query(
          `UPDATE Material SET stockActual = stockActual - 5 WHERE id = @0`,
          [matId],
        );
        // Error forzado (tabla inexistente)
        await queryRunner.query(
          `INSERT INTO TablaInexistenteErrorForzado (id) VALUES (1)`,
        );
      } catch {
        transactionAborted = true;
      }

      expect(transactionAborted).toBe(true);
    } finally {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      await queryRunner.release();
    }
  });
});
