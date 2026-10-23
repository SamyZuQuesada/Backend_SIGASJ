import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Tabla de detalle 1:1 para «Solicitud de Afiliación».
 * Alineada con la entidad `SolicitudAfiliacion`.
 *
 * Junta Directiva (ADMIN_ONLY): sin columnas — PDF oficial no disponible;
 * no inventar campos administrativos.
 */
export class CreateSolicitudAfiliacionTable1724686160000 implements MigrationInterface {
  name = 'CreateSolicitudAfiliacionTable1724686160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';
    const textType = isMssql ? 'nvarchar(max)' : 'text';

    if (!(await queryRunner.hasTable('SolicitudAfiliacion'))) {
      await queryRunner.createTable(
        new Table({
          name: 'SolicitudAfiliacion',
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
              name: 'fechaSolicitud',
              type: 'date',
              isNullable: false,
            },
            {
              name: 'nombre',
              type: 'varchar',
              length: '150',
              isNullable: false,
            },
            {
              name: 'identificacion',
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
              name: 'estadoCivil',
              type: 'varchar',
              length: '40',
              isNullable: false,
            },
            {
              name: 'telefono',
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
              name: 'numeroAbonado',
              type: 'varchar',
              length: '50',
              isNullable: false,
            },
            {
              name: 'numeroPlano',
              type: 'varchar',
              length: '50',
              isNullable: false,
            },
            {
              name: 'folioReal',
              type: 'varchar',
              length: '50',
              isNullable: true,
            },
            {
              name: 'firmaSolicitante',
              type: textType,
              isNullable: true,
            },
            {
              name: 'recomendacion1Nombre',
              type: 'varchar',
              length: '150',
              isNullable: false,
            },
            {
              name: 'recomendacion1Identificacion',
              type: 'varchar',
              length: '30',
              isNullable: false,
            },
            {
              name: 'recomendacion1NumeroAbonado',
              type: 'varchar',
              length: '50',
              isNullable: false,
            },
            {
              name: 'recomendacion1Firma',
              type: textType,
              isNullable: true,
            },
            {
              name: 'recomendacion2Nombre',
              type: 'varchar',
              length: '150',
              isNullable: false,
            },
            {
              name: 'recomendacion2Identificacion',
              type: 'varchar',
              length: '30',
              isNullable: false,
            },
            {
              name: 'recomendacion2NumeroAbonado',
              type: 'varchar',
              length: '50',
              isNullable: false,
            },
            {
              name: 'recomendacion2Firma',
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
              name: 'UQ_SolicitudAfiliacion_solicitudId',
              columnNames: ['solicitudId'],
              isUnique: true,
            }),
            new TableIndex({
              name: 'IX_SolicitudAfiliacion_identificacion',
              columnNames: ['identificacion'],
            }),
            new TableIndex({
              name: 'IX_SolicitudAfiliacion_numeroAbonado',
              columnNames: ['numeroAbonado'],
            }),
          ],
        }),
        true,
      );

      await queryRunner.createForeignKey(
        'SolicitudAfiliacion',
        new TableForeignKey({
          name: 'FK_SolicitudAfiliacion_Solicitud',
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
    if (await queryRunner.hasTable('SolicitudAfiliacion')) {
      const table = await queryRunner.getTable('SolicitudAfiliacion');
      const fk = table?.foreignKeys.find(
        (f) => f.name === 'FK_SolicitudAfiliacion_Solicitud',
      );
      if (fk) {
        await queryRunner.dropForeignKey('SolicitudAfiliacion', fk);
      }
      await queryRunner.dropTable('SolicitudAfiliacion', true);
    }
  }
}
