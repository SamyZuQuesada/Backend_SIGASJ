import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAdjuntosJsonToSolicitudAusencia1724686320000
  implements MigrationInterface
{
  name = 'AddAdjuntosJsonToSolicitudAusencia1724686320000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('SolicitudAusencia'))) {
      return;
    }
    const table = await queryRunner.getTable('SolicitudAusencia');
    if (table?.findColumnByName('adjuntosJson')) {
      return;
    }
    await queryRunner.addColumn(
      'SolicitudAusencia',
      new TableColumn({
        name: 'adjuntosJson',
        type: 'nvarchar(max)',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('SolicitudAusencia'))) {
      return;
    }
    const table = await queryRunner.getTable('SolicitudAusencia');
    if (!table?.findColumnByName('adjuntosJson')) {
      return;
    }
    await queryRunner.dropColumn('SolicitudAusencia', 'adjuntosJson');
  }
}
