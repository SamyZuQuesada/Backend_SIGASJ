import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateIncapacidadTable1724686000000 implements MigrationInterface {
  name = 'CreateIncapacidadTable1724686000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('Incapacidad')) {
      return;
    }

    const isMssql = queryRunner.connection.options.type === 'mssql';
    const intType = isMssql ? 'int' : 'integer';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    await queryRunner.createTable(
      new Table({
        name: 'Incapacidad',
        columns: [
          {
            name: 'id',
            type: intType,
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'colaboradorId',
            type: intType,
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
      'Incapacidad',
      new TableIndex({
        name: 'IX_Incapacidad_colaboradorId',
        columnNames: ['colaboradorId'],
      }),
    );

    await queryRunner.createIndex(
      'Incapacidad',
      new TableIndex({
        name: 'IX_Incapacidad_fechas',
        columnNames: ['fechaInicio', 'fechaFin'],
      }),
    );

    await queryRunner.createForeignKey(
      'Incapacidad',
      new TableForeignKey({
        name: 'FK_Incapacidad_Colaborador',
        columnNames: ['colaboradorId'],
        referencedTableName: 'Colaborador',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('Incapacidad');
    if (!table) {
      return;
    }

    const colaboradorFk = table.foreignKeys.find(
      (fk) => fk.name === 'FK_Incapacidad_Colaborador',
    );
    if (colaboradorFk) {
      await queryRunner.dropForeignKey('Incapacidad', colaboradorFk);
    }

    for (const indexName of [
      'IX_Incapacidad_fechas',
      'IX_Incapacidad_colaboradorId',
    ]) {
      const index = table.indices.find((i) => i.name === indexName);
      if (index) {
        await queryRunner.dropIndex('Incapacidad', index);
      }
    }

    await queryRunner.dropTable('Incapacidad', true);
  }
}
