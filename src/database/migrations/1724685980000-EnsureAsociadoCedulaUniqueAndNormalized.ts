import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';
import { normalizarCedula } from '../../common/utils/cedula.util';

/**
 * Migración para garantizar que:
 * 1. Todas las cédulas existentes en la tabla Asociado estén normalizadas al formato canónico estándar.
 * 2. Exista el índice / restricción única UQ_Asociado_cedula en SQL Server y otros motores.
 */
export class EnsureAsociadoCedulaUniqueAndNormalized1724685980000 implements MigrationInterface {
  name = 'EnsureAsociadoCedulaUniqueAndNormalized1724685980000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('Asociado');
    if (!table) {
      return;
    }

    // 1. Normalizar cédulas existentes en la base de datos
    const filas = await queryRunner.query('SELECT id, cedula FROM Asociado');
    for (const fila of filas) {
      if (typeof fila.cedula === 'string') {
        const canónica = normalizarCedula(fila.cedula);
        if (canónica !== fila.cedula) {
          const isMssql = queryRunner.connection.options.type === 'mssql';
          if (isMssql) {
            await queryRunner.query(
              'UPDATE Asociado SET cedula = @0 WHERE id = @1',
              [canónica, fila.id],
            );
          } else {
            await queryRunner.query(
              'UPDATE Asociado SET cedula = ? WHERE id = ?',
              [canónica, fila.id],
            );
          }
        }
      }
    }

    // 2. Garantizar que exista el índice único
    const indiceExiste = table.indices.some(
      (idx) =>
        idx.name === 'UQ_Asociado_cedula' ||
        (idx.isUnique &&
          idx.columnNames.length === 1 &&
          idx.columnNames[0] === 'cedula'),
    );

    if (!indiceExiste) {
      await queryRunner.createIndex(
        'Asociado',
        new TableIndex({
          name: 'UQ_Asociado_cedula',
          columnNames: ['cedula'],
          isUnique: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('Asociado');
    if (!table) {
      return;
    }

    const indice = table.indices.find((i) => i.name === 'UQ_Asociado_cedula');
    if (indice) {
      await queryRunner.dropIndex('Asociado', indice);
    }
  }
}
