import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreatePermisoColaboradorTable1724685960000
  implements MigrationInterface
{
  name = 'CreatePermisoColaboradorTable1724685960000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('PermisoColaborador')) {
      return;
    }

    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    await queryRunner.createTable(
      new Table({
        name: 'PermisoColaborador',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'colaboradorId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'fechaInicio',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'fechaFin',
            type: 'date',
            isNullable: false,
          },
          {
            name: 'motivo',
            type: 'varchar',
            length: '200',
            isNullable: false,
          },
          {
            name: 'observaciones',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: dateTimeType,
            default: defaultDate,
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: dateTimeType,
            default: defaultDate,
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'PermisoColaborador',
      new TableIndex({
        name: 'IX_PermisoColaborador_colaboradorId',
        columnNames: ['colaboradorId'],
      }),
    );

    await queryRunner.createIndex(
      'PermisoColaborador',
      new TableIndex({
        name: 'IX_PermisoColaborador_fechas',
        columnNames: ['fechaInicio', 'fechaFin'],
      }),
    );

    await queryRunner.createForeignKey(
      'PermisoColaborador',
      new TableForeignKey({
        name: 'FK_PermisoColaborador_Colaborador',
        columnNames: ['colaboradorId'],
        referencedTableName: 'Colaborador',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('PermisoColaborador');
    if (!table) {
      return;
    }

    const colaboradorFk = table.foreignKeys.find(
      (fk) => fk.name === 'FK_PermisoColaborador_Colaborador',
    );
    if (colaboradorFk) {
      await queryRunner.dropForeignKey('PermisoColaborador', colaboradorFk);
    }

    for (const indexName of [
      'IX_PermisoColaborador_fechas',
      'IX_PermisoColaborador_colaboradorId',
    ]) {
      const index = table.indices.find((i) => i.name === indexName);
      if (index) {
        await queryRunner.dropIndex('PermisoColaborador', index);
      }
    }

    await queryRunner.dropTable('PermisoColaborador', true);
  }
}
