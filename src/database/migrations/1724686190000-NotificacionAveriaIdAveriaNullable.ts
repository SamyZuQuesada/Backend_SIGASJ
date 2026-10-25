import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificacionAveriaIdAveriaNullable1724686190000
  implements MigrationInterface
{
  name = 'NotificacionAveriaIdAveriaNullable1724686190000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';

    if (isMssql) {
      // 1. Eliminar check constraint si existe
      await queryRunner.query(`
        IF EXISTS (
          SELECT 1 FROM sys.check_constraints
          WHERE name = 'CK_NotificacionAveria_una_referencia'
            AND parent_object_id = OBJECT_ID('NotificacionAveria')
        )
        ALTER TABLE NotificacionAveria DROP CONSTRAINT CK_NotificacionAveria_una_referencia
      `);

      // 2. Eliminar índices que dependen de idAveria
      await queryRunner.query(`
        IF EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = 'UQ_NotificacionAveria_destinatario_averia_tipo'
            AND object_id = OBJECT_ID('NotificacionAveria')
        )
        DROP INDEX UQ_NotificacionAveria_destinatario_averia_tipo ON NotificacionAveria
      `);

      await queryRunner.query(`
        IF EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = 'IX_NotificacionAveria_idAveria'
            AND object_id = OBJECT_ID('NotificacionAveria')
        )
        DROP INDEX IX_NotificacionAveria_idAveria ON NotificacionAveria
      `);

      // 3. Alterar columna idAveria a NULL
      await queryRunner.query(
        `ALTER TABLE NotificacionAveria ALTER COLUMN idAveria int NULL`,
      );

      // 4. Recrear IX_NotificacionAveria_idAveria
      await queryRunner.query(`
        IF NOT EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = 'IX_NotificacionAveria_idAveria'
            AND object_id = OBJECT_ID('NotificacionAveria')
        )
        CREATE INDEX IX_NotificacionAveria_idAveria ON NotificacionAveria (idAveria)
      `);

      // 5. Recrear UQ_NotificacionAveria_destinatario_averia_tipo filtrado
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

      // 6. Recrear restricción check
      await queryRunner.query(`
        IF NOT EXISTS (
          SELECT 1 FROM sys.check_constraints
          WHERE name = 'CK_NotificacionAveria_una_referencia'
            AND parent_object_id = OBJECT_ID('NotificacionAveria')
        )
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
      try {
        await queryRunner.query(
          `ALTER TABLE "NotificacionAveria" ALTER COLUMN "idAveria" int NULL`,
        );
      } catch {
        // En SQLite el alter column puede variar
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';

    if (isMssql) {
      await queryRunner.query(`
        IF EXISTS (
          SELECT 1 FROM sys.check_constraints
          WHERE name = 'CK_NotificacionAveria_una_referencia'
            AND parent_object_id = OBJECT_ID('NotificacionAveria')
        )
        ALTER TABLE NotificacionAveria DROP CONSTRAINT CK_NotificacionAveria_una_referencia
      `);

      await queryRunner.query(`
        IF EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = 'UQ_NotificacionAveria_destinatario_averia_tipo'
            AND object_id = OBJECT_ID('NotificacionAveria')
        )
        DROP INDEX UQ_NotificacionAveria_destinatario_averia_tipo ON NotificacionAveria
      `);

      await queryRunner.query(`
        IF EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = 'IX_NotificacionAveria_idAveria'
            AND object_id = OBJECT_ID('NotificacionAveria')
        )
        DROP INDEX IX_NotificacionAveria_idAveria ON NotificacionAveria
      `);

      await queryRunner.query(
        `ALTER TABLE NotificacionAveria ALTER COLUMN idAveria int NOT NULL`,
      );

      await queryRunner.query(`
        CREATE INDEX IX_NotificacionAveria_idAveria ON NotificacionAveria (idAveria)
      `);

      await queryRunner.query(`
        CREATE UNIQUE INDEX UQ_NotificacionAveria_destinatario_averia_tipo
        ON NotificacionAveria (idUsuarioDestinatario, idAveria, tipo)
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
      try {
        await queryRunner.query(
          `ALTER TABLE "NotificacionAveria" ALTER COLUMN "idAveria" int NOT NULL`,
        );
      } catch {
        // no-op
      }
    }
  }
}
