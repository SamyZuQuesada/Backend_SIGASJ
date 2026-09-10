import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateMaterialTable1724684600000 implements MigrationInterface {
  name = 'CreateMaterialTable1724684600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const textType = isMssql ? 'nvarchar(max)' : 'text';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    await queryRunner.createTable(
      new Table({
        name: 'Material',
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
            length: '150',
            isNullable: false,
          },
          {
            name: 'descripcion',
            type: textType,
            isNullable: true,
          },
          {
            name: 'unidadMedida',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'ubicacion',
            type: 'varchar',
            length: '150',
            isNullable: true,
          },
          {
            name: 'stockMinimo',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'stockActual',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'activo',
            type: isMssql ? 'bit' : 'boolean',
            default: isMssql ? 1 : true,
            isNullable: false,
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
        checks: [
          {
            name: 'CK_Material_stockMinimo',
            expression: 'stockMinimo >= 0',
          },
          {
            name: 'CK_Material_stockActual',
            expression: 'stockActual >= 0',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('Material', true);
  }
}
