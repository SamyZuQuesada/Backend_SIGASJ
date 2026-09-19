import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Historial de observaciones de atención (Averia 1 — N ObservacionAveria).
 *
 * No altera `Averia.observacionesAtencion`: ese campo de texto simple se
 * conserva con los valores actuales. Esta migración no copia ni borra
 * observaciones previas almacenadas en Averia.
 */
export class CreateObservacionAveriaTable1724685700000 implements MigrationInterface {
  name = 'CreateObservacionAveriaTable1724685700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('ObservacionAveria')) {
      return;
    }

    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const textType = isMssql ? 'nvarchar' : 'varchar';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    await queryRunner.createTable(
      new Table({
        name: 'ObservacionAveria',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'idAveria',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'idUsuarioAutor',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'observacion',
            type: textType,
            length: '2000',
            isNullable: false,
          },
          {
            name: 'fechaCreacion',
            type: dateTimeType,
            default: defaultDate,
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'ObservacionAveria',
      new TableForeignKey({
        name: 'FK_ObservacionAveria_Averia',
        columnNames: ['idAveria'],
        referencedTableName: 'Averia',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createForeignKey(
      'ObservacionAveria',
      new TableForeignKey({
        name: 'FK_ObservacionAveria_Usuario_Autor',
        columnNames: ['idUsuarioAutor'],
        referencedTableName: 'Usuario',
        referencedColumnNames: ['idUsuario'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createIndex(
      'ObservacionAveria',
      new TableIndex({
        name: 'IX_ObservacionAveria_idAveria',
        columnNames: ['idAveria'],
      }),
    );

    await queryRunner.createIndex(
      'ObservacionAveria',
      new TableIndex({
        name: 'IX_ObservacionAveria_idUsuarioAutor',
        columnNames: ['idUsuarioAutor'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('ObservacionAveria');
    if (!table) {
      return;
    }

    const averiaFk = table.foreignKeys.find(
      (fk) => fk.name === 'FK_ObservacionAveria_Averia',
    );
    if (averiaFk) {
      await queryRunner.dropForeignKey('ObservacionAveria', averiaFk);
    }

    const autorFk = table.foreignKeys.find(
      (fk) => fk.name === 'FK_ObservacionAveria_Usuario_Autor',
    );
    if (autorFk) {
      await queryRunner.dropForeignKey('ObservacionAveria', autorFk);
    }

    const averiaIndex = table.indices.find(
      (index) => index.name === 'IX_ObservacionAveria_idAveria',
    );
    if (averiaIndex) {
      await queryRunner.dropIndex('ObservacionAveria', averiaIndex);
    }

    const autorIndex = table.indices.find(
      (index) => index.name === 'IX_ObservacionAveria_idUsuarioAutor',
    );
    if (autorIndex) {
      await queryRunner.dropIndex('ObservacionAveria', autorIndex);
    }

    await queryRunner.dropTable('ObservacionAveria', true);
  }
}
