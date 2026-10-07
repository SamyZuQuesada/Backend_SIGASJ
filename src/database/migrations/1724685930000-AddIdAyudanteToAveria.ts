import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddIdAyudanteToAveria1724685930000 implements MigrationInterface {
  name = 'AddIdAyudanteToAveria1724685930000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('Averia', 'idAyudante');
    if (hasColumn) {
      return;
    }

    await queryRunner.addColumn(
      'Averia',
      new TableColumn({
        name: 'idAyudante',
        type: 'int',
        isNullable: true,
      }),
    );

    await queryRunner.createForeignKey(
      'Averia',
      new TableForeignKey({
        name: 'FK_Averia_Usuario_Ayudante',
        columnNames: ['idAyudante'],
        referencedTableName: 'Usuario',
        referencedColumnNames: ['idUsuario'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createIndex(
      'Averia',
      new TableIndex({
        name: 'IX_Averia_idAyudante',
        columnNames: ['idAyudante'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('Averia');
    if (!table) {
      return;
    }

    const index = table.indices.find((i) => i.name === 'IX_Averia_idAyudante');
    if (index) {
      await queryRunner.dropIndex('Averia', index);
    }

    const fk = table.foreignKeys.find(
      (f) => f.name === 'FK_Averia_Usuario_Ayudante',
    );
    if (fk) {
      await queryRunner.dropForeignKey('Averia', fk);
    }

    if (await queryRunner.hasColumn('Averia', 'idAyudante')) {
      await queryRunner.dropColumn('Averia', 'idAyudante');
    }
  }
}
