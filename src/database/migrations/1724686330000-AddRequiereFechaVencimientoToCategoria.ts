import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Indica si los materiales de la categoría usan fecha de vencimiento
 * (p. ej. químicos sí; tubería PVC no).
 */
export class AddRequiereFechaVencimientoToCategoria1724686330000 implements MigrationInterface {
  name = 'AddRequiereFechaVencimientoToCategoria1724686330000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('CategoriaMaterial');
    if (!table) return;
    if (table.findColumnByName('requiereFechaVencimiento')) return;

    const isMssql = queryRunner.connection.options.type === 'mssql';
    const boolType = isMssql ? 'bit' : 'boolean';
    const defaultFalse = isMssql ? '0' : 'false';

    await queryRunner.addColumn(
      'CategoriaMaterial',
      new TableColumn({
        name: 'requiereFechaVencimiento',
        type: boolType,
        isNullable: false,
        default: defaultFalse,
      }),
    );

    // Heurística inicial: categorías de insumos químicos / cloro / reactivos.
    if (isMssql) {
      await queryRunner.query(`
        UPDATE CategoriaMaterial
        SET requiereFechaVencimiento = 1
        WHERE LOWER(nombre) LIKE '%quim%'
           OR LOWER(nombre) LIKE '%quím%'
           OR LOWER(nombre) LIKE '%cloro%'
           OR LOWER(nombre) LIKE '%react%'
           OR LOWER(nombre) LIKE '%desinf%'
           OR LOWER(nombre) LIKE '%hipoclor%'
      `);
    } else {
      await queryRunner.query(`
        UPDATE "CategoriaMaterial"
        SET "requiereFechaVencimiento" = true
        WHERE LOWER(nombre) LIKE '%quim%'
           OR LOWER(nombre) LIKE '%quím%'
           OR LOWER(nombre) LIKE '%cloro%'
           OR LOWER(nombre) LIKE '%react%'
           OR LOWER(nombre) LIKE '%desinf%'
           OR LOWER(nombre) LIKE '%hipoclor%'
      `);
    }

    // Limpia vencimientos en materiales cuya categoría no los requiere.
    if (isMssql) {
      await queryRunner.query(`
        UPDATE m
        SET m.fechaVencimiento = NULL
        FROM Material m
        INNER JOIN CategoriaMaterial c ON c.id = m.idCategoria
        WHERE c.requiereFechaVencimiento = 0
          AND m.fechaVencimiento IS NOT NULL
      `);
    } else {
      await queryRunner.query(`
        UPDATE "Material" m
        SET "fechaVencimiento" = NULL
        FROM "CategoriaMaterial" c
        WHERE c.id = m."idCategoria"
          AND c."requiereFechaVencimiento" = false
          AND m."fechaVencimiento" IS NOT NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('CategoriaMaterial');
    if (!table?.findColumnByName('requiereFechaVencimiento')) return;
    await queryRunner.dropColumn(
      'CategoriaMaterial',
      'requiereFechaVencimiento',
    );
  }
}
