import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateAlertaReposicionTable1724685400000 implements MigrationInterface {
  name = 'CreateAlertaReposicionTable1724685400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    if (!(await queryRunner.hasTable('Usuario'))) {
      if (isMssql) {
        await queryRunner.query(`
          CREATE TABLE Usuario (
            idUsuario INT IDENTITY(1,1) NOT NULL PRIMARY KEY
          )
        `);
      } else {
        await queryRunner.query(`
          CREATE TABLE Usuario (
            idUsuario INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL
          )
        `);
      }
    }

    await queryRunner.createTable(
      new Table({
        name: 'AlertaReposicion',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'idMaterial',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'stockActual',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'stockMinimo',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'estado',
            type: 'varchar',
            length: '30',
            default: "'PENDIENTE'",
            isNullable: false,
          },
          {
            name: 'fechaGeneracion',
            type: dateTimeType,
            default: defaultDate,
            isNullable: false,
          },
          {
            name: 'idUsuarioGestiona',
            type: 'int',
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
        checks: [
          {
            name: 'CK_AlertaReposicion_stockActual',
            expression: 'stockActual >= 0',
          },
          {
            name: 'CK_AlertaReposicion_stockMinimo',
            expression: 'stockMinimo >= 0',
          },
        ],
      }),
      true,
    );

    if (await queryRunner.hasTable('Material')) {
      await queryRunner.createForeignKey(
        'AlertaReposicion',
        new TableForeignKey({
          name: 'FK_AlertaReposicion_Material',
          columnNames: ['idMaterial'],
          referencedTableName: 'Material',
          referencedColumnNames: ['id'],
          onDelete: 'NO ACTION',
          onUpdate: 'NO ACTION',
        }),
      );
    }

    await queryRunner.createForeignKey(
      'AlertaReposicion',
      new TableForeignKey({
        name: 'FK_AlertaReposicion_Usuario_Gestiona',
        columnNames: ['idUsuarioGestiona'],
        referencedTableName: 'Usuario',
        referencedColumnNames: ['idUsuario'],
        onDelete: 'SET NULL',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createIndices('AlertaReposicion', [
      new TableIndex({
        name: 'IX_AlertaReposicion_idMaterial',
        columnNames: ['idMaterial'],
      }),
      new TableIndex({
        name: 'IX_AlertaReposicion_estado',
        columnNames: ['estado'],
      }),
      new TableIndex({
        name: 'IX_AlertaReposicion_fechaGeneracion',
        columnNames: ['fechaGeneracion'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('AlertaReposicion')) {
      await queryRunner.dropTable('AlertaReposicion', true);
    }
  }
}
