import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Correo indicado por el Fontanero al solicitar (notificación al aprobar).
 */
export class AddCorreoNotificacionToSolicitudAusencia1724686070000
  implements MigrationInterface
{
  name = 'AddCorreoNotificacionToSolicitudAusencia1724686070000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('SolicitudAusencia'))) {
      return;
    }
    const table = await queryRunner.getTable('SolicitudAusencia');
    if (table?.findColumnByName('correoNotificacion')) {
      return;
    }
    await queryRunner.addColumn(
      'SolicitudAusencia',
      new TableColumn({
        name: 'correoNotificacion',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('SolicitudAusencia'))) {
      return;
    }
    const table = await queryRunner.getTable('SolicitudAusencia');
    if (!table?.findColumnByName('correoNotificacion')) {
      return;
    }
    await queryRunner.dropColumn('SolicitudAusencia', 'correoNotificacion');
  }
}
