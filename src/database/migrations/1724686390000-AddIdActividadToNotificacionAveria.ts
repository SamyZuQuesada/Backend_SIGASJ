import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Referencia opcional a ActividadFontanero para la campana de corrección.
 * Mantiene exactamente una FK principal por fila.
 */
export class AddIdActividadToNotificacionAveria1724686390000 implements MigrationInterface {
  name = 'AddIdActividadToNotificacionAveria1724686390000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('NotificacionAveria'))) {
      return;
    }

    const table = await queryRunner.getTable('NotificacionAveria');
    if (!table) {
      return;
    }

    if (!table.findColumnByName('idActividad')) {
      await queryRunner.addColumn(
        'NotificacionAveria',
        new TableColumn({
          name: 'idActividad',
          type: 'int',
          isNullable: true,
        }),
      );
    }

    if (await queryRunner.hasTable('ActividadFontanero')) {
      const refreshed = await queryRunner.getTable('NotificacionAveria');
      const hasFk = refreshed?.foreignKeys.some(
        (fk) => fk.name === 'FK_NotificacionAveria_ActividadFontanero',
      );
      if (!hasFk) {
        await queryRunner.createForeignKey(
          'NotificacionAveria',
          new TableForeignKey({
            name: 'FK_NotificacionAveria_ActividadFontanero',
            columnNames: ['idActividad'],
            referencedTableName: 'ActividadFontanero',
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
      !after.indices.some((i) => i.name === 'IX_NotificacionAveria_idActividad')
    ) {
      await queryRunner.createIndex(
        'NotificacionAveria',
        new TableIndex({
          name: 'IX_NotificacionAveria_idActividad',
          columnNames: ['idActividad'],
        }),
      );
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
          +
          (CASE WHEN idActividad IS NULL THEN 0 ELSE 1 END)
          = 1
        )
      `);
      await queryRunner.query(`
        IF NOT EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = 'UQ_NotificacionAveria_destinatario_actividad_tipo'
            AND object_id = OBJECT_ID('NotificacionAveria')
        )
        CREATE UNIQUE INDEX UQ_NotificacionAveria_destinatario_actividad_tipo
        ON NotificacionAveria (idUsuarioDestinatario, idActividad, tipo)
        WHERE idActividad IS NOT NULL
      `);
    } else {
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS UQ_NotificacionAveria_destinatario_actividad_tipo
        ON NotificacionAveria (idUsuarioDestinatario, idActividad, tipo)
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
          WHERE name = 'UQ_NotificacionAveria_destinatario_actividad_tipo'
            AND object_id = OBJECT_ID('NotificacionAveria')
        )
        DROP INDEX UQ_NotificacionAveria_destinatario_actividad_tipo ON NotificacionAveria
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
          +
          (CASE WHEN idSolicitudMateriales IS NULL THEN 0 ELSE 1 END)
          +
          (CASE WHEN idSalidaInventario IS NULL THEN 0 ELSE 1 END)
          +
          (CASE WHEN idReposicion IS NULL THEN 0 ELSE 1 END)
          = 1
        )
      `);
    } else {
      await queryRunner.query(
        `DROP INDEX IF EXISTS UQ_NotificacionAveria_destinatario_actividad_tipo`,
      );
    }

    const table = await queryRunner.getTable('NotificacionAveria');
    if (!table) {
      return;
    }

    const fk = table.foreignKeys.find(
      (f) => f.name === 'FK_NotificacionAveria_ActividadFontanero',
    );
    if (fk) {
      await queryRunner.dropForeignKey('NotificacionAveria', fk);
    }

    const idx = table.indices.find(
      (i) => i.name === 'IX_NotificacionAveria_idActividad',
    );
    if (idx) {
      await queryRunner.dropIndex('NotificacionAveria', idx);
    }

    if (table.findColumnByName('idActividad')) {
      await queryRunner.dropColumn('NotificacionAveria', 'idActividad');
    }
  }
}
