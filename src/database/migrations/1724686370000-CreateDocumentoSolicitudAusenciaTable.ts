import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Evidencia adjunta a SolicitudAusencia (PDF/JPG/PNG).
 * Timestamp 637: 634 ya crea FormularioDescargable.
 */
export class CreateDocumentoSolicitudAusenciaTable1724686370000
  implements MigrationInterface
{
  name = 'CreateDocumentoSolicitudAusenciaTable1724686370000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('DocumentoSolicitudAusencia')) {
      return;
    }

    const isMssql = queryRunner.connection.options.type === 'mssql';
    const intType = isMssql ? 'int' : 'integer';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    await queryRunner.createTable(
      new Table({
        name: 'DocumentoSolicitudAusencia',
        columns: [
          {
            name: 'id',
            type: intType,
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'solicitudId', type: intType, isNullable: false },
          {
            name: 'nombreOriginal',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'tipoArchivo',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'rutaReferenciaArchivo',
            type: 'varchar',
            length: '500',
            isNullable: false,
          },
          { name: 'tamanio', type: intType, isNullable: false },
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
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'DocumentoSolicitudAusencia',
      new TableForeignKey({
        name: 'FK_DocumentoSolicitudAusencia_SolicitudAusencia',
        columnNames: ['solicitudId'],
        referencedTableName: 'SolicitudAusencia',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createIndex(
      'DocumentoSolicitudAusencia',
      new TableIndex({
        name: 'IX_DocumentoSolicitudAusencia_solicitudId',
        columnNames: ['solicitudId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('DocumentoSolicitudAusencia')) {
      await queryRunner.dropTable('DocumentoSolicitudAusencia', true);
    }
  }
}
