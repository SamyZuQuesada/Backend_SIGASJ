import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * precioUnitario y fechaVencimiento se agregaron a la entidad Material
 * sin una migración versionada. Wuipy las señaló como migraciones locales
 * 620/622 que no estaban en el repositorio. 620 ya quedó reservada para
 * requiereFechaVencimiento, así que estas columnas viajan en 621.
 */
export class AddPrecioUnitarioYFechaVencimientoToMaterial1724686210000
  implements MigrationInterface
{
  name = 'AddPrecioUnitarioYFechaVencimientoToMaterial1724686210000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('Material'))) {
      return;
    }

    if (!(await queryRunner.hasColumn('Material', 'precioUnitario'))) {
      await queryRunner.addColumn(
        'Material',
        new TableColumn({
          name: 'precioUnitario',
          type: 'decimal',
          precision: 12,
          scale: 2,
          isNullable: true,
        }),
      );
    }

    if (!(await queryRunner.hasColumn('Material', 'fechaVencimiento'))) {
      const isMssql = queryRunner.connection.options.type === 'mssql';
      await queryRunner.addColumn(
        'Material',
        new TableColumn({
          name: 'fechaVencimiento',
          type: isMssql ? 'datetime2' : 'datetime',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('Material'))) {
      return;
    }

    if (await queryRunner.hasColumn('Material', 'fechaVencimiento')) {
      await queryRunner.dropColumn('Material', 'fechaVencimiento');
    }
    if (await queryRunner.hasColumn('Material', 'precioUnitario')) {
      await queryRunner.dropColumn('Material', 'precioUnitario');
    }
  }
}
