import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateFormularioOficialTable1724686120000 implements MigrationInterface {
  name = 'CreateFormularioOficialTable1724686120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    if (!(await queryRunner.hasTable('FormularioOficial'))) {
      await queryRunner.createTable(
        new Table({
          name: 'FormularioOficial',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'tipoSolicitudId',
              type: 'int',
              isUnique: true,
              isNullable: false,
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
              name: 'mimeType',
              type: 'varchar',
              length: '100',
              default: "'application/pdf'",
              isNullable: false,
            },
            {
              name: 'tamano',
              type: 'int',
              isNullable: false,
            },
            {
              name: 'ubicacionArchivo',
              type: 'varchar',
              length: '255',
              isNullable: false,
            },
            {
              name: 'fechaCarga',
              type: dateTimeType,
              default: defaultDate,
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
          indices: [
            new TableIndex({
              name: 'UQ_FormularioOficial_tipoSolicitudId',
              columnNames: ['tipoSolicitudId'],
              isUnique: true,
            }),
          ],
        }),
        true,
      );

      await queryRunner.createForeignKey(
        'FormularioOficial',
        new TableForeignKey({
          name: 'FK_FormularioOficial_TipoSolicitud',
          columnNames: ['tipoSolicitudId'],
          referencedTableName: 'TipoSolicitud',
          referencedColumnNames: ['id'],
          onDelete: 'NO ACTION',
          onUpdate: 'NO ACTION',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('FormularioOficial')) {
      const table = await queryRunner.getTable('FormularioOficial');
      const fk = table?.foreignKeys.find(
        (f) => f.name === 'FK_FormularioOficial_TipoSolicitud',
      );
      if (fk) {
        await queryRunner.dropForeignKey('FormularioOficial', fk);
      }
      await queryRunner.dropTable('FormularioOficial', true);
    }
  }
}
