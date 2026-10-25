import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFechaResolucionToSolicitud1724686380000
  implements MigrationInterface
{
  name = 'AddFechaResolucionToSolicitud1724686380000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('Solicitud');
    if (!table) {
      return;
    }

    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';

    if (!table.findColumnByName('fechaResolucion')) {
      await queryRunner.addColumn(
        'Solicitud',
        new TableColumn({
          name: 'fechaResolucion',
          type: dateTimeType,
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('Solicitud');
    if (!table) {
      return;
    }
    if (table.findColumnByName('fechaResolucion')) {
      await queryRunner.dropColumn('Solicitud', 'fechaResolucion');
    }
  }
}
