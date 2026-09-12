import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateSolicitudMaterialAndDetalleTables1724685200000 implements MigrationInterface {
  name = 'CreateSolicitudMaterialAndDetalleTables1724685200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const textType = isMssql ? 'nvarchar(max)' : 'text';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    // 1. Asegurar existencia de tabla Usuario para pruebas independientes
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

    // 2. Crear tabla SolicitudMaterial
    await queryRunner.createTable(
      new Table({
        name: 'SolicitudMaterial',
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
            name: 'fechaSolicitud',
            type: dateTimeType,
            default: defaultDate,
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
            name: 'observacion',
            type: textType,
            isNullable: true,
          },
          {
            name: 'idFontanero',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'idAveria',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'idUsuarioAprobador',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'fechaRevision',
            type: dateTimeType,
            isNullable: true,
          },
          {
            name: 'motivoRechazo',
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

    // 3. Foreign Keys de SolicitudMaterial
    await queryRunner.createForeignKey(
      'SolicitudMaterial',
      new TableForeignKey({
        name: 'FK_SolicitudMaterial_Usuario_Fontanero',
        columnNames: ['idFontanero'],
        referencedTableName: 'Usuario',
        referencedColumnNames: ['idUsuario'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
    );

    if (await queryRunner.hasTable('Averia')) {
      await queryRunner.createForeignKey(
        'SolicitudMaterial',
        new TableForeignKey({
          name: 'FK_SolicitudMaterial_Averia',
          columnNames: ['idAveria'],
          referencedTableName: 'Averia',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
          onUpdate: 'NO ACTION',
        }),
      );
    }

    await queryRunner.createForeignKey(
      'SolicitudMaterial',
      new TableForeignKey({
        name: 'FK_SolicitudMaterial_Usuario_Aprobador',
        columnNames: ['idUsuarioAprobador'],
        referencedTableName: 'Usuario',
        referencedColumnNames: ['idUsuario'],
        onDelete: 'SET NULL',
        onUpdate: 'NO ACTION',
      }),
    );

    // 4. Índices de SolicitudMaterial
    await queryRunner.createIndices('SolicitudMaterial', [
      new TableIndex({
        name: 'IX_SolicitudMaterial_codigo',
        columnNames: ['codigo'],
      }),
      new TableIndex({
        name: 'IX_SolicitudMaterial_fechaSolicitud',
        columnNames: ['fechaSolicitud'],
      }),
      new TableIndex({
        name: 'IX_SolicitudMaterial_estado',
        columnNames: ['estado'],
      }),
      new TableIndex({
        name: 'IX_SolicitudMaterial_idFontanero',
        columnNames: ['idFontanero'],
      }),
      new TableIndex({
        name: 'IX_SolicitudMaterial_idAveria',
        columnNames: ['idAveria'],
      }),
    ]);

    // 5. Crear tabla DetalleSolicitudMaterial
    await queryRunner.createTable(
      new Table({
        name: 'DetalleSolicitudMaterial',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'idSolicitud',
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
      }),
      true,
    );

    // 6. Foreign Keys de DetalleSolicitudMaterial
    await queryRunner.createForeignKey(
      'DetalleSolicitudMaterial',
      new TableForeignKey({
        name: 'FK_DetalleSolicitudMaterial_Solicitud',
        columnNames: ['idSolicitud'],
        referencedTableName: 'SolicitudMaterial',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      }),
    );

    if (await queryRunner.hasTable('Material')) {
      await queryRunner.createForeignKey(
        'DetalleSolicitudMaterial',
        new TableForeignKey({
          name: 'FK_DetalleSolicitudMaterial_Material',
          columnNames: ['idMaterial'],
          referencedTableName: 'Material',
          referencedColumnNames: ['id'],
          onDelete: 'NO ACTION',
          onUpdate: 'NO ACTION',
        }),
      );
    }

    // 7. Índices de DetalleSolicitudMaterial
    await queryRunner.createIndices('DetalleSolicitudMaterial', [
      new TableIndex({
        name: 'IX_DetalleSolicitudMaterial_idSolicitud',
        columnNames: ['idSolicitud'],
      }),
      new TableIndex({
        name: 'IX_DetalleSolicitudMaterial_idMaterial',
        columnNames: ['idMaterial'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('DetalleSolicitudMaterial')) {
      await queryRunner.dropTable('DetalleSolicitudMaterial', true);
    }
    if (await queryRunner.hasTable('SolicitudMaterial')) {
      await queryRunner.dropTable('SolicitudMaterial', true);
    }
  }
}
