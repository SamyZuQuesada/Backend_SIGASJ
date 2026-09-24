import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Registro de intentos SMS de averías (PBI 2.8.2).
 * Separado del inbox interno. No se ejecuta sin autorización.
 */
export class CreateIntentoSmsAveriaTable1724685910000 implements MigrationInterface {
  name = 'CreateIntentoSmsAveriaTable1724685910000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('IntentoSmsAveria')) {
      return;
    }

    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    await queryRunner.createTable(
      new Table({
        name: 'IntentoSmsAveria',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'idAveria',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'tipoEvento',
            type: 'varchar',
            length: '80',
            isNullable: false,
          },
          {
            name: 'destinatarioClase',
            type: 'varchar',
            length: '40',
            isNullable: false,
          },
          {
            name: 'estadoEnvio',
            type: 'varchar',
            length: '30',
            isNullable: false,
          },
          {
            name: 'motivoBloqueo',
            type: 'varchar',
            length: '60',
            isNullable: false,
          },
          {
            name: 'fechaCreacion',
            type: dateTimeType,
            default: defaultDate,
            isNullable: false,
          },
        ],
      }),
      true,
    );

    if (await queryRunner.hasTable('Averia')) {
      await queryRunner.createForeignKey(
        'IntentoSmsAveria',
        new TableForeignKey({
          name: 'FK_IntentoSmsAveria_Averia',
          columnNames: ['idAveria'],
          referencedTableName: 'Averia',
          referencedColumnNames: ['id'],
          onDelete: 'NO ACTION',
          onUpdate: 'NO ACTION',
        }),
      );
    }

    await queryRunner.createIndex(
      'IntentoSmsAveria',
      new TableIndex({
        name: 'UQ_IntentoSmsAveria_averia_tipo',
        columnNames: ['idAveria', 'tipoEvento'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('IntentoSmsAveria')) {
      await queryRunner.dropTable('IntentoSmsAveria', true);
    }
  }
}
