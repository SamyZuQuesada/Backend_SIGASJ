import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Amplía NotificacionAveria con referencias de inventario:
 * - idSolicitudMateriales
 * - idSalidaInventario
 * - idReposicion
 *
 * Mantiene la regla de exactamente una referencia principal por notificación.
 * Añade índices de consulta y unicidad.
 */
export class ExtendNotificacionForInventario1724686130000 implements MigrationInterface {
  name = 'ExtendNotificacionForInventario1724686130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('NotificacionAveria'))) {
      return;
    }

    const table = await queryRunner.getTable('NotificacionAveria');
    if (!table) {
      return;
    }

    if (!table.findColumnByName('idSolicitudMateriales')) {
      await queryRunner.addColumn(
        'NotificacionAveria',
        new TableColumn({
          name: 'idSolicitudMateriales',
          type: 'int',
          isNullable: true,
        }),
      );
    }

    if (!table.findColumnByName('idSalidaInventario')) {
      await queryRunner.addColumn(
        'NotificacionAveria',
        new TableColumn({
          name: 'idSalidaInventario',
          type: 'int',
          isNullable: true,
        }),
      );
    }

    if (!table.findColumnByName('idReposicion')) {
      await queryRunner.addColumn(
        'NotificacionAveria',
        new TableColumn({
          name: 'idReposicion',
          type: 'int',
          isNullable: true,
        }),
      );
    }

    // Claves foráneas opcionales si las tablas de inventario existen
    if (await queryRunner.hasTable('SolicitudMaterial')) {
      const refreshed = await queryRunner.getTable('NotificacionAveria');
      const hasFk = refreshed?.foreignKeys.some(
        (fk) => fk.name === 'FK_NotificacionAveria_SolicitudMaterial',
      );
      if (!hasFk) {
        await queryRunner.createForeignKey(
          'NotificacionAveria',
          new TableForeignKey({
            name: 'FK_NotificacionAveria_SolicitudMaterial',
            columnNames: ['idSolicitudMateriales'],
            referencedTableName: 'SolicitudMaterial',
            referencedColumnNames: ['id'],
            onDelete: 'NO ACTION',
            onUpdate: 'NO ACTION',
          }),
        );
      }
    }

    if (await queryRunner.hasTable('MovimientoInventario')) {
      const refreshed = await queryRunner.getTable('NotificacionAveria');
      const hasFk = refreshed?.foreignKeys.some(
        (fk) => fk.name === 'FK_NotificacionAveria_MovimientoInventario',
      );
      if (!hasFk) {
        await queryRunner.createForeignKey(
          'NotificacionAveria',
          new TableForeignKey({
            name: 'FK_NotificacionAveria_MovimientoInventario',
            columnNames: ['idSalidaInventario'],
            referencedTableName: 'MovimientoInventario',
            referencedColumnNames: ['id'],
            onDelete: 'NO ACTION',
            onUpdate: 'NO ACTION',
          }),
        );
      }
    }

    if (await queryRunner.hasTable('AlertaReposicion')) {
      const refreshed = await queryRunner.getTable('NotificacionAveria');
      const hasFk = refreshed?.foreignKeys.some(
        (fk) => fk.name === 'FK_NotificacionAveria_AlertaReposicion',
      );
      if (!hasFk) {
        await queryRunner.createForeignKey(
          'NotificacionAveria',
          new TableForeignKey({
            name: 'FK_NotificacionAveria_AlertaReposicion',
            columnNames: ['idReposicion'],
            referencedTableName: 'AlertaReposicion',
            referencedColumnNames: ['id'],
            onDelete: 'NO ACTION',
            onUpdate: 'NO ACTION',
          }),
        );
      }
    }

    // Índices de columnas
    const after = await queryRunner.getTable('NotificacionAveria');
    if (after) {
      if (
        !after.indices.some(
          (i) => i.name === 'IX_NotificacionAveria_idSolicitudMateriales',
        )
      ) {
        await queryRunner.createIndex(
          'NotificacionAveria',
          new TableIndex({
            name: 'IX_NotificacionAveria_idSolicitudMateriales',
            columnNames: ['idSolicitudMateriales'],
          }),
        );
      }

      if (
        !after.indices.some(
          (i) => i.name === 'IX_NotificacionAveria_idSalidaInventario',
        )
      ) {
        await queryRunner.createIndex(
          'NotificacionAveria',
          new TableIndex({
            name: 'IX_NotificacionAveria_idSalidaInventario',
            columnNames: ['idSalidaInventario'],
          }),
        );
      }

      if (
        !after.indices.some(
          (i) => i.name === 'IX_NotificacionAveria_idReposicion',
        )
      ) {
        await queryRunner.createIndex(
          'NotificacionAveria',
          new TableIndex({
            name: 'IX_NotificacionAveria_idReposicion',
            columnNames: ['idReposicion'],
          }),
        );
      }

      if (
        !after.indices.some(
          (i) => i.name === 'IX_NotificacionAveria_destinatario_leida_fecha',
        )
      ) {
        await queryRunner.createIndex(
          'NotificacionAveria',
          new TableIndex({
            name: 'IX_NotificacionAveria_destinatario_leida_fecha',
            columnNames: ['idUsuarioDestinatario', 'leida', 'fechaCreacion'],
          }),
        );
      }
    }

    const isMssql = queryRunner.connection.options.type === 'mssql';
    if (isMssql) {
      // Reemplazar restricción check para contemplar las 5 posibles referencias
      await queryRunner.query(`
        IF EXISTS (
          SELECT 1 FROM sys.check_constraints
          WHERE name = 'CK_NotificacionAveria_una_referencia'
        )
        ALTER TABLE NotificacionAveria DROP CONSTRAINT CK_NotificacionAveria_una_referencia
      `);
      await queryRunner.query(`
        ALTER TABLE NotificacionAveria WITH CHECK ADD CONSTRAINT CK_NotificacionAveria_una_referencia
        CHECK (
          (CASE WHEN idAveria IS NULL THEN 0 ELSE 1 END)
          +
          (CASE WHEN idSolicitudAusencia IS NULL THEN 0 ELSE 1 END)
          +
          (CASE WHEN idSolicitudMateriales IS NULL THEN 0 ELSE 1 END)
          +
          (CASE WHEN idSalidaInventario IS NULL THEN 0 ELSE 1 END)
          +
          (CASE WHEN idReposicion IS NULL THEN 0 ELSE 1 END)
          = 1
        )
      `);

      // Índices únicos filtrados en MSSQL
      await queryRunner.query(`
        IF NOT EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = 'UQ_NotificacionAveria_destinatario_solicitud_materiales_tipo'
            AND object_id = OBJECT_ID('NotificacionAveria')
        )
        CREATE UNIQUE INDEX UQ_NotificacionAveria_destinatario_solicitud_materiales_tipo
        ON NotificacionAveria (idUsuarioDestinatario, idSolicitudMateriales, tipo)
        WHERE idSolicitudMateriales IS NOT NULL
      `);
      await queryRunner.query(`
        IF NOT EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = 'UQ_NotificacionAveria_destinatario_salida_inventario_tipo'
            AND object_id = OBJECT_ID('NotificacionAveria')
        )
        CREATE UNIQUE INDEX UQ_NotificacionAveria_destinatario_salida_inventario_tipo
        ON NotificacionAveria (idUsuarioDestinatario, idSalidaInventario, tipo)
        WHERE idSalidaInventario IS NOT NULL
      `);
      await queryRunner.query(`
        IF NOT EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = 'UQ_NotificacionAveria_destinatario_reposicion_tipo'
            AND object_id = OBJECT_ID('NotificacionAveria')
        )
        CREATE UNIQUE INDEX UQ_NotificacionAveria_destinatario_reposicion_tipo
        ON NotificacionAveria (idUsuarioDestinatario, idReposicion, tipo)
        WHERE idReposicion IS NOT NULL
      `);
    } else {
      // sqljs / sqlite (entornos de pruebas)
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS UQ_NotificacionAveria_destinatario_solicitud_materiales_tipo
        ON NotificacionAveria (idUsuarioDestinatario, idSolicitudMateriales, tipo)
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS UQ_NotificacionAveria_destinatario_salida_inventario_tipo
        ON NotificacionAveria (idUsuarioDestinatario, idSalidaInventario, tipo)
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS UQ_NotificacionAveria_destinatario_reposicion_tipo
        ON NotificacionAveria (idUsuarioDestinatario, idReposicion, tipo)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('NotificacionAveria'))) {
      return;
    }

    const isMssql = queryRunner.connection.options.type === 'mssql';
    if (isMssql) {
      await queryRunner.query(`
        IF EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = 'UQ_NotificacionAveria_destinatario_reposicion_tipo'
            AND object_id = OBJECT_ID('NotificacionAveria')
        )
        DROP INDEX UQ_NotificacionAveria_destinatario_reposicion_tipo ON NotificacionAveria
      `);
      await queryRunner.query(`
        IF EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = 'UQ_NotificacionAveria_destinatario_salida_inventario_tipo'
            AND object_id = OBJECT_ID('NotificacionAveria')
        )
        DROP INDEX UQ_NotificacionAveria_destinatario_salida_inventario_tipo ON NotificacionAveria
      `);
      await queryRunner.query(`
        IF EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = 'UQ_NotificacionAveria_destinatario_solicitud_materiales_tipo'
            AND object_id = OBJECT_ID('NotificacionAveria')
        )
        DROP INDEX UQ_NotificacionAveria_destinatario_solicitud_materiales_tipo ON NotificacionAveria
      `);
      await queryRunner.query(`
        IF EXISTS (
          SELECT 1 FROM sys.check_constraints
          WHERE name = 'CK_NotificacionAveria_una_referencia'
        )
        ALTER TABLE NotificacionAveria DROP CONSTRAINT CK_NotificacionAveria_una_referencia
      `);
      await queryRunner.query(`
        ALTER TABLE NotificacionAveria WITH CHECK ADD CONSTRAINT CK_NotificacionAveria_una_referencia
        CHECK (
          (CASE WHEN idAveria IS NULL THEN 0 ELSE 1 END)
          +
          (CASE WHEN idSolicitudAusencia IS NULL THEN 0 ELSE 1 END)
          = 1
        )
      `);
    } else {
      await queryRunner.query(
        `DROP INDEX IF EXISTS UQ_NotificacionAveria_destinatario_reposicion_tipo`,
      );
      await queryRunner.query(
        `DROP INDEX IF EXISTS UQ_NotificacionAveria_destinatario_salida_inventario_tipo`,
      );
      await queryRunner.query(
        `DROP INDEX IF EXISTS UQ_NotificacionAveria_destinatario_solicitud_materiales_tipo`,
      );
    }

    const table = await queryRunner.getTable('NotificacionAveria');
    if (table) {
      const fkRepo = table.foreignKeys.find(
        (f) => f.name === 'FK_NotificacionAveria_AlertaReposicion',
      );
      if (fkRepo) {
        await queryRunner.dropForeignKey('NotificacionAveria', fkRepo);
      }

      const fkSalida = table.foreignKeys.find(
        (f) => f.name === 'FK_NotificacionAveria_MovimientoInventario',
      );
      if (fkSalida) {
        await queryRunner.dropForeignKey('NotificacionAveria', fkSalida);
      }

      const fkSol = table.foreignKeys.find(
        (f) => f.name === 'FK_NotificacionAveria_SolicitudMaterial',
      );
      if (fkSol) {
        await queryRunner.dropForeignKey('NotificacionAveria', fkSol);
      }

      const idxFecha = table.indices.find(
        (i) => i.name === 'IX_NotificacionAveria_destinatario_leida_fecha',
      );
      if (idxFecha) {
        await queryRunner.dropIndex('NotificacionAveria', idxFecha);
      }

      const idxRepo = table.indices.find(
        (i) => i.name === 'IX_NotificacionAveria_idReposicion',
      );
      if (idxRepo) {
        await queryRunner.dropIndex('NotificacionAveria', idxRepo);
      }

      const idxSalida = table.indices.find(
        (i) => i.name === 'IX_NotificacionAveria_idSalidaInventario',
      );
      if (idxSalida) {
        await queryRunner.dropIndex('NotificacionAveria', idxSalida);
      }

      const idxSol = table.indices.find(
        (i) => i.name === 'IX_NotificacionAveria_idSolicitudMateriales',
      );
      if (idxSol) {
        await queryRunner.dropIndex('NotificacionAveria', idxSol);
      }

      if (table.findColumnByName('idReposicion')) {
        await queryRunner.dropColumn('NotificacionAveria', 'idReposicion');
      }
      if (table.findColumnByName('idSalidaInventario')) {
        await queryRunner.dropColumn(
          'NotificacionAveria',
          'idSalidaInventario',
        );
      }
      if (table.findColumnByName('idSolicitudMateriales')) {
        await queryRunner.dropColumn(
          'NotificacionAveria',
          'idSolicitudMateriales',
        );
      }
    }
  }
}
