import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddIdReposicionToMovimientoInventario1724685600000 implements MigrationInterface {
  name = 'AddIdReposicionToMovimientoInventario1724685600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn(
      'MovimientoInventario',
      'idReposicion',
    );
    if (!hasColumn) {
      await queryRunner.addColumn(
        'MovimientoInventario',
        new TableColumn({
          name: 'idReposicion',
          type: 'int',
          isNullable: true,
        }),
      );
    }

    const table = await queryRunner.getTable('MovimientoInventario');
    const usaIdReposicion = (columnNames: string[]) =>
      columnNames.length === 1 && columnNames[0] === 'idReposicion';

    if (!table?.foreignKeys.some((fk) => usaIdReposicion(fk.columnNames))) {
      await queryRunner.createForeignKey(
        'MovimientoInventario',
        new TableForeignKey({
          name: 'FK_MovimientoInventario_ReposicionMaterial',
          columnNames: ['idReposicion'],
          referencedTableName: 'ReposicionMaterial',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
          onUpdate: 'NO ACTION',
        }),
      );
    }

    if (!table?.indices.some((index) => usaIdReposicion(index.columnNames))) {
      await queryRunner.createIndex(
        'MovimientoInventario',
        new TableIndex({
          name: 'IX_MovimientoInventario_idReposicion',
          columnNames: ['idReposicion'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('MovimientoInventario');
    if (!table) {
      return;
    }

    const index = table.indices.find(
      (i) => i.name === 'IX_MovimientoInventario_idReposicion',
    );
    if (index) {
      await queryRunner.dropIndex('MovimientoInventario', index);
    }

    const fk = table.foreignKeys.find(
      (f) => f.name === 'FK_MovimientoInventario_ReposicionMaterial',
    );
    if (fk) {
      await queryRunner.dropForeignKey('MovimientoInventario', fk);
    }

    const hasColumn = await queryRunner.hasColumn(
      'MovimientoInventario',
      'idReposicion',
    );
    if (hasColumn) {
      await queryRunner.dropColumn('MovimientoInventario', 'idReposicion');
    }
  }
}
