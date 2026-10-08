import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateColaboradorTable1724685950000 implements MigrationInterface {
  name = 'CreateColaboradorTable1724685950000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('Colaborador')) {
      return;
    }

    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    await queryRunner.createTable(
      new Table({
        name: 'Colaborador',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'nombre',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'apellidos',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'cedula',
            type: 'varchar',
            length: '30',
            isNullable: false,
          },
          {
            name: 'correoElectronico',
            type: 'varchar',
            length: '150',
            isNullable: false,
          },
          {
            name: 'cargo',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'activo',
            type: isMssql ? 'bit' : 'boolean',
            default: isMssql ? 1 : true,
            isNullable: false,
          },
          {
            name: 'usuarioId',
            type: 'int',
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
      'Colaborador',
      new TableIndex({
        name: 'UQ_Colaborador_cedula',
        columnNames: ['cedula'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'Colaborador',
      new TableIndex({
        name: 'UQ_Colaborador_usuarioId',
        columnNames: ['usuarioId'],
        isUnique: true,
        where: '"usuarioId" IS NOT NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'Colaborador',
      new TableForeignKey({
        name: 'FK_Colaborador_Usuario',
        columnNames: ['usuarioId'],
        referencedTableName: 'Usuario',
        referencedColumnNames: ['idUsuario'],
        onDelete: 'SET NULL',
        onUpdate: 'NO ACTION',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('Colaborador');
    if (!table) {
      return;
    }

    const usuarioFk = table.foreignKeys.find(
      (fk) => fk.name === 'FK_Colaborador_Usuario',
    );
    if (usuarioFk) {
      await queryRunner.dropForeignKey('Colaborador', usuarioFk);
    }

    for (const indexName of [
      'UQ_Colaborador_usuarioId',
      'UQ_Colaborador_cedula',
    ]) {
      const index = table.indices.find((i) => i.name === indexName);
      if (index) {
        await queryRunner.dropIndex('Colaborador', index);
      }
    }

    await queryRunner.dropTable('Colaborador', true);
  }
}
