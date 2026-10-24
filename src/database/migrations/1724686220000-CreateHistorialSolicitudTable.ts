import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Traza inmutable de eventos por solicitud (HistorialSolicitud).
 * Registra el evento inicial de creación y futuros cambios de estado.
 */
export class CreateHistorialSolicitudTable1724686220000
  implements MigrationInterface
{
  name = 'CreateHistorialSolicitudTable1724686220000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('HistorialSolicitud')) {
      return;
    }

    const isMssql = queryRunner.connection.options.type === 'mssql';
    const intType = isMssql ? 'int' : 'integer';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const textType = isMssql ? 'nvarchar' : 'varchar';
    const defaultDate = isMssql ? 'SYSUTCDATETIME()' : 'CURRENT_TIMESTAMP';

    await queryRunner.createTable(
      new Table({
        name: 'HistorialSolicitud',
        columns: [
          {
            name: 'id',
            type: intType,
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'solicitudId',
            type: intType,
            isNullable: false,
          },
          {
            name: 'evento',
            type: 'varchar',
            length: '50',
            isNullable: false,
            default: "'REGISTRADA'",
          },
          {
            name: 'tipoEvento',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'descripcion',
            type: textType,
            length: '500',
            isNullable: true,
          },
          {
            name: 'estadoAnterior',
            type: 'varchar',
            length: '30',
            isNullable: true,
          },
          {
            name: 'estadoNuevo',
            type: 'varchar',
            length: '30',
            isNullable: false,
            default: "'PENDIENTE'",
          },
          {
            name: 'idUsuario',
            type: intType,
            isNullable: true,
          },
          {
            name: 'fechaHora',
            type: dateTimeType,
            default: defaultDate,
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'HistorialSolicitud',
      new TableForeignKey({
        name: 'FK_HistorialSolicitud_Solicitud',
        columnNames: ['solicitudId'],
        referencedTableName: 'Solicitud',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createForeignKey(
      'HistorialSolicitud',
      new TableForeignKey({
        name: 'FK_HistorialSolicitud_Usuario',
        columnNames: ['idUsuario'],
        referencedTableName: 'Usuario',
        referencedColumnNames: ['idUsuario'],
        onDelete: 'SET NULL',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createIndex(
      'HistorialSolicitud',
      new TableIndex({
        name: 'IX_HistorialSolicitud_solicitudId_fechaHora',
        columnNames: ['solicitudId', 'fechaHora'],
      }),
    );

    await queryRunner.createIndex(
      'HistorialSolicitud',
      new TableIndex({
        name: 'IX_HistorialSolicitud_solicitudId',
        columnNames: ['solicitudId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('HistorialSolicitud');
    if (!table) {
      return;
    }

    for (const name of [
      'FK_HistorialSolicitud_Solicitud',
      'FK_HistorialSolicitud_Usuario',
    ]) {
      const foreignKey = table.foreignKeys.find((fk) => fk.name === name);
      if (foreignKey) {
        await queryRunner.dropForeignKey('HistorialSolicitud', foreignKey);
      }
    }

    for (const name of [
      'IX_HistorialSolicitud_solicitudId_fechaHora',
      'IX_HistorialSolicitud_solicitudId',
    ]) {
      const index = table.indices.find((item) => item.name === name);
      if (index) {
        await queryRunner.dropIndex('HistorialSolicitud', index);
      }
    }

    await queryRunner.dropTable('HistorialSolicitud', true);
  }
}
