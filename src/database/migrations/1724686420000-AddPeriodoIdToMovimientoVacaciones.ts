import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Identificador único de periodo de adquisición (CT CR art. 153).
 * Unique (colaboradorId, periodoId) cuando periodoId no es null.
 */
export class AddPeriodoIdToMovimientoVacaciones1724686420000
  implements MigrationInterface
{
  name = 'AddPeriodoIdToMovimientoVacaciones1724686420000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('MovimientoVacaciones'))) {
      return;
    }
    const table = await queryRunner.getTable('MovimientoVacaciones');
    if (!table?.findColumnByName('periodoId')) {
      await queryRunner.addColumn(
        'MovimientoVacaciones',
        new TableColumn({
          name: 'periodoId',
          type: 'varchar',
          length: '40',
          isNullable: true,
        }),
      );
    }

    const idxName = 'UQ_MovimientoVacaciones_colaborador_periodo';
    const hasIdx = table?.indices.some((i) => i.name === idxName);
    if (!hasIdx) {
      const isMssql = queryRunner.connection.options.type === 'mssql';
      if (isMssql) {
        await queryRunner.query(`
          IF NOT EXISTS (
            SELECT 1 FROM sys.indexes
            WHERE name = '${idxName}' AND object_id = OBJECT_ID('MovimientoVacaciones')
          )
          CREATE UNIQUE INDEX ${idxName}
          ON MovimientoVacaciones (colaboradorId, periodoId)
          WHERE periodoId IS NOT NULL;
        `);
      } else {
        await queryRunner.createIndex(
          'MovimientoVacaciones',
          new TableIndex({
            name: idxName,
            columnNames: ['colaboradorId', 'periodoId'],
            isUnique: true,
            where: 'periodoId IS NOT NULL',
          }),
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('MovimientoVacaciones'))) {
      return;
    }
    const idxName = 'UQ_MovimientoVacaciones_colaborador_periodo';
    const isMssql = queryRunner.connection.options.type === 'mssql';
    if (isMssql) {
      await queryRunner.query(`
        IF EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = '${idxName}' AND object_id = OBJECT_ID('MovimientoVacaciones')
        )
        DROP INDEX ${idxName} ON MovimientoVacaciones;
      `);
    } else {
      const table = await queryRunner.getTable('MovimientoVacaciones');
      const idx = table?.indices.find((i) => i.name === idxName);
      if (idx) {
        await queryRunner.dropIndex('MovimientoVacaciones', idx);
      }
    }
    const table = await queryRunner.getTable('MovimientoVacaciones');
    if (table?.findColumnByName('periodoId')) {
      await queryRunner.dropColumn('MovimientoVacaciones', 'periodoId');
    }
  }
}
