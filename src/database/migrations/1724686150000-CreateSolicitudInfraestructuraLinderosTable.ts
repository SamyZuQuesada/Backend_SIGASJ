import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Tabla de detalle 1:1 para
 * «Constancia de Infraestructura Frente a Linderos de un Inmueble».
 * Alineada con la entidad `SolicitudInfraestructuraLinderos`.
 */
export class CreateSolicitudInfraestructuraLinderosTable1724686150000 implements MigrationInterface {
  name = 'CreateSolicitudInfraestructuraLinderosTable1724686150000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';
    const textType = isMssql ? 'nvarchar(max)' : 'text';

    if (!(await queryRunner.hasTable('SolicitudInfraestructuraLinderos'))) {
      await queryRunner.createTable(
        new Table({
          name: 'SolicitudInfraestructuraLinderos',
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
              name: 'nis',
              type: 'varchar',
              length: '50',
              isNullable: false,
            },
            {
              name: 'tipoPersona',
              type: 'varchar',
              length: '40',
              isNullable: false,
            },
            {
              name: 'nombreFisica',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'apellidosFisica',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'identificacionFisica',
              type: 'varchar',
              length: '30',
              isNullable: true,
            },
            {
              name: 'telefonoFisica',
              type: 'varchar',
              length: '30',
              isNullable: true,
            },
            {
              name: 'razonSocial',
              type: 'varchar',
              length: '200',
              isNullable: true,
            },
            {
              name: 'cedulaJuridica',
              type: 'varchar',
              length: '30',
              isNullable: true,
            },
            {
              name: 'nombreRepresentante',
              type: 'varchar',
              length: '150',
              isNullable: true,
            },
            {
              name: 'identificacionRepresentante',
              type: 'varchar',
              length: '30',
              isNullable: true,
            },
            {
              name: 'telefonoRepresentante',
              type: 'varchar',
              length: '30',
              isNullable: true,
            },
            {
              name: 'calidadTitular',
              type: 'varchar',
              length: '80',
              isNullable: false,
            },
            {
              name: 'provincia',
              type: 'varchar',
              length: '80',
              isNullable: false,
            },
            {
              name: 'canton',
              type: 'varchar',
              length: '80',
              isNullable: false,
            },
            {
              name: 'distrito',
              type: 'varchar',
              length: '80',
              isNullable: false,
            },
            {
              name: 'direccionExacta',
              type: 'varchar',
              length: '500',
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
              name: 'proposito',
              type: 'varchar',
              length: '120',
              isNullable: false,
            },
            {
              name: 'medioNotificacionPrincipal',
              type: 'varchar',
              length: '80',
              isNullable: false,
            },
            {
              name: 'valorNotificacionPrincipal',
              type: 'varchar',
              length: '200',
              isNullable: true,
            },
            {
              name: 'medioNotificacionSecundario',
              type: 'varchar',
              length: '80',
              isNullable: true,
            },
            {
              name: 'valorNotificacionSecundario',
              type: 'varchar',
              length: '200',
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
              name: 'UQ_SolicitudInfraestructuraLinderos_solicitudId',
              columnNames: ['solicitudId'],
              isUnique: true,
            }),
            new TableIndex({
              name: 'IX_SolicitudInfraestructuraLinderos_nis',
              columnNames: ['nis'],
            }),
          ],
        }),
        true,
      );

      await queryRunner.createForeignKey(
        'SolicitudInfraestructuraLinderos',
        new TableForeignKey({
          name: 'FK_SolicitudInfraestructuraLinderos_Solicitud',
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
    if (await queryRunner.hasTable('SolicitudInfraestructuraLinderos')) {
      const table = await queryRunner.getTable(
        'SolicitudInfraestructuraLinderos',
      );
      const fk = table?.foreignKeys.find(
        (f) => f.name === 'FK_SolicitudInfraestructuraLinderos_Solicitud',
      );
      if (fk) {
        await queryRunner.dropForeignKey(
          'SolicitudInfraestructuraLinderos',
          fk,
        );
      }
      await queryRunner.dropTable('SolicitudInfraestructuraLinderos', true);
    }
  }
}
