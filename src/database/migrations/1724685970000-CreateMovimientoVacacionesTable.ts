import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Historial de vacaciones por colaborador. Cada fila es un movimiento
 * ACUMULADO o DISFRUTADO; el saldo se deriva sumando el historial.
 */
export class CreateMovimientoVacacionesTable1724685970000 implements MigrationInterface {
  name = 'CreateMovimientoVacacionesTable1724685970000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('MovimientoVacaciones')) {
      return;
    }

    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    await queryRunner.createTable(
      new Table({
        name: 'MovimientoVacaciones',
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
            name: 'tipo',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'cantidadDias',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'fecha',
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
        ],
        checks: [
          {
            name: 'CK_MovimientoVacaciones_Tipo',
            expression: "tipo IN ('ACUMULADO', 'DISFRUTADO')",
          },
          {
            name: 'CK_MovimientoVacaciones_CantidadDias',
            expression: 'cantidadDias > 0',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'MovimientoVacaciones',
      new TableIndex({
        name: 'IX_MovimientoVacaciones_colaboradorId',
        columnNames: ['colaboradorId'],
      }),
    );

    await queryRunner.createIndex(
      'MovimientoVacaciones',
      new TableIndex({
        name: 'IX_MovimientoVacaciones_colaborador_fecha',
        columnNames: ['colaboradorId', 'fecha'],
      }),
    );

    await queryRunner.createForeignKey(
      'MovimientoVacaciones',
      new TableForeignKey({
        name: 'FK_MovimientoVacaciones_Colaborador',
        columnNames: ['colaboradorId'],
        referencedTableName: 'Colaborador',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('MovimientoVacaciones');
    if (!table) {
      return;
    }

    const colaboradorFk = table.foreignKeys.find(
      (fk) => fk.name === 'FK_MovimientoVacaciones_Colaborador',
    );
    if (colaboradorFk) {
      await queryRunner.dropForeignKey('MovimientoVacaciones', colaboradorFk);
    }

    for (const indexName of [
      'IX_MovimientoVacaciones_colaborador_fecha',
      'IX_MovimientoVacaciones_colaboradorId',
    ]) {
      const index = table.indices.find((i) => i.name === indexName);
      if (index) {
        await queryRunner.dropIndex('MovimientoVacaciones', index);
      }
    }

    await queryRunner.dropTable('MovimientoVacaciones', true);
  }
}
