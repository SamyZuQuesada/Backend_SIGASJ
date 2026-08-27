import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class SetProyectoActivoDefaultFalse1724684100000 implements MigrationInterface {
  name = 'SetProyectoActivoDefaultFalse1724684100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';

    await queryRunner.changeColumn(
      'Proyecto',
      'activo',
      new TableColumn({
        name: 'activo',
        type: isMssql ? 'bit' : 'boolean',
        default: isMssql ? 0 : false,
        isNullable: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';

    await queryRunner.changeColumn(
      'Proyecto',
      'activo',
      new TableColumn({
        name: 'activo',
        type: isMssql ? 'bit' : 'boolean',
        default: isMssql ? 1 : true,
        isNullable: false,
      }),
    );
  }
}
