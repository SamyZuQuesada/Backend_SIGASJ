import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Marca los materiales que deben llevar fecha de vencimiento.
 * Idempotente: si la columna ya existe (por un intento anterior) no vuelve a crearla.
 * En SQL Server conserva el default con nombre fijo; en el resto usa el tipo boolean.
 */
export class AddRequiereFechaVencimientoToMaterial1724686200000
  implements MigrationInterface
{
  name = 'AddRequiereFechaVencimientoToMaterial1724686200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (
      await queryRunner.hasColumn('Material', 'requiereFechaVencimiento')
    ) {
      return;
    }

    if (queryRunner.connection.options.type === 'mssql') {
      await queryRunner.query(
        `ALTER TABLE [Material] ADD [requiereFechaVencimiento] bit NOT NULL CONSTRAINT [DF_Material_requiereFechaVencimiento] DEFAULT 0`,
      );
      return;
    }

    await queryRunner.addColumn(
      'Material',
      new TableColumn({
        name: 'requiereFechaVencimiento',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (
      !(await queryRunner.hasColumn('Material', 'requiereFechaVencimiento'))
    ) {
      return;
    }

    if (queryRunner.connection.options.type === 'mssql') {
      await queryRunner.query(
        `IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Material_requiereFechaVencimiento') ALTER TABLE [Material] DROP CONSTRAINT [DF_Material_requiereFechaVencimiento]`,
      );
    }

    await queryRunner.dropColumn('Material', 'requiereFechaVencimiento');
  }
}
