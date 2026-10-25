import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Agrega Material.requiereFechaVencimiento.
 * Va en 631 porque main ya usa 620, 621, 622 y 623 para otras migraciones,
 * y 630 desactiva tipos de actividad. precioUnitario y fechaVencimiento
 * los cubre la 620 de main (AddPrecioUnitarioAndFechaVencimientoToInventario).
 */
export class AddRequiereFechaVencimientoToMaterial1724686310000
  implements MigrationInterface
{
  name = 'AddRequiereFechaVencimientoToMaterial1724686310000';

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
