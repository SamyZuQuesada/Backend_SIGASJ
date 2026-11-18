import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddLatitudLongitudToAveria1724686410000
  implements MigrationInterface
{
  name = 'AddLatitudLongitudToAveria1724686410000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('Averia'))) {
      return;
    }

    if (!(await queryRunner.hasColumn('Averia', 'latitud'))) {
      await queryRunner.addColumn(
        'Averia',
        new TableColumn({
          name: 'latitud',
          type: 'float',
          isNullable: true,
        }),
      );
    }

    if (!(await queryRunner.hasColumn('Averia', 'longitud'))) {
      await queryRunner.addColumn(
        'Averia',
        new TableColumn({
          name: 'longitud',
          type: 'float',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('Averia'))) {
      return;
    }

    if (await queryRunner.hasColumn('Averia', 'longitud')) {
      await queryRunner.dropColumn('Averia', 'longitud');
    }

    if (await queryRunner.hasColumn('Averia', 'latitud')) {
      await queryRunner.dropColumn('Averia', 'latitud');
    }
  }
}
