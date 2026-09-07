import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureTipoActividadFontaneroActivo1724684400000
  implements MigrationInterface
{
  name = 'EnsureTipoActividadFontaneroActivo1724684400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('UPDATE TipoActividadFontanero SET activo = 1');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Sin reversión.
  }
}
