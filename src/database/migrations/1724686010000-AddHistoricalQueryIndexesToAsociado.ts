import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * Optimización de consultas históricas en la tabla Asociado (activos, inactivos y rangos de fechas).
 * Permite consultar el historial directamente sobre la propia tabla Asociado sin duplicar registros.
 */
export class AddHistoricalQueryIndexesToAsociado1724686010000
  implements MigrationInterface
{
  name = 'AddHistoricalQueryIndexesToAsociado1724686010000';

  private readonly indices = [
    { name: 'IDX_Asociado_activo', columnNames: ['activo'] },
    { name: 'IDX_Asociado_fechaRegistro', columnNames: ['fechaRegistro'] },
    { name: 'IDX_Asociado_fechaInactivacion', columnNames: ['fechaInactivacion'] },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('Asociado');
    if (!table) return;

    for (const def of this.indices) {
      const exists = table.indices.some((idx) => idx.name === def.name);
      if (!exists) {
        await queryRunner.createIndex(
          'Asociado',
          new TableIndex({
            name: def.name,
            columnNames: def.columnNames,
          }),
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('Asociado');
    if (!table) return;

    for (const def of this.indices) {
      const index = table.indices.find((idx) => idx.name === def.name);
      if (index) {
        await queryRunner.dropIndex('Asociado', index);
      }
    }
  }
}
