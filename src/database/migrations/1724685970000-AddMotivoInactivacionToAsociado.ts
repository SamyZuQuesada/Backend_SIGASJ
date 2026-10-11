import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/** PBI 5.4.3: motivo registrado al inactivar un asociado (NULL mientras esté activo). */
export class AddMotivoInactivacionToAsociado1724685970000 implements MigrationInterface {
  name = 'AddMotivoInactivacionToAsociado1724685970000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('Asociado', 'motivoInactivacion')) {
      return;
    }

    await queryRunner.addColumn(
      'Asociado',
      new TableColumn({
        name: 'motivoInactivacion',
        type: 'varchar',
        length: '500',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('Asociado', 'motivoInactivacion')) {
      await queryRunner.dropColumn('Asociado', 'motivoInactivacion');
    }
  }
}
