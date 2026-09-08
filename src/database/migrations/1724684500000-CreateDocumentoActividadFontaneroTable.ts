import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateDocumentoActividadFontaneroTable1724684500000 implements MigrationInterface {
  name = 'CreateDocumentoActividadFontaneroTable1724684500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const databaseType = queryRunner.connection.options.type;
    const dateTimeType = databaseType === 'postgres' ? 'timestamp' : 'datetime';
    const defaultDate =
      databaseType === 'postgres' ? 'CURRENT_TIMESTAMP' : 'CURRENT_TIMESTAMP';

    await queryRunner.createTable(
      new Table({
        name: 'DocumentoActividadFontanero',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'nombreOriginal', type: 'varchar', length: '255' },
          { name: 'tipoArchivo', type: 'varchar', length: '100' },
          {
            name: 'rutaReferenciaArchivo',
            type: 'varchar',
            length: '500',
          },
          { name: 'tamanio', type: 'int' },
          { name: 'idActividad', type: 'int' },
          {
            name: 'fechaCarga',
            type: dateTimeType,
            default: defaultDate,
          },
          { name: 'createdAt', type: dateTimeType, default: defaultDate },
          { name: 'updatedAt', type: dateTimeType, default: defaultDate },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'DocumentoActividadFontanero',
      new TableForeignKey({
        name: 'FK_DocumentoActividadFontanero_ActividadFontanero',
        columnNames: ['idActividad'],
        referencedTableName: 'ActividadFontanero',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createIndex(
      'DocumentoActividadFontanero',
      new TableIndex({
        name: 'IDX_DocumentoActividadFontanero_idActividad',
        columnNames: ['idActividad'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('DocumentoActividadFontanero', true);
  }
}
