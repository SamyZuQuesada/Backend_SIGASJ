import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
import { TIPOS_ACTIVIDAD_FONTANERO_INICIALES } from '../../modules/actividades-fontanero/tipo-actividad-fontanero.catalogo';

export class AddOrdenToTipoActividadFontanero1724684250000
  implements MigrationInterface
{
  name = 'AddOrdenToTipoActividadFontanero1724684250000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('TipoActividadFontanero');
    if (!table) {
      return;
    }

    if (!table.findColumnByName('orden')) {
      await queryRunner.addColumn(
        'TipoActividadFontanero',
        new TableColumn({
          name: 'orden',
          type: 'int',
          default: 0,
          isNullable: false,
        }),
      );
    }

    for (const tipo of TIPOS_ACTIVIDAD_FONTANERO_INICIALES) {
      await queryRunner.query(
        `UPDATE TipoActividadFontanero SET orden = @0 WHERE codigo = @1`,
        [tipo.orden, tipo.codigo],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('TipoActividadFontanero');
    if (table?.findColumnByName('orden')) {
      await queryRunner.dropColumn('TipoActividadFontanero', 'orden');
    }
  }
}
