import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateReposicionMaterialTables1724685500000 implements MigrationInterface {
  name = 'CreateReposicionMaterialTables1724685500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const textType = isMssql ? 'nvarchar(max)' : 'text';
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
        name: 'ReposicionMaterial',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'codigo',
            type: 'varchar',
            length: '40',
            isNullable: true,
          },
          {
            name: 'fechaGeneracion',
            type: dateTimeType,
            default: defaultDate,
            isNullable: false,
          },
          {
            name: 'origen',
            type: 'varchar',
            length: '40',
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
            name: 'idAlertaReposicion',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'idSolicitudMaterial',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'idUsuarioResponsable',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'idProveedor',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'fechaCompra',
            type: dateTimeType,
            isNullable: true,
          },
          {
            name: 'fechaRecepcion',
            type: dateTimeType,
            isNullable: true,
          },
          {
            name: 'observacion',
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
      }),
      true,
    );

    if (await queryRunner.hasTable('AlertaReposicion')) {
      await queryRunner.createForeignKey(
        'ReposicionMaterial',
        new TableForeignKey({
          name: 'FK_ReposicionMaterial_AlertaReposicion',
          columnNames: ['idAlertaReposicion'],
          referencedTableName: 'AlertaReposicion',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
          onUpdate: 'NO ACTION',
        }),
      );
    }

    if (await queryRunner.hasTable('SolicitudMaterial')) {
      await queryRunner.createForeignKey(
        'ReposicionMaterial',
        new TableForeignKey({
          name: 'FK_ReposicionMaterial_SolicitudMaterial',
          columnNames: ['idSolicitudMaterial'],
          referencedTableName: 'SolicitudMaterial',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
          onUpdate: 'NO ACTION',
        }),
      );
    }

    await queryRunner.createForeignKey(
      'ReposicionMaterial',
      new TableForeignKey({
        name: 'FK_ReposicionMaterial_Usuario_Responsable',
        columnNames: ['idUsuarioResponsable'],
        referencedTableName: 'Usuario',
        referencedColumnNames: ['idUsuario'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
    );

    if (await queryRunner.hasTable('Proveedor')) {
      await queryRunner.createForeignKey(
        'ReposicionMaterial',
        new TableForeignKey({
          name: 'FK_ReposicionMaterial_Proveedor',
          columnNames: ['idProveedor'],
          referencedTableName: 'Proveedor',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
          onUpdate: 'NO ACTION',
        }),
      );
    }

    await queryRunner.createIndices('ReposicionMaterial', [
      new TableIndex({
        name: 'IX_ReposicionMaterial_codigo',
        columnNames: ['codigo'],
      }),
      new TableIndex({
        name: 'IX_ReposicionMaterial_fechaGeneracion',
        columnNames: ['fechaGeneracion'],
      }),
      new TableIndex({
        name: 'IX_ReposicionMaterial_origen',
        columnNames: ['origen'],
      }),
      new TableIndex({
        name: 'IX_ReposicionMaterial_estado',
        columnNames: ['estado'],
      }),
      new TableIndex({
        name: 'IX_ReposicionMaterial_idUsuarioResponsable',
        columnNames: ['idUsuarioResponsable'],
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'DetalleReposicionMaterial',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'idReposicion',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'idMaterial',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'cantidad',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'observacion',
            type: 'varchar',
            length: '255',
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
            name: 'CK_DetalleReposicionMaterial_cantidad',
            expression: 'cantidad > 0',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'DetalleReposicionMaterial',
      new TableForeignKey({
        name: 'FK_DetalleReposicionMaterial_Reposicion',
        columnNames: ['idReposicion'],
        referencedTableName: 'ReposicionMaterial',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      }),
    );

    if (await queryRunner.hasTable('Material')) {
      await queryRunner.createForeignKey(
        'DetalleReposicionMaterial',
        new TableForeignKey({
          name: 'FK_DetalleReposicionMaterial_Material',
          columnNames: ['idMaterial'],
          referencedTableName: 'Material',
          referencedColumnNames: ['id'],
          onDelete: 'NO ACTION',
          onUpdate: 'NO ACTION',
        }),
      );
    }

    await queryRunner.createIndices('DetalleReposicionMaterial', [
      new TableIndex({
        name: 'IX_DetalleReposicionMaterial_idReposicion',
        columnNames: ['idReposicion'],
      }),
      new TableIndex({
        name: 'IX_DetalleReposicionMaterial_idMaterial',
        columnNames: ['idMaterial'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('DetalleReposicionMaterial')) {
      await queryRunner.dropTable('DetalleReposicionMaterial', true);
    }
    if (await queryRunner.hasTable('ReposicionMaterial')) {
      await queryRunner.dropTable('ReposicionMaterial', true);
    }
  }
}
