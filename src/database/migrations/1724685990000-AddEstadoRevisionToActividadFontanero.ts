import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEstadoRevisionToActividadFontanero1724685990000
  implements MigrationInterface
{
  name = 'AddEstadoRevisionToActividadFontanero1724685990000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('ActividadFontanero');
    if (table && !table.findColumnByName('estadoRevision')) {
      await queryRunner.addColumn(
        'ActividadFontanero',
        new TableColumn({
          name: 'estadoRevision',
          type: 'varchar',
          length: '40',
          default: "'PENDIENTE'",
          isNullable: false,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('ActividadFontanero');
    if (table?.findColumnByName('estadoRevision')) {
      await queryRunner.dropColumn('ActividadFontanero', 'estadoRevision');
    }
  }
}
