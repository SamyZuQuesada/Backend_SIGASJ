import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Almacenamiento binario persistente para imágenes y documentos en Azure SQL Database.
 * Permite que Render Free sirva medios de forma persistente a través del middleware
 * sin depender del sistema de archivos efímero del contenedor.
 *
 * Timestamp: 1724686410000 (posterior a 1724686400000-AddExpedienteLaboralToColaborador).
 */
export class CreateArchivoMediaTable1724686410000
  implements MigrationInterface
{
  name = 'CreateArchivoMediaTable1724686410000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('ArchivoMedia')) {
      return;
    }

    const isMssql = queryRunner.connection.options.type === 'mssql';
    const intType = isMssql ? 'int' : 'integer';
    const bigIntType = isMssql ? 'bigint' : 'integer';
    const dateTimeType = isMssql ? 'datetime2' : 'datetime';
    const binaryType = isMssql ? 'varbinary' : 'blob';
    const defaultDate = isMssql ? 'SYSUTCDATETIME()' : 'CURRENT_TIMESTAMP';

    await queryRunner.createTable(
      new Table({
        name: 'ArchivoMedia',
        columns: [
          {
            name: 'id',
            type: intType,
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'ruta',
            type: 'varchar',
            length: '500',
            isNullable: false,
            isUnique: true,
          },
          {
            name: 'mime',
            type: 'varchar',
            length: '120',
            isNullable: false,
          },
          {
            name: 'contenido',
            type: binaryType,
            length: isMssql ? 'max' : undefined,
            isNullable: false,
          },
          {
            name: 'tamanoBytes',
            type: bigIntType,
            isNullable: false,
            default: '0',
          },
          {
            name: 'createdAt',
            type: dateTimeType,
            isNullable: false,
            default: defaultDate,
          },
          {
            name: 'updatedAt',
            type: dateTimeType,
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Asegurar índice sobre la columna ruta si no fue creado por la unicidad
    const table = await queryRunner.getTable('ArchivoMedia');
    const hasIndex = table?.indices.some((idx) =>
      idx.columnNames.includes('ruta'),
    );

    if (!hasIndex) {
      await queryRunner.createIndex(
        'ArchivoMedia',
        new TableIndex({
          name: 'UQ_ArchivoMedia_ruta',
          columnNames: ['ruta'],
          isUnique: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('ArchivoMedia')) {
      // Reversión segura contra pérdida accidental de datos:
      // Si la tabla contiene registros binarios, se preserva renombrándola
      // a ArchivoMedia_Backup_Rollback en lugar de destruirla irrevocablemente con DROP TABLE.
      try {
        const countResult = await queryRunner.query(
          `SELECT COUNT(1) AS total FROM ArchivoMedia`,
        );
        const total = Number(
          countResult?.[0]?.total ?? countResult?.[0]?.['COUNT(1)'] ?? 0,
        );

        if (total > 0) {
          const isMssql = queryRunner.connection.options.type === 'mssql';
          if (isMssql) {
            await queryRunner.query(
              `EXEC sp_rename 'dbo.ArchivoMedia', 'ArchivoMedia_Backup_Rollback'`,
            );
          } else {
            await queryRunner.query(
              `ALTER TABLE ArchivoMedia RENAME TO ArchivoMedia_Backup_Rollback`,
            );
          }
          return;
        }
      } catch {
        // En caso de que la consulta de conteo falle, proceder con eliminación estándar
      }

      await queryRunner.dropTable('ArchivoMedia', true, true, true);
    }
  }
}
