import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateDocumentoMovimientoInventarioTable1724685000000
  implements MigrationInterface
{
  name = 'CreateDocumentoMovimientoInventarioTable1724685000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';

    // 1. Crear tabla DocumentoMovimientoInventario
    await queryRunner.createTable(
      new Table({
        name: 'DocumentoMovimientoInventario',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
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
          {
            name: 'tamanio',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'idMovimiento',
            type: 'int',
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

    // 2. Crear llave foránea vinculada a MovimientoInventario con CASCADE
    await queryRunner.createForeignKey(
      'DocumentoMovimientoInventario',
      new TableForeignKey({
        name: 'FK_DocumentoMovimientoInventario_Movimiento',
        columnNames: ['idMovimiento'],
        referencedTableName: 'MovimientoInventario',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
        onUpdate: 'NO ACTION',
      }),
    );

    // 3. Crear índice para optimizar consultas de documentos por movimiento
    await queryRunner.createIndex(
      'DocumentoMovimientoInventario',
      new TableIndex({
        name: 'IX_DocumentoMovimientoInventario_idMovimiento',
        columnNames: ['idMovimiento'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('DocumentoMovimientoInventario');

    // 1. Eliminar índice
    const idx = table?.indices.find(
      (i) => i.name === 'IX_DocumentoMovimientoInventario_idMovimiento',
    );
    if (idx) {
      await queryRunner.dropIndex('DocumentoMovimientoInventario', idx);
    }

    // 2. Eliminar llave foránea
    const fk = table?.foreignKeys.find(
      (f) => f.name === 'FK_DocumentoMovimientoInventario_Movimiento',
    );
    if (fk) {
      await queryRunner.dropForeignKey('DocumentoMovimientoInventario', fk);
    }

    // 3. Eliminar tabla
    await queryRunner.dropTable('DocumentoMovimientoInventario', true);
  }
}
