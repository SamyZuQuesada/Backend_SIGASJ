import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Textos de cambio de estado (público / interno) sobre HistorialSolicitud de main (622).
 */
export class AddObservacionesHistorialSolicitud1724686350000
  implements MigrationInterface
{
  name = 'AddObservacionesHistorialSolicitud1724686350000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('HistorialSolicitud');
    if (!table) {
      return;
    }

    const isMssql = queryRunner.connection.options.type === 'mssql';
    const textType = isMssql ? 'nvarchar' : 'varchar';

    if (!table.findColumnByName('observacionPublica')) {
      await queryRunner.addColumn(
        'HistorialSolicitud',
        new TableColumn({
          name: 'observacionPublica',
          type: textType,
          length: '1000',
          isNullable: true,
        }),
      );
    }

    if (!table.findColumnByName('notaInterna')) {
      await queryRunner.addColumn(
        'HistorialSolicitud',
        new TableColumn({
          name: 'notaInterna',
          type: textType,
          length: '1000',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('HistorialSolicitud');
    if (!table) {
      return;
    }
    if (table.findColumnByName('notaInterna')) {
      await queryRunner.dropColumn('HistorialSolicitud', 'notaInterna');
    }
    if (table.findColumnByName('observacionPublica')) {
      await queryRunner.dropColumn('HistorialSolicitud', 'observacionPublica');
    }
  }
}
