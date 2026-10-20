import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateSolicitudTable1724686100000 implements MigrationInterface {
  name = 'CreateSolicitudTable1724686100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    if (!(await queryRunner.hasTable('Solicitud'))) {
      await queryRunner.createTable(
        new Table({
          name: 'Solicitud',
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
              isNullable: false,
            },
            {
              name: 'codigoSeguimiento',
              type: 'varchar',
              length: '50',
              isUnique: true,
              isNullable: false,
            },
            {
              name: 'estado',
              type: 'varchar',
              length: '30',
              default: "'PENDIENTE'",
              isNullable: false,
            },
            {
              name: 'fechaIngreso',
              type: dateTimeType,
              default: defaultDate,
              isNullable: false,
            },
            {
              name: 'deletedAt',
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
          indices: [
            new TableIndex({
              name: 'UQ_Solicitud_codigoSeguimiento',
              columnNames: ['codigoSeguimiento'],
              isUnique: true,
            }),
            new TableIndex({
              name: 'IX_Solicitud_tipoSolicitudId',
              columnNames: ['tipoSolicitudId'],
            }),
            new TableIndex({
              name: 'IX_Solicitud_estado',
              columnNames: ['estado'],
            }),
            new TableIndex({
              name: 'IX_Solicitud_fechaIngreso',
              columnNames: ['fechaIngreso'],
            }),
          ],
        }),
        true,
      );

      await queryRunner.createForeignKey(
        'Solicitud',
        new TableForeignKey({
          name: 'FK_Solicitud_TipoSolicitud',
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
    if (await queryRunner.hasTable('Solicitud')) {
      const table = await queryRunner.getTable('Solicitud');
      const fk = table?.foreignKeys.find(
        (f) => f.name === 'FK_Solicitud_TipoSolicitud',
      );
      if (fk) {
        await queryRunner.dropForeignKey('Solicitud', fk);
      }
      await queryRunner.dropTable('Solicitud', true);
    }
  }
}
