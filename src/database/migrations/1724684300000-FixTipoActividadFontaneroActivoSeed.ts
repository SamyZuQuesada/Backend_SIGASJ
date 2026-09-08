import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixTipoActividadFontaneroActivoSeed1724684300000 implements MigrationInterface {
  name = 'FixTipoActividadFontaneroActivoSeed1724684300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('UPDATE TipoActividadFontanero SET activo = 1');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Sin reversión: el catálogo debe permanecer activo.
  }
}
