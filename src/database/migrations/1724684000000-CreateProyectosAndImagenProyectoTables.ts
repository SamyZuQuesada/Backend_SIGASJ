import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from 'typeorm';

export class CreateProyectosAndImagenProyectoTables1724684000000
  implements MigrationInterface
{
  name = 'CreateProyectosAndImagenProyectoTables1724684000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const textType = isMssql ? 'nvarchar(max)' : 'text';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    await queryRunner.createTable(
      new Table({
        name: 'Proyecto',
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
            length: '200',
            isNullable: false,
          },
          {
            name: 'descripcion',
            type: textType,
            isNullable: true,
          },
          {
            name: 'encargadoRealizacion',
            type: 'varchar',
            length: '150',
            isNullable: true,
          },
          {
            name: 'duracion',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'estado',
            type: 'varchar',
            length: '50',
            default: "'PENDIENTE'",
            isNullable: false,
          },
          {
            name: 'imagenPrincipal',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'activo',
            type: isMssql ? 'bit' : 'boolean',
            default: isMssql ? 0 : false,
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

    await queryRunner.createTable(
      new Table({
        name: 'ImagenProyecto',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'url',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          {
            name: 'descripcion',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'orden',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'proyectoId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: dateTimeType,
            default: defaultDate,
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'ImagenProyecto',
      new TableForeignKey({
        name: 'FK_ImagenProyecto_Proyecto',
        columnNames: ['proyectoId'],
        referencedTableName: 'Proyecto',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey(
      'ImagenProyecto',
      'FK_ImagenProyecto_Proyecto',
    );
    await queryRunner.dropTable('ImagenProyecto');
    await queryRunner.dropTable('Proyecto');
  }
}
