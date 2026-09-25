import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Traza inmutable de eventos por avería (HistorialAveria).
 * estadoAnterior, estadoNuevo, usuario y referencia son opcionales.
 */
export class CreateHistorialAveriaTable1724685920000 implements MigrationInterface {
  name = 'CreateHistorialAveriaTable1724685920000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('HistorialAveria')) {
      return;
    }

    const isMssql = queryRunner.connection.options.type === 'mssql';
    const intType = isMssql ? 'int' : 'integer';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const textType = isMssql ? 'nvarchar' : 'varchar';
    const defaultDate = isMssql ? 'SYSUTCDATETIME()' : 'CURRENT_TIMESTAMP';

    await queryRunner.createTable(
      new Table({
        name: 'HistorialAveria',
        columns: [
          {
            name: 'id',
            type: intType,
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'idAveria',
            type: intType,
            isNullable: false,
          },
          {
            name: 'tipoEvento',
            type: 'varchar',
            length: '40',
            isNullable: false,
          },
          {
            name: 'descripcion',
            type: textType,
            length: '500',
            isNullable: false,
          },
          {
            name: 'estadoAnterior',
            type: 'varchar',
            length: '40',
            isNullable: true,
          },
          {
            name: 'estadoNuevo',
            type: 'varchar',
            length: '40',
            isNullable: true,
          },
          {
            name: 'idUsuario',
            type: intType,
            isNullable: true,
          },
          {
            name: 'fechaHora',
            type: dateTimeType,
            default: defaultDate,
            isNullable: false,
          },
          {
            name: 'referenciaTipo',
            type: 'varchar',
            length: '40',
            isNullable: true,
          },
          {
            name: 'referenciaId',
            type: intType,
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'HistorialAveria',
      new TableForeignKey({
        name: 'FK_HistorialAveria_Averia',
        columnNames: ['idAveria'],
        referencedTableName: 'Averia',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createForeignKey(
      'HistorialAveria',
      new TableForeignKey({
        name: 'FK_HistorialAveria_Usuario',
        columnNames: ['idUsuario'],
        referencedTableName: 'Usuario',
        referencedColumnNames: ['idUsuario'],
        onDelete: 'SET NULL',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createIndex(
      'HistorialAveria',
      new TableIndex({
        name: 'IX_HistorialAveria_idAveria_fechaHora',
        columnNames: ['idAveria', 'fechaHora'],
      }),
    );

    await queryRunner.createIndex(
      'HistorialAveria',
      new TableIndex({
        name: 'IX_HistorialAveria_idUsuario',
        columnNames: ['idUsuario'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('HistorialAveria');
    if (!table) {
      return;
    }

    for (const name of [
      'FK_HistorialAveria_Averia',
      'FK_HistorialAveria_Usuario',
    ]) {
      const foreignKey = table.foreignKeys.find((fk) => fk.name === name);
      if (foreignKey) {
        await queryRunner.dropForeignKey('HistorialAveria', foreignKey);
      }
    }

    for (const name of [
      'IX_HistorialAveria_idAveria_fechaHora',
      'IX_HistorialAveria_idUsuario',
    ]) {
      const index = table.indices.find((item) => item.name === name);
      if (index) {
        await queryRunner.dropIndex('HistorialAveria', index);
      }
    }

    await queryRunner.dropTable('HistorialAveria', true);
  }
}
