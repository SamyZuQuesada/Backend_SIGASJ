import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateSolicitudCambioTitularTable1724686140000 implements MigrationInterface {
  name = 'CreateSolicitudCambioTitularTable1724686140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';
    const textType = isMssql ? 'nvarchar(max)' : 'text';

    if (!(await queryRunner.hasTable('SolicitudCambioTitular'))) {
      await queryRunner.createTable(
        new Table({
          name: 'SolicitudCambioTitular',
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
              name: 'nombreSolicitante',
              type: 'varchar',
              length: '150',
              isNullable: false,
            },
            {
              name: 'identificacionSolicitante',
              type: 'varchar',
              length: '30',
              isNullable: false,
            },
            {
              name: 'telefono',
              type: 'varchar',
              length: '30',
              isNullable: false,
            },
            {
              name: 'nombrePropietarioRegistral',
              type: 'varchar',
              length: '150',
              isNullable: false,
            },
            {
              name: 'identificacionPropietario',
              type: 'varchar',
              length: '30',
              isNullable: false,
            },
            {
              name: 'folioReal',
              type: 'varchar',
              length: '50',
              isNullable: true,
            },
            {
              name: 'planoCatastrado',
              type: 'varchar',
              length: '50',
              isNullable: true,
            },
            {
              name: 'planoAgrimensura',
              type: 'varchar',
              length: '50',
              isNullable: true,
            },
            {
              name: 'naturalezaInmueble',
              type: 'varchar',
              length: '80',
              isNullable: false,
            },
            {
              name: 'calidadTitular',
              type: 'varchar',
              length: '80',
              isNullable: false,
            },
            {
              name: 'nis',
              type: 'varchar',
              length: '50',
              isNullable: false,
            },
            {
              name: 'facturaANombreDe',
              type: 'varchar',
              length: '150',
              isNullable: false,
            },
            {
              name: 'medioNotificacionPrincipal',
              type: 'varchar',
              length: '80',
              isNullable: false,
            },
            {
              name: 'medioNotificacionSecundario',
              type: 'varchar',
              length: '80',
              isNullable: true,
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
              name: 'UQ_SolicitudCambioTitular_solicitudId',
              columnNames: ['solicitudId'],
              isUnique: true,
            }),
            new TableIndex({
              name: 'IX_SolicitudCambioTitular_identificacionSolicitante',
              columnNames: ['identificacionSolicitante'],
            }),
            new TableIndex({
              name: 'IX_SolicitudCambioTitular_nis',
              columnNames: ['nis'],
            }),
          ],
        }),
        true,
      );

      await queryRunner.createForeignKey(
        'SolicitudCambioTitular',
        new TableForeignKey({
          name: 'FK_SolicitudCambioTitular_Solicitud',
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
    if (await queryRunner.hasTable('SolicitudCambioTitular')) {
      const table = await queryRunner.getTable('SolicitudCambioTitular');
      const fk = table?.foreignKeys.find(
        (f) => f.name === 'FK_SolicitudCambioTitular_Solicitud',
      );
      if (fk) {
        await queryRunner.dropForeignKey('SolicitudCambioTitular', fk);
      }
      await queryRunner.dropTable('SolicitudCambioTitular', true);
    }
  }
}
