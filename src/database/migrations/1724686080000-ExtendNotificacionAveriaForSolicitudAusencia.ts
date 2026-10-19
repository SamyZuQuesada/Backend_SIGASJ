import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Permite notificaciones de campana por SolicitudAusencia (además de Averia).
 * Exactamente una referencia: idAveria XOR idSolicitudAusencia.
 */
export class ExtendNotificacionAveriaForSolicitudAusencia1724686080000
  implements MigrationInterface
{
  name = 'ExtendNotificacionAveriaForSolicitudAusencia1724686080000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('NotificacionAveria'))) {
      return;
    }

    const table = await queryRunner.getTable('NotificacionAveria');
    if (!table) {
      return;
    }

    const uniqueOld = table.indices.find(
      (i) => i.name === 'UQ_NotificacionAveria_destinatario_averia_tipo',
    );
    if (uniqueOld) {
      await queryRunner.dropIndex(
        'NotificacionAveria',
        'UQ_NotificacionAveria_destinatario_averia_tipo',
      );
    }

    const idAveria = table.findColumnByName('idAveria');
    if (idAveria && !idAveria.isNullable) {
      await queryRunner.changeColumn(
        'NotificacionAveria',
        'idAveria',
        new TableColumn({
          name: 'idAveria',
          type: 'int',
          isNullable: true,
        }),
      );
    }

    if (!table.findColumnByName('idSolicitudAusencia')) {
      await queryRunner.addColumn(
        'NotificacionAveria',
        new TableColumn({
          name: 'idSolicitudAusencia',
          type: 'int',
          isNullable: true,
        }),
      );
    }

    if (await queryRunner.hasTable('SolicitudAusencia')) {
      const refreshed = await queryRunner.getTable('NotificacionAveria');
      const hasFk = refreshed?.foreignKeys.some(
        (fk) => fk.name === 'FK_NotificacionAveria_SolicitudAusencia',
      );
      if (!hasFk) {
        await queryRunner.createForeignKey(
          'NotificacionAveria',
          new TableForeignKey({
            name: 'FK_NotificacionAveria_SolicitudAusencia',
            columnNames: ['idSolicitudAusencia'],
            referencedTableName: 'SolicitudAusencia',
            referencedColumnNames: ['id'],
            onDelete: 'NO ACTION',
            onUpdate: 'NO ACTION',
          }),
        );
      }
    }

    const after = await queryRunner.getTable('NotificacionAveria');
    if (
      after &&
      !after.indices.some(
        (i) => i.name === 'IX_NotificacionAveria_idSolicitudAusencia',
      )
    ) {
      await queryRunner.createIndex(
        'NotificacionAveria',
        new TableIndex({
          name: 'IX_NotificacionAveria_idSolicitudAusencia',
          columnNames: ['idSolicitudAusencia'],
        }),
      );
    }

    const isMssql = queryRunner.connection.options.type === 'mssql';
    if (isMssql) {
      await queryRunner.query(`
        IF NOT EXISTS (
          SELECT 1 FROM sys.check_constraints
          WHERE name = 'CK_NotificacionAveria_una_referencia'
        )
        ALTER TABLE NotificacionAveria WITH CHECK ADD CONSTRAINT CK_NotificacionAveria_una_referencia
        CHECK (
          (CASE WHEN idAveria IS NULL THEN 0 ELSE 1 END)
          +
          (CASE WHEN idSolicitudAusencia IS NULL THEN 0 ELSE 1 END)
          = 1
        )
      `);
      await queryRunner.query(`
        IF NOT EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = 'UQ_NotificacionAveria_destinatario_averia_tipo'
            AND object_id = OBJECT_ID('NotificacionAveria')
        )
        CREATE UNIQUE INDEX UQ_NotificacionAveria_destinatario_averia_tipo
        ON NotificacionAveria (idUsuarioDestinatario, idAveria, tipo)
        WHERE idAveria IS NOT NULL
      `);
      await queryRunner.query(`
        IF NOT EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = 'UQ_NotificacionAveria_destinatario_solicitud_tipo'
            AND object_id = OBJECT_ID('NotificacionAveria')
        )
        CREATE UNIQUE INDEX UQ_NotificacionAveria_destinatario_solicitud_tipo
        ON NotificacionAveria (idUsuarioDestinatario, idSolicitudAusencia, tipo)
        WHERE idSolicitudAusencia IS NOT NULL
      `);
    } else {
      // sqljs / sqlite (tests): unique parcial aproximado + check vía índice único compuesto.
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS UQ_NotificacionAveria_destinatario_averia_tipo
        ON NotificacionAveria (idUsuarioDestinatario, idAveria, tipo)
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS UQ_NotificacionAveria_destinatario_solicitud_tipo
        ON NotificacionAveria (idUsuarioDestinatario, idSolicitudAusencia, tipo)
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
          SELECT 1 FROM sys.check_constraints
          WHERE name = 'CK_NotificacionAveria_una_referencia'
        )
        ALTER TABLE NotificacionAveria DROP CONSTRAINT CK_NotificacionAveria_una_referencia
      `);
      await queryRunner.query(`
        IF EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = 'UQ_NotificacionAveria_destinatario_solicitud_tipo'
            AND object_id = OBJECT_ID('NotificacionAveria')
        )
        DROP INDEX UQ_NotificacionAveria_destinatario_solicitud_tipo ON NotificacionAveria
      `);
      await queryRunner.query(`
        IF EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = 'UQ_NotificacionAveria_destinatario_averia_tipo'
            AND object_id = OBJECT_ID('NotificacionAveria')
        )
        DROP INDEX UQ_NotificacionAveria_destinatario_averia_tipo ON NotificacionAveria
      `);
    } else {
      await queryRunner.query(
        `DROP INDEX IF EXISTS UQ_NotificacionAveria_destinatario_solicitud_tipo`,
      );
      await queryRunner.query(
        `DROP INDEX IF EXISTS UQ_NotificacionAveria_destinatario_averia_tipo`,
      );
    }

    const table = await queryRunner.getTable('NotificacionAveria');
    const fk = table?.foreignKeys.find(
      (f) => f.name === 'FK_NotificacionAveria_SolicitudAusencia',
    );
    if (fk) {
      await queryRunner.dropForeignKey('NotificacionAveria', fk);
    }
    if (table?.findColumnByName('idSolicitudAusencia')) {
      await queryRunner.dropColumn('NotificacionAveria', 'idSolicitudAusencia');
    }

    const idAveria = table?.findColumnByName('idAveria');
    if (idAveria?.isNullable) {
      await queryRunner.changeColumn(
        'NotificacionAveria',
        'idAveria',
        new TableColumn({
          name: 'idAveria',
          type: 'int',
          isNullable: false,
        }),
      );
    }

    await queryRunner.createIndex(
      'NotificacionAveria',
      new TableIndex({
        name: 'UQ_NotificacionAveria_destinatario_averia_tipo',
        columnNames: ['idUsuarioDestinatario', 'idAveria', 'tipo'],
        isUnique: true,
      }),
    );
  }
}
