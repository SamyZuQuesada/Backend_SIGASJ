import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddHorarioToActividadFontanero1724686230000 implements MigrationInterface {
  name = 'AddHorarioToActividadFontanero1724686230000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('ActividadFontanero');
    if (!table) {
      return;
    }

    if (!table.findColumnByName('horaInicio')) {
      await queryRunner.addColumn(
        'ActividadFontanero',
        new TableColumn({
          name: 'horaInicio',
          type: 'varchar',
          length: '5',
          isNullable: true,
        }),
      );
    }

    if (!table.findColumnByName('fechaFin')) {
      await queryRunner.addColumn(
        'ActividadFontanero',
        new TableColumn({
          name: 'fechaFin',
          type: 'date',
          isNullable: true,
        }),
      );
    }

    if (!table.findColumnByName('horaFin')) {
      await queryRunner.addColumn(
        'ActividadFontanero',
        new TableColumn({
          name: 'horaFin',
          type: 'varchar',
          length: '5',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('ActividadFontanero');
    if (!table) {
      return;
    }
    if (table.findColumnByName('horaFin')) {
      await queryRunner.dropColumn('ActividadFontanero', 'horaFin');
    }
    if (table.findColumnByName('fechaFin')) {
      await queryRunner.dropColumn('ActividadFontanero', 'fechaFin');
    }
    if (table.findColumnByName('horaInicio')) {
      await queryRunner.dropColumn('ActividadFontanero', 'horaInicio');
    }
  }
}
