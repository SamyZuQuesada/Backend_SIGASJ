import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * precioUnitario de MovimientoInventario y DetalleReposicionMaterial
 * existía en las entidades y no en el esquema versionado.
 * Corresponde a la migración local 622 que Wuipy pidió commitear.
 */
export class AddPrecioUnitarioToMovimientoYDetalleReposicion1724686220000
  implements MigrationInterface
{
  name = 'AddPrecioUnitarioToMovimientoYDetalleReposicion1724686220000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.agregarPrecio(queryRunner, 'MovimientoInventario');
    await this.agregarPrecio(queryRunner, 'DetalleReposicionMaterial');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.quitarPrecio(queryRunner, 'DetalleReposicionMaterial');
    await this.quitarPrecio(queryRunner, 'MovimientoInventario');
  }

  private async agregarPrecio(
    queryRunner: QueryRunner,
    tableName: string,
  ): Promise<void> {
    if (!(await queryRunner.hasTable(tableName))) {
      return;
    }
    if (await queryRunner.hasColumn(tableName, 'precioUnitario')) {
      return;
    }

    await queryRunner.addColumn(
      tableName,
      new TableColumn({
        name: 'precioUnitario',
        type: 'decimal',
        precision: 12,
        scale: 2,
        isNullable: true,
      }),
    );
  }

  private async quitarPrecio(
    queryRunner: QueryRunner,
    tableName: string,
  ): Promise<void> {
    if (!(await queryRunner.hasTable(tableName))) {
      return;
    }
    if (!(await queryRunner.hasColumn(tableName, 'precioUnitario'))) {
      return;
    }
    await queryRunner.dropColumn(tableName, 'precioUnitario');
  }
}
