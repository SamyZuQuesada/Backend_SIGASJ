import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Inbox interno de averías (PBI 2.8.1).
 * No se ejecuta en esta entrega sin autorización.
 */
export class CreateNotificacionAveriaTable1724685900000 implements MigrationInterface {
  name = 'CreateNotificacionAveriaTable1724685900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('NotificacionAveria')) {
      return;
    }

    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const boolType = isMssql ? 'bit' : 'boolean';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';
    const defaultFalse = isMssql ? '0' : 'false';

    await queryRunner.createTable(
      new Table({
        name: 'NotificacionAveria',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'idUsuarioDestinatario',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'idAveria',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'tipo',
            type: 'varchar',
            length: '80',
            isNullable: false,
          },
          {
            name: 'titulo',
            type: 'varchar',
            length: '180',
            isNullable: false,
          },
          {
            name: 'mensaje',
            type: 'varchar',
            length: '400',
            isNullable: false,
          },
          {
            name: 'leida',
            type: boolType,
            default: defaultFalse,
            isNullable: false,
          },
          {
            name: 'fechaLectura',
            type: dateTimeType,
            isNullable: true,
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

    if (await queryRunner.hasTable('Usuario')) {
      await queryRunner.createForeignKey(
        'NotificacionAveria',
        new TableForeignKey({
          name: 'FK_NotificacionAveria_Usuario',
          columnNames: ['idUsuarioDestinatario'],
          referencedTableName: 'Usuario',
          referencedColumnNames: ['idUsuario'],
          onDelete: 'NO ACTION',
          onUpdate: 'NO ACTION',
        }),
      );
    }

    if (await queryRunner.hasTable('Averia')) {
      await queryRunner.createForeignKey(
        'NotificacionAveria',
        new TableForeignKey({
          name: 'FK_NotificacionAveria_Averia',
          columnNames: ['idAveria'],
          referencedTableName: 'Averia',
          referencedColumnNames: ['id'],
          onDelete: 'NO ACTION',
          onUpdate: 'NO ACTION',
        }),
      );
    }

    await queryRunner.createIndex(
      'NotificacionAveria',
      new TableIndex({
        name: 'IX_NotificacionAveria_idUsuarioDestinatario',
        columnNames: ['idUsuarioDestinatario'],
      }),
    );
    await queryRunner.createIndex(
      'NotificacionAveria',
      new TableIndex({
        name: 'IX_NotificacionAveria_idAveria',
        columnNames: ['idAveria'],
      }),
    );
    await queryRunner.createIndex(
      'NotificacionAveria',
      new TableIndex({
        name: 'UQ_NotificacionAveria_destinatario_averia_tipo',
        columnNames: ['idUsuarioDestinatario', 'idAveria', 'tipo'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('NotificacionAveria')) {
      await queryRunner.dropTable('NotificacionAveria', true);
    }
  }
}
