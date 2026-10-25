import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Varios correos de aviso en la misma solicitud (lista separada por coma).
 */
export class WidenCorreoNotificacionSolicitudAusencia1724686310000
  implements MigrationInterface
{
  name = 'WidenCorreoNotificacionSolicitudAusencia1724686310000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('SolicitudAusencia'))) {
      return;
    }
    const table = await queryRunner.getTable('SolicitudAusencia');
    if (!table?.findColumnByName('correoNotificacion')) {
      return;
    }
    await queryRunner.changeColumn(
      'SolicitudAusencia',
      'correoNotificacion',
      new TableColumn({
        name: 'correoNotificacion',
        type: 'varchar',
        length: '500',
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
    await queryRunner.changeColumn(
      'SolicitudAusencia',
      'correoNotificacion',
      new TableColumn({
        name: 'correoNotificacion',
        type: 'varchar',
        length: '255',
        isNullable: true,
      }),
    );
  }
}
