import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateSolicitudArregloPagoTable1724686110000 implements MigrationInterface {
  name = 'CreateSolicitudArregloPagoTable1724686110000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';
    const textType = isMssql ? 'nvarchar(max)' : 'text';

    if (!(await queryRunner.hasTable('SolicitudArregloPago'))) {
      await queryRunner.createTable(
        new Table({
          name: 'SolicitudArregloPago',
          columns: [
            {
              name: 'id',
              type: 'int',
              isPrimary: true,
              isGenerated: true,
              generationStrategy: 'increment',
            },
            {
              name: 'solicitudId',
              type: 'int',
              isUnique: true,
              isNullable: false,
            },
            {
              name: 'nombre',
              type: 'varchar',
              length: '150',
              isNullable: false,
            },
            {
              name: 'cedula',
              type: 'varchar',
              length: '30',
              isNullable: false,
            },
            {
              name: 'vecinoDe',
              type: 'varchar',
              length: '200',
              isNullable: false,
            },
            {
              name: 'telefono',
              type: 'varchar',
              length: '30',
              isNullable: false,
            },
            {
              name: 'numeroCuentaServicio',
              type: 'varchar',
              length: '50',
              isNullable: false,
            },
            {
              name: 'montoPrimaInicial',
              type: 'decimal',
              precision: 12,
              scale: 2,
              isNullable: false,
            },
            {
              name: 'plazoSeleccionado',
              type: 'varchar',
              length: '50',
              isNullable: false,
            },
            {
              name: 'firma',
              type: textType,
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
              name: 'UQ_SolicitudArregloPago_solicitudId',
              columnNames: ['solicitudId'],
              isUnique: true,
            }),
            new TableIndex({
              name: 'IX_SolicitudArregloPago_cedula',
              columnNames: ['cedula'],
            }),
            new TableIndex({
              name: 'IX_SolicitudArregloPago_numeroCuentaServicio',
              columnNames: ['numeroCuentaServicio'],
            }),
          ],
        }),
        true,
      );

      await queryRunner.createForeignKey(
        'SolicitudArregloPago',
        new TableForeignKey({
          name: 'FK_SolicitudArregloPago_Solicitud',
          columnNames: ['solicitudId'],
          referencedTableName: 'Solicitud',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
          onUpdate: 'NO ACTION',
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('SolicitudArregloPago')) {
      const table = await queryRunner.getTable('SolicitudArregloPago');
      const fk = table?.foreignKeys.find(
        (f) => f.name === 'FK_SolicitudArregloPago_Solicitud',
      );
      if (fk) {
        await queryRunner.dropForeignKey('SolicitudArregloPago', fk);
      }
      await queryRunner.dropTable('SolicitudArregloPago', true);
    }
  }
}
