import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Agrega Material.requiereFechaVencimiento.
 * Timestamp 636: 633/634/635 ya los usan inventario y formularios descargables.
 */
export class AddRequiereFechaVencimientoToMaterial1724686360000
  implements MigrationInterface
{
  name = 'AddRequiereFechaVencimientoToMaterial1724686360000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('Material'))) {
      return;
    }
    if (await queryRunner.hasColumn('Material', 'requiereFechaVencimiento')) {
      return;
    }

    if (queryRunner.connection.options.type === 'mssql') {
      await queryRunner.query(
        `ALTER TABLE [Material] ADD [requiereFechaVencimiento] bit NOT NULL CONSTRAINT [DF_Material_requiereFechaVencimiento] DEFAULT 0`,
      );
      return;
    }

    await queryRunner.addColumn(
      'Material',
      new TableColumn({
        name: 'requiereFechaVencimiento',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('Material'))) {
      return;
    }
    if (!(await queryRunner.hasColumn('Material', 'requiereFechaVencimiento'))) {
      return;
    }

    if (queryRunner.connection.options.type === 'mssql') {
      await queryRunner.query(
        `IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Material_requiereFechaVencimiento') ALTER TABLE [Material] DROP CONSTRAINT [DF_Material_requiereFechaVencimiento]`,
      );
    }

    await queryRunner.dropColumn('Material', 'requiereFechaVencimiento');
  }
}
