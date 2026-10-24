import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddPrecioUnitarioAndFechaVencimientoToInventario1724686200000
  implements MigrationInterface
{
  name = 'AddPrecioUnitarioAndFechaVencimientoToInventario1724686200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';

    // 1. Agregar precioUnitario y fechaVencimiento a Material
    if (await queryRunner.hasTable('Material')) {
      if (!(await queryRunner.hasColumn('Material', 'precioUnitario'))) {
        await queryRunner.addColumn(
          'Material',
          new TableColumn({
            name: 'precioUnitario',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          }),
        );
      }

      if (!(await queryRunner.hasColumn('Material', 'fechaVencimiento'))) {
        await queryRunner.addColumn(
          'Material',
          new TableColumn({
            name: 'fechaVencimiento',
            type: dateTimeType,
            isNullable: true,
          }),
        );
      }

      const tableMaterial = await queryRunner.getTable('Material');
      const hasIndexActivo = tableMaterial?.indices.some(
        (i) => i.name === 'IX_Material_activo',
      );
      if (!hasIndexActivo) {
        await queryRunner.createIndex(
          'Material',
          new TableIndex({
            name: 'IX_Material_activo',
            columnNames: ['activo'],
          }),
        );
      }
    }

    // 2. Agregar precioUnitario a MovimientoInventario
    if (await queryRunner.hasTable('MovimientoInventario')) {
      if (
        !(await queryRunner.hasColumn('MovimientoInventario', 'precioUnitario'))
      ) {
        await queryRunner.addColumn(
          'MovimientoInventario',
          new TableColumn({
            name: 'precioUnitario',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          }),
        );
      }
    }

    // 3. Agregar precioUnitario a DetalleReposicionMaterial
    if (await queryRunner.hasTable('DetalleReposicionMaterial')) {
      if (
        !(await queryRunner.hasColumn(
          'DetalleReposicionMaterial',
          'precioUnitario',
        ))
      ) {
        await queryRunner.addColumn(
          'DetalleReposicionMaterial',
          new TableColumn({
            name: 'precioUnitario',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
          }),
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('DetalleReposicionMaterial')) {
      if (
        await queryRunner.hasColumn(
          'DetalleReposicionMaterial',
          'precioUnitario',
        )
      ) {
        await queryRunner.dropColumn(
          'DetalleReposicionMaterial',
          'precioUnitario',
        );
      }
    }

    if (await queryRunner.hasTable('MovimientoInventario')) {
      if (
        await queryRunner.hasColumn('MovimientoInventario', 'precioUnitario')
      ) {
        await queryRunner.dropColumn('MovimientoInventario', 'precioUnitario');
      }
    }

    if (await queryRunner.hasTable('Material')) {
      const tableMaterial = await queryRunner.getTable('Material');
      const indexActivo = tableMaterial?.indices.find(
        (i) => i.name === 'IX_Material_activo',
      );
      if (indexActivo) {
        await queryRunner.dropIndex('Material', indexActivo);
      }

      if (await queryRunner.hasColumn('Material', 'fechaVencimiento')) {
        await queryRunner.dropColumn('Material', 'fechaVencimiento');
      }

      if (await queryRunner.hasColumn('Material', 'precioUnitario')) {
        await queryRunner.dropColumn('Material', 'precioUnitario');
      }
    }
  }
}
