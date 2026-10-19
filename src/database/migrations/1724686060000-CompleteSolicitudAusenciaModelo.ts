import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

/**
 * PBI 6.5.1: completa el modelo SolicitudAusencia en bases que ya tenían
 * la tabla inicial (observaciones + FK del revisor a Usuario).
 */
export class CompleteSolicitudAusenciaModelo1724686060000 implements MigrationInterface {
  name = 'CompleteSolicitudAusenciaModelo1724686060000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('SolicitudAusencia'))) {
      return;
    }

    const table = await queryRunner.getTable('SolicitudAusencia');

    if (table && !table.findColumnByName('observaciones')) {
      await queryRunner.addColumn(
        'SolicitudAusencia',
        new TableColumn({
          name: 'observaciones',
          type: 'varchar',
          length: '500',
          isNullable: true,
        }),
      );
    }

    const refreshed = await queryRunner.getTable('SolicitudAusencia');
    const hasRevisorFk = refreshed?.foreignKeys.some(
      (fk) => fk.name === 'FK_SolicitudAusencia_UsuarioRevisor',
    );
    if (
      refreshed?.findColumnByName('reviewedByUsuarioId') &&
      !hasRevisorFk &&
      (await queryRunner.hasTable('Usuario'))
    ) {
      await queryRunner.createForeignKey(
        'SolicitudAusencia',
        new TableForeignKey({
          name: 'FK_SolicitudAusencia_UsuarioRevisor',
          columnNames: ['reviewedByUsuarioId'],
          referencedTableName: 'Usuario',
          referencedColumnNames: ['idUsuario'],
          onDelete: 'SET NULL',
          onUpdate: 'NO ACTION',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('SolicitudAusencia'))) {
      return;
    }

    const table = await queryRunner.getTable('SolicitudAusencia');
    const revisorFk = table?.foreignKeys.find(
      (fk) => fk.name === 'FK_SolicitudAusencia_UsuarioRevisor',
    );
    if (revisorFk) {
      await queryRunner.dropForeignKey('SolicitudAusencia', revisorFk);
    }

    const refreshed = await queryRunner.getTable('SolicitudAusencia');
    if (refreshed?.findColumnByName('observaciones')) {
      await queryRunner.dropColumn('SolicitudAusencia', 'observaciones');
    }
  }
}
