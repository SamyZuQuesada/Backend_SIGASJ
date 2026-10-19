import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * La entidad ActividadFontanero declara `datosEspecificos` (JSON por tipo de
 * actividad), pero ninguna migración creaba la columna. En SQL Server, con
 * synchronize desactivado, cualquier consulta de actividades fallaba con
 * "Invalid column name 'datosEspecificos'".
 */
export class AddDatosEspecificosToActividadFontanero1724686020000 implements MigrationInterface {
  name = 'AddDatosEspecificosToActividadFontanero1724686020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('ActividadFontanero');
    if (table && !table.findColumnByName('datosEspecificos')) {
      await queryRunner.addColumn(
        'ActividadFontanero',
        new TableColumn({
          name: 'datosEspecificos',
          type: 'ntext',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('ActividadFontanero');
    if (table?.findColumnByName('datosEspecificos')) {
      await queryRunner.dropColumn('ActividadFontanero', 'datosEspecificos');
    }
  }
}
