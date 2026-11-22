import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFotoPerfilUrlToUsuario1724686430000
  implements MigrationInterface
{
  name = 'AddFotoPerfilUrlToUsuario1724686430000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('Usuario'))) {
      return;
    }

    if (!(await queryRunner.hasColumn('Usuario', 'fotoPerfilUrl'))) {
      await queryRunner.addColumn(
        'Usuario',
        new TableColumn({
          name: 'fotoPerfilUrl',
          type: 'varchar',
          length: '500',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('Usuario'))) {
      return;
    }

    if (await queryRunner.hasColumn('Usuario', 'fotoPerfilUrl')) {
      await queryRunner.dropColumn('Usuario', 'fotoPerfilUrl');
    }
  }
}
