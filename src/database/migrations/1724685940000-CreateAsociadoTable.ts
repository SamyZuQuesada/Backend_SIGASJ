import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateAsociadoTable1724685940000 implements MigrationInterface {
  name = 'CreateAsociadoTable1724685940000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    await queryRunner.createTable(
      new Table({
        name: 'Asociado',
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
            isUnique: true,
          },
          {
            name: 'correoElectronico',
            type: 'varchar',
            length: '150',
            isNullable: false,
          },
          {
            name: 'activo',
            type: isMssql ? 'bit' : 'boolean',
            default: isMssql ? 1 : true,
            isNullable: false,
          },
          {
            name: 'fechaRegistro',
            type: dateTimeType,
            default: defaultDate,
            isNullable: false,
          },
          {
            name: 'fechaInactivacion',
            type: dateTimeType,
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
      'Asociado',
      new TableIndex({
        name: 'UQ_Asociado_cedula',
        columnNames: ['cedula'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('Asociado');
    if (table) {
      const index = table.indices.find((i) => i.name === 'UQ_Asociado_cedula');
      if (index) {
        await queryRunner.dropIndex('Asociado', index);
      }
    }
    await queryRunner.dropTable('Asociado', true);
  }
}
