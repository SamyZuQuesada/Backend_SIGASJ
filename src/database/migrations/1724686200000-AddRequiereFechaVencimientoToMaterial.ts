import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRequiereFechaVencimientoToMaterial1724686200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE [Material] ADD [requiereFechaVencimiento] bit NOT NULL CONSTRAINT [DF_Material_requiereFechaVencimiento] DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE [Material] DROP CONSTRAINT [DF_Material_requiereFechaVencimiento]`,
    );
    await queryRunner.query(
      `ALTER TABLE [Material] DROP COLUMN [requiereFechaVencimiento]`,
    );
  }
}
