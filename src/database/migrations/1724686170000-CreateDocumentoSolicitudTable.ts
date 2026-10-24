import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateDocumentoSolicitudTable1724686170000 implements MigrationInterface {
  name = 'CreateDocumentoSolicitudTable1724686170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('DocumentoSolicitud')) {
      return;
    }

    const databaseType = queryRunner.connection.options.type;
    const dateTimeType = databaseType === 'postgres' ? 'timestamp' : 'datetime';
    const defaultDate = 'CURRENT_TIMESTAMP';

    await queryRunner.createTable(
      new Table({
        name: 'DocumentoSolicitud',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'solicitudId', type: 'int', isNullable: true },
          { name: 'tipoDocumento', type: 'varchar', length: '40' },
          { name: 'nombreOriginal', type: 'varchar', length: '255' },
          {
            name: 'nombreInterno',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'mimeType',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          { name: 'tipoArchivo', type: 'varchar', length: '100' },
          {
            name: 'tamano',
            type: 'int',
            isNullable: true,
          },
          { name: 'tamanio', type: 'int' },
          {
            name: 'ubicacion',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'rutaReferenciaArchivo',
            type: 'varchar',
            length: '500',
          },
          { name: 'tokenReclamo', type: 'varchar', length: '64' },
          {
            name: 'fechaCarga',
            type: dateTimeType,
            default: defaultDate,
          },
          {
            name: 'createdAt',
            type: dateTimeType,
            default: defaultDate,
          },
          {
            name: 'updatedAt',
            type: dateTimeType,
            default: defaultDate,
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'DocumentoSolicitud',
      new TableForeignKey({
        name: 'FK_DocumentoSolicitud_Solicitud',
        columnNames: ['solicitudId'],
        referencedTableName: 'Solicitud',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createIndex(
      'DocumentoSolicitud',
      new TableIndex({
        name: 'IX_DocumentoSolicitud_solicitudId',
        columnNames: ['solicitudId'],
      }),
    );

    await queryRunner.createIndex(
      'DocumentoSolicitud',
      new TableIndex({
        name: 'UQ_DocumentoSolicitud_tokenReclamo',
        columnNames: ['tokenReclamo'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'DocumentoSolicitud',
      new TableIndex({
        name: 'IX_DocumentoSolicitud_nombreInterno',
        columnNames: ['nombreInterno'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('DocumentoSolicitud')) {
      const table = await queryRunner.getTable('DocumentoSolicitud');
      const fk = table?.foreignKeys.find(
        (f) => f.name === 'FK_DocumentoSolicitud_Solicitud',
      );
      if (fk) {
        await queryRunner.dropForeignKey('DocumentoSolicitud', fk);
      }
      await queryRunner.dropTable('DocumentoSolicitud', true);
    }
  }
}
