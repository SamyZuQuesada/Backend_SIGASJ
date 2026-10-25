import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Catálogo de formularios adicionales descargables (público).
 * Archivo: referencia relativa (nombre original/interno + ubicacionArchivo),
 * alineado con FormularioOficial; sin binario ni rutas físicas absolutas.
 */
export class CreateFormularioDescargableTable1724686340000 implements MigrationInterface {
  name = 'CreateFormularioDescargableTable1724686340000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('FormularioDescargable')) {
      return;
    }

    const isMssql = queryRunner.connection.options.type === 'mssql';
    const intType = isMssql ? 'int' : 'integer';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const textType = isMssql ? 'nvarchar' : 'varchar';
    const boolType = isMssql ? 'bit' : 'boolean';
    const defaultDate = isMssql ? 'SYSUTCDATETIME()' : 'CURRENT_TIMESTAMP';
    const defaultActivo = isMssql ? 0 : false;

    await queryRunner.createTable(
      new Table({
        name: 'FormularioDescargable',
        columns: [
          {
            name: 'id',
            type: intType,
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'nombre',
            type: textType,
            length: '200',
            isNullable: false,
          },
          {
            name: 'descripcion',
            type: textType,
            length: '1000',
            isNullable: true,
          },
          {
            name: 'nombreArchivoOriginal',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'nombreArchivoInterno',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'ubicacionArchivo',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'activo',
            type: boolType,
            default: defaultActivo,
            isNullable: false,
          },
          {
            name: 'fechaPublicacion',
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

    // Consultas públicas típicas: WHERE activo = 1 (catálogo descargable).
    await queryRunner.createIndex(
      'FormularioDescargable',
      new TableIndex({
        name: 'IX_FormularioDescargable_activo',
        columnNames: ['activo'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('FormularioDescargable'))) {
      return;
    }

    const table = await queryRunner.getTable('FormularioDescargable');
    const index = table?.indices.find(
      (i) => i.name === 'IX_FormularioDescargable_activo',
    );
    if (index) {
      await queryRunner.dropIndex('FormularioDescargable', index);
    }

    await queryRunner.dropTable('FormularioDescargable', true);
  }
}
