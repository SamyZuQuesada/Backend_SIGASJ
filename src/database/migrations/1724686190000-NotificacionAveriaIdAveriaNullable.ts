import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificacionAveriaIdAveriaNullable1724686190000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // idAveria debe ser nullable porque las notificaciones de salida de inventario
    // y otras notificaciones no relacionadas con averías requieren idAveria = NULL.
    await queryRunner.query(
      `ALTER TABLE "NotificacionAveria" ALTER COLUMN "idAveria" int NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "NotificacionAveria" ALTER COLUMN "idAveria" int NOT NULL`,
    );
  }
}
