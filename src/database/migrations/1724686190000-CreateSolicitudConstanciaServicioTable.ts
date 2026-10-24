import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Tabla de detalle 1:1 para «Constancia de Servicio Existente».
 * Alineada con la entidad `SolicitudConstanciaServicio`.
 */
export class CreateSolicitudConstanciaServicioTable1724686190000 implements MigrationInterface {
  name = 'CreateSolicitudConstanciaServicioTable1724686190000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';
    const textType = isMssql ? 'nvarchar(max)' : 'text';

    if (!(await queryRunner.hasTable('SolicitudConstanciaServicio'))) {
      await queryRunner.createTable(
        new Table({
          name: 'SolicitudConstanciaServicio',
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
              name: 'tipoServicio',
              type: 'varchar',
              length: '100',
              isNullable: false,
            },
            {
              name: 'nis',
              type: 'varchar',
              length: '50',
              isNullable: false,
            },
            {
              name: 'propietarioInmueble',
              type: 'varchar',
              length: '150',
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
              name: 'correoElectronico',
              type: 'varchar',
              length: '150',
              isNullable: false,
            },
            {
              name: 'telefono',
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
              name: 'motivo',
              type: 'varchar',
              length: '150',
              isNullable: false,
            },
            {
              name: 'otroMotivo',
              type: 'varchar',
              length: '255',
              isNullable: true,
            },
            {
              name: 'tramitePorRealizar',
              type: 'varchar',
              length: '255',
              isNullable: true,
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
              name: 'UQ_SolicitudConstanciaServicio_solicitudId',
              columnNames: ['solicitudId'],
              isUnique: true,
            }),
            new TableIndex({
              name: 'IX_SolicitudConstanciaServicio_nis',
              columnNames: ['nis'],
            }),
            new TableIndex({
              name: 'IX_SolicitudConstanciaServicio_identificacionSolicitante',
              columnNames: ['identificacionSolicitante'],
            }),
            new TableIndex({
              name: 'IX_SolicitudConstanciaServicio_motivo',
              columnNames: ['motivo'],
            }),
          ],
        }),
        true,
      );

      await queryRunner.createForeignKey(
        'SolicitudConstanciaServicio',
        new TableForeignKey({
          name: 'FK_SolicitudConstanciaServicio_Solicitud',
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
    if (await queryRunner.hasTable('SolicitudConstanciaServicio')) {
      const table = await queryRunner.getTable('SolicitudConstanciaServicio');
      const fk = table?.foreignKeys.find(
        (f) => f.name === 'FK_SolicitudConstanciaServicio_Solicitud',
      );
      if (fk) {
        await queryRunner.dropForeignKey(
          'SolicitudConstanciaServicio',
          fk,
        );
      }
      await queryRunner.dropTable('SolicitudConstanciaServicio', true);
    }
  }
}
