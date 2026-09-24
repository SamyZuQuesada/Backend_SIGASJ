import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

async function main(): Promise<void> {
  const dataSource = new DataSource(buildMigrationDataSourceOptions());
  await dataSource.initialize();

  const columns = await dataSource.query(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME IN ('NotificacionAveria', 'IntentoSmsAveria')
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `);
  const pks = await dataSource.query(`
    SELECT tc.TABLE_NAME, kc.COLUMN_NAME, tc.CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kc
      ON tc.CONSTRAINT_NAME = kc.CONSTRAINT_NAME
    WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      AND tc.TABLE_NAME IN ('NotificacionAveria', 'IntentoSmsAveria')
  `);
  const fks = await dataSource.query(`
    SELECT fk.name AS FK_NAME, OBJECT_NAME(fk.parent_object_id) AS TABLE_NAME,
           COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS COLUMN_NAME,
           OBJECT_NAME(fk.referenced_object_id) AS REF_TABLE,
           COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS REF_COLUMN,
           fk.delete_referential_action_desc AS ON_DELETE
    FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
    WHERE OBJECT_NAME(fk.parent_object_id) IN ('NotificacionAveria', 'IntentoSmsAveria')
  `);
  const indexes = await dataSource.query(`
    SELECT t.name AS TABLE_NAME, ind.name AS INDEX_NAME, ind.is_unique AS IS_UNIQUE,
           col.name AS COLUMN_NAME
    FROM sys.indexes ind
    JOIN sys.index_columns ic ON ic.object_id = ind.object_id AND ic.index_id = ind.index_id
    JOIN sys.columns col ON col.object_id = ic.object_id AND col.column_id = ic.column_id
    JOIN sys.tables t ON t.object_id = ind.object_id
    WHERE t.name IN ('NotificacionAveria', 'IntentoSmsAveria')
    ORDER BY t.name, ind.name, ic.key_ordinal
  `);

  console.log('[SIGASJ] COLUMNAS', JSON.stringify(columns, null, 2));
  console.log('[SIGASJ] PKS', JSON.stringify(pks, null, 2));
  console.log('[SIGASJ] FKS', JSON.stringify(fks, null, 2));
  console.log('[SIGASJ] INDEXES', JSON.stringify(indexes, null, 2));

  await dataSource.destroy();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
