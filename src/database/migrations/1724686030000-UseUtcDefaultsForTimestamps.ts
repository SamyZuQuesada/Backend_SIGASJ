import { MigrationInterface, QueryRunner } from 'typeorm';

type RestriccionFecha = {
  esquema: string;
  tabla: string;
  columna: string;
  restriccion: string;
  tipo: string;
};

/**
 * Las columnas de fecha con valor por defecto GETDATE() / CURRENT_TIMESTAMP
 * guardaban la hora LOCAL del servidor SQL, pero el API las lee como UTC
 * (useUTC: true). Con SQL Server en Costa Rica (UTC-6) los registros salían
 * 6 horas atrasados.
 *
 * Esta migración cambia esos valores por defecto a UTC (GETUTCDATE() para
 * datetime y SYSUTCDATETIME() para datetime2). No modifica datos ya guardados.
 * Es idempotente: solo toca restricciones que todavía usan hora local.
 */
export class UseUtcDefaultsForTimestamps1724686030000
  implements MigrationInterface
{
  name = 'UseUtcDefaultsForTimestamps1724686030000';

  private async listar(
    queryRunner: QueryRunner,
    definiciones: string[],
  ): Promise<RestriccionFecha[]> {
    const condicion = definiciones
      .map((d) => `LOWER(dc.definition) LIKE '%${d}%'`)
      .join(' OR ');
    return (await queryRunner.query(`
      SELECT s.name AS esquema, t.name AS tabla, c.name AS columna,
             dc.name AS restriccion, ty.name AS tipo
      FROM sys.default_constraints dc
      JOIN sys.tables t ON t.object_id = dc.parent_object_id
      JOIN sys.schemas s ON s.schema_id = t.schema_id
      JOIN sys.columns c ON c.object_id = dc.parent_object_id
                        AND c.column_id = dc.parent_column_id
      JOIN sys.types ty ON ty.user_type_id = c.user_type_id
      WHERE ty.name IN ('datetime', 'datetime2', 'smalldatetime')
        AND (${condicion})
    `)) as RestriccionFecha[];
  }

  private async reemplazar(
    queryRunner: QueryRunner,
    fila: RestriccionFecha,
    expresion: string,
  ): Promise<void> {
    const tabla = `[${fila.esquema}].[${fila.tabla}]`;
    await queryRunner.query(
      `ALTER TABLE ${tabla} DROP CONSTRAINT [${fila.restriccion}]`,
    );
    await queryRunner.query(
      `ALTER TABLE ${tabla} ADD CONSTRAINT [${fila.restriccion}] DEFAULT (${expresion}) FOR [${fila.columna}]`,
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'mssql') {
      return;
    }
    const filas = await this.listar(queryRunner, [
      'getdate()',
      'current_timestamp',
      'sysdatetime()',
    ]);
    for (const fila of filas) {
      await this.reemplazar(
        queryRunner,
        fila,
        fila.tipo === 'datetime2' ? 'SYSUTCDATETIME()' : 'GETUTCDATE()',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'mssql') {
      return;
    }
    const filas = await this.listar(queryRunner, [
      'getutcdate()',
      'sysutcdatetime()',
    ]);
    for (const fila of filas) {
      await this.reemplazar(
        queryRunner,
        fila,
        fila.tipo === 'datetime2' ? 'SYSDATETIME()' : 'GETDATE()',
      );
    }
  }
}
