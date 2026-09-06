import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import { TIPOS_ACTIVIDAD_FONTANERO_INICIALES } from '../../modules/actividades-fontanero/tipo-actividad-fontanero.catalogo';

export class CreateTipoActividadFontaneroAndSeed1724684200000 implements MigrationInterface {
  name = 'CreateTipoActividadFontaneroAndSeed1724684200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isMssql = queryRunner.connection.options.type === 'mssql';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const defaultDate = isMssql ? 'GETDATE()' : 'CURRENT_TIMESTAMP';
    const boolType = isMssql ? 'bit' : 'boolean';

    await queryRunner.createTable(
      new Table({
        name: 'TipoActividadFontanero',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'codigo',
            type: 'varchar',
            length: '50',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'nombre',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'activo',
            type: boolType,
            default: isMssql ? 1 : true,
            isNullable: false,
          },
          {
            name: 'orden',
            type: 'int',
            default: 0,
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: dateTimeType,
            default: defaultDate,
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: dateTimeType,
            default: defaultDate,
            isNullable: false,
          },
        ],
      }),
      true,
    );

    const existingRows = (await queryRunner.query(
      `SELECT codigo FROM TipoActividadFontanero`,
    )) as Array<{ codigo: string }>;
    const existing = new Set(existingRows.map((row) => row.codigo));

    for (const tipo of TIPOS_ACTIVIDAD_FONTANERO_INICIALES) {
      if (existing.has(tipo.codigo)) {
        continue;
      }

      await queryRunner.query(
        `INSERT INTO TipoActividadFontanero (codigo, nombre, activo, orden, createdAt, updatedAt)
         VALUES ('${tipo.codigo}', '${tipo.nombre.replace(/'/g, "''")}', 1, ${tipo.orden}, ${defaultDate}, ${defaultDate})`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('TipoActividadFontanero');
  }
}
