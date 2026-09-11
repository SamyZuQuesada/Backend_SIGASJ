import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class CreateProveedorTable1724684800000 implements MigrationInterface {
  name = 'CreateProveedorTable1724684800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    // 1. Crear tabla Proveedor
    await queryRunner.createTable(
      new Table({
        name: 'Proveedor',
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
            name: 'razonSocial',
            type: 'varchar',
            length: '200',
            isNullable: true,
          },
          {
            name: 'identificacion',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'telefono',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'correo',
            type: 'varchar',
            length: '150',
            isNullable: true,
          },
          {
            name: 'direccion',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'personaContacto',
            type: 'varchar',
            length: '150',
            isNullable: true,
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
      }),
      true,
    );

    // 2. Agregar columna foránea idProveedor en la tabla Material
    await queryRunner.addColumn(
      'Material',
      new TableColumn({
        name: 'idProveedor',
        type: 'int',
        isNullable: true,
      }),
    );

    // 3. Crear llave foránea FK_Material_Proveedor con restricción de eliminación
    await queryRunner.createForeignKey(
      'Material',
      new TableForeignKey({
        name: 'FK_Material_Proveedor',
        columnNames: ['idProveedor'],
        referencedTableName: 'Proveedor',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Eliminar llave foránea
    const table = await queryRunner.getTable('Material');
    const foreignKey = table?.foreignKeys.find(
      (fk) => fk.name === 'FK_Material_Proveedor',
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('Material', foreignKey);
    }

    // 2. Eliminar columna idProveedor
    await queryRunner.dropColumn('Material', 'idProveedor');

    // 3. Eliminar tabla Proveedor
    await queryRunner.dropTable('Proveedor', true);
  }
}
