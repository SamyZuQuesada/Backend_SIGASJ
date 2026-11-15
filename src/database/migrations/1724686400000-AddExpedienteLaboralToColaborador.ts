import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Fase 1 expediente laboral: campos opcionales en Colaborador.
 * No backfill de fechas ficticias; registros existentes quedan con NULL.
 */
export class AddExpedienteLaboralToColaborador1724686400000
  implements MigrationInterface
{
  name = 'AddExpedienteLaboralToColaborador1724686400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('Colaborador'))) {
      return;
    }

    const table = await queryRunner.getTable('Colaborador');
    if (!table) {
      return;
    }

    const isMssql = queryRunner.connection.options.type === 'mssql';
    const smallIntType = isMssql ? 'smallint' : 'integer';

    if (!table.findColumnByName('fechaIngreso')) {
      await queryRunner.addColumn(
        'Colaborador',
        new TableColumn({
          name: 'fechaIngreso',
          type: 'varchar',
          length: '10',
          isNullable: true,
        }),
      );
    }

    if (!table.findColumnByName('jornadaLaboral')) {
      await queryRunner.addColumn(
        'Colaborador',
        new TableColumn({
          name: 'jornadaLaboral',
          type: 'varchar',
          length: '20',
          isNullable: true,
        }),
      );
    }

    if (!table.findColumnByName('diasLaboralesHabituales')) {
      await queryRunner.addColumn(
        'Colaborador',
        new TableColumn({
          name: 'diasLaboralesHabituales',
          type: smallIntType,
          isNullable: true,
        }),
      );
    }

    if (!table.findColumnByName('modalidadPago')) {
      await queryRunner.addColumn(
        'Colaborador',
        new TableColumn({
          name: 'modalidadPago',
          type: 'varchar',
          length: '20',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('Colaborador'))) {
      return;
    }

    const table = await queryRunner.getTable('Colaborador');
    if (!table) {
      return;
    }

    for (const column of [
      'modalidadPago',
      'diasLaboralesHabituales',
      'jornadaLaboral',
      'fechaIngreso',
    ]) {
      if (table.findColumnByName(column)) {
        await queryRunner.dropColumn('Colaborador', column);
      }
    }
  }
}
