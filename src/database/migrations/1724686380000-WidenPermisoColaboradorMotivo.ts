import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El formulario de permiso admite 500 caracteres; PermisoColaborador
 * tenía 200 y la aprobación fallaba al copiar el motivo.
 * SQL Server: ALTER COLUMN in-place (changeColumn drop+add pierde datos).
 */
export class WidenPermisoColaboradorMotivo1724686380000
  implements MigrationInterface
{
  name = 'WidenPermisoColaboradorMotivo1724686380000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('PermisoColaborador'))) {
      return;
    }
    const table = await queryRunner.getTable('PermisoColaborador');
    if (!table?.findColumnByName('motivo')) {
      return;
    }
    await queryRunner.query(
      `ALTER TABLE PermisoColaborador ALTER COLUMN motivo nvarchar(500) NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('PermisoColaborador'))) {
      return;
    }
    const table = await queryRunner.getTable('PermisoColaborador');
    if (!table?.findColumnByName('motivo')) {
      return;
    }
    await queryRunner.query(
      `ALTER TABLE PermisoColaborador ALTER COLUMN motivo nvarchar(200) NOT NULL`,
    );
  }
}
