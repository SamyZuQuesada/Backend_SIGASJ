import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class CreateCategoriaMaterialTable1724684700000 implements MigrationInterface {
  name = 'CreateCategoriaMaterialTable1724684700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    // 1. Crear tabla CategoriaMaterial
    await queryRunner.createTable(
      new Table({
        name: 'CategoriaMaterial',
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
            isUnique: true,
          },
          {
            name: 'descripcion',
            type: 'varchar',
            length: '500',
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

    // 2. Agregar columna foránea idCategoria en la tabla Material
    await queryRunner.addColumn(
      'Material',
      new TableColumn({
        name: 'idCategoria',
        type: 'int',
        isNullable: true,
      }),
    );

    // 3. Crear llave foránea FK_Material_CategoriaMaterial
    await queryRunner.createForeignKey(
      'Material',
      new TableForeignKey({
        name: 'FK_Material_CategoriaMaterial',
        columnNames: ['idCategoria'],
        referencedTableName: 'CategoriaMaterial',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Eliminar llave foránea
    const table = await queryRunner.getTable('Material');
    const foreignKey = table?.foreignKeys.find(
      (fk) => fk.name === 'FK_Material_CategoriaMaterial',
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey('Material', foreignKey);
    }

    // 2. Eliminar columna idCategoria
    await queryRunner.dropColumn('Material', 'idCategoria');

    // 3. Eliminar tabla CategoriaMaterial
    await queryRunner.dropTable('CategoriaMaterial', true);
  }
}
