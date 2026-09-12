import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateMovimientoInventarioTable1724684900000 implements MigrationInterface {
  name = 'CreateMovimientoInventarioTable1724684900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    // 1. Crear tabla MovimientoInventario
    await queryRunner.createTable(
      new Table({
        name: 'MovimientoInventario',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'tipo',
            type: 'varchar',
            length: '20',
            isNullable: false,
          },
          {
            name: 'cantidad',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'fechaMovimiento',
            type: dateTimeType,
            isNullable: false,
          },
          {
            name: 'observacion',
            type: isMssql ? 'nvarchar' : 'text',
            length: isMssql ? 'max' : undefined,
            isNullable: true,
          },
          {
            name: 'idMaterial',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'idUsuario',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'idProveedor',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'idAveria',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'idSolicitud',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'idProyecto',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: dateTimeType,
            default: defaultDate,
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // 2. Crear llaves foráneas
    await queryRunner.createForeignKey(
      'MovimientoInventario',
      new TableForeignKey({
        name: 'FK_MovimientoInventario_Material',
        columnNames: ['idMaterial'],
        referencedTableName: 'Material',
        referencedColumnNames: ['id'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createForeignKey(
      'MovimientoInventario',
      new TableForeignKey({
        name: 'FK_MovimientoInventario_Usuario',
        columnNames: ['idUsuario'],
        referencedTableName: 'Usuario',
        referencedColumnNames: ['idUsuario'],
        onDelete: 'NO ACTION',
        onUpdate: 'NO ACTION',
      }),
    );

    await queryRunner.createForeignKey(
      'MovimientoInventario',
      new TableForeignKey({
        name: 'FK_MovimientoInventario_Proveedor',
        columnNames: ['idProveedor'],
        referencedTableName: 'Proveedor',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
        onUpdate: 'NO ACTION',
      }),
    );

    // 3. Crear índices de optimización para consultas históricas y kardex
    await queryRunner.createIndex(
      'MovimientoInventario',
      new TableIndex({
        name: 'IX_MovimientoInventario_idMaterial',
        columnNames: ['idMaterial'],
      }),
    );

    await queryRunner.createIndex(
      'MovimientoInventario',
      new TableIndex({
        name: 'IX_MovimientoInventario_idUsuario',
        columnNames: ['idUsuario'],
      }),
    );

    await queryRunner.createIndex(
      'MovimientoInventario',
      new TableIndex({
        name: 'IX_MovimientoInventario_fechaMovimiento',
        columnNames: ['fechaMovimiento'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('MovimientoInventario');

    // 1. Eliminar índices si existen
    const indexNames = [
      'IX_MovimientoInventario_fechaMovimiento',
      'IX_MovimientoInventario_idUsuario',
      'IX_MovimientoInventario_idMaterial',
    ];

    for (const idxName of indexNames) {
      const idx = table?.indices.find((i) => i.name === idxName);
      if (idx) {
        await queryRunner.dropIndex('MovimientoInventario', idx);
      }
    }

    // 2. Eliminar llaves foráneas
    const fkNames = [
      'FK_MovimientoInventario_Proveedor',
      'FK_MovimientoInventario_Usuario',
      'FK_MovimientoInventario_Material',
    ];

    for (const fkName of fkNames) {
      const fk = table?.foreignKeys.find((f) => f.name === fkName);
      if (fk) {
        await queryRunner.dropForeignKey('MovimientoInventario', fk);
      }
    }

    // 3. Eliminar tabla
    await queryRunner.dropTable('MovimientoInventario', true);
  }
}
