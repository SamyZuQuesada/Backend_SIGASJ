import { MigrationInterface, QueryRunner } from 'typeorm';
import { TipoActividadFontaneroCodigo } from '../../common/enums/tipo-actividad-fontanero-codigo.enum';

export class DeactivateIncapacidadVacacionesTipoActividad1724686300000
  implements MigrationInterface
{
  name = 'DeactivateIncapacidadVacacionesTipoActividad1724686300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('TipoActividadFontanero'))) {
      return;
    }

    await queryRunner.query(
      `UPDATE TipoActividadFontanero SET activo = 0 WHERE codigo = @0`,
      [TipoActividadFontaneroCodigo.INCAPACIDAD_VACACIONES],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('TipoActividadFontanero'))) {
      return;
    }

    await queryRunner.query(
      `UPDATE TipoActividadFontanero SET activo = 1 WHERE codigo = @0`,
      [TipoActividadFontaneroCodigo.INCAPACIDAD_VACACIONES],
    );
  }
}
