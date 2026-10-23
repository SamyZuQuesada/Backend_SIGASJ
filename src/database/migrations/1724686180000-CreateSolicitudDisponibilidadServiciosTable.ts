import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Tabla de detalle 1:1 para
 * «Constancia de Disponibilidad de Servicios».
 * Alineada con la entidad `SolicitudDisponibilidadServicios`.
 *
 * Catálogo completo de propósitos / unidades área-caudal / condición de
 * numeroDisponibilidadAnterior: BLOCKED (PDF oficial ausente).
 */
export class CreateSolicitudDisponibilidadServiciosTable1724686180000 implements MigrationInterface {
  name = 'CreateSolicitudDisponibilidadServiciosTable1724686180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';
    const textType = isMssql ? 'nvarchar(max)' : 'text';
    const boolType = isMssql ? 'bit' : 'boolean';

    if (!(await queryRunner.hasTable('SolicitudDisponibilidadServicios'))) {
      await queryRunner.createTable(
        new Table({
          name: 'SolicitudDisponibilidadServicios',
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
              name: 'primerApellidoFisica',
              type: 'varchar',
              length: '100',
              isNullable: true,
            },
            {
              name: 'segundoApellidoFisica',
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
              name: 'identificacionJuridica',
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
              name: 'nis',
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
              name: 'proposito',
              type: 'varchar',
              length: '120',
              isNullable: false,
            },
            {
              name: 'numeroDisponibilidadAnterior',
              type: 'varchar',
              length: '50',
              isNullable: true,
            },
            {
              name: 'descripcionProyecto',
              type: 'varchar',
              length: '2000',
              isNullable: true,
            },
            {
              name: 'cantidadDormitorios',
              type: 'int',
              isNullable: true,
            },
            {
              name: 'unidadesHabitacionales',
              type: 'int',
              isNullable: true,
            },
            {
              name: 'areaConstruccion',
              type: 'decimal',
              precision: 12,
              scale: 2,
              isNullable: true,
            },
            {
              name: 'niveles',
              type: 'int',
              isNullable: true,
            },
            {
              name: 'caudalRequerido',
              type: 'decimal',
              precision: 12,
              scale: 4,
              isNullable: true,
            },
            {
              name: 'autorizacionInspeccion',
              type: boolType,
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
              name: 'UQ_SolicitudDisponibilidadServicios_solicitudId',
              columnNames: ['solicitudId'],
              isUnique: true,
            }),
            new TableIndex({
              name: 'IX_SolicitudDisponibilidadServicios_nis',
              columnNames: ['nis'],
            }),
            new TableIndex({
              name: 'IX_SolicitudDisponibilidadServicios_proposito',
              columnNames: ['proposito'],
            }),
          ],
        }),
        true,
      );

      await queryRunner.createForeignKey(
        'SolicitudDisponibilidadServicios',
        new TableForeignKey({
          name: 'FK_SolicitudDisponibilidadServicios_Solicitud',
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
    if (await queryRunner.hasTable('SolicitudDisponibilidadServicios')) {
      const table = await queryRunner.getTable(
        'SolicitudDisponibilidadServicios',
      );
      const fk = table?.foreignKeys.find(
        (f) => f.name === 'FK_SolicitudDisponibilidadServicios_Solicitud',
      );
      if (fk) {
        await queryRunner.dropForeignKey(
          'SolicitudDisponibilidadServicios',
          fk,
        );
      }
      await queryRunner.dropTable('SolicitudDisponibilidadServicios', true);
    }
  }
}
