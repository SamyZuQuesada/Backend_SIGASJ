import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from '../dist/database/data-source.options.js';

loadEnv();
const ds = new DataSource(buildMigrationDataSourceOptions());
await ds.initialize();

const fk = await ds.query(`
  SELECT fk.name AS fkName,
         OBJECT_NAME(fk.parent_object_id) AS childTable,
         COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS childCol,
         OBJECT_NAME(fk.referenced_object_id) AS parentTable,
         COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS parentCol,
         fk.delete_referential_action_desc AS onDelete
  FROM sys.foreign_keys fk
  INNER JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
  WHERE OBJECT_NAME(fk.parent_object_id) = 'SolicitudInfraestructuraLinderos'
`);
console.log('FK', JSON.stringify(fk, null, 2));

const cols = await ds.query(`
  SELECT c.name, t.name AS typeName, c.max_length, c.is_nullable
  FROM sys.columns c
  INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
  WHERE c.object_id = OBJECT_ID('SolicitudInfraestructuraLinderos')
  ORDER BY c.column_id
`);
console.log('COLUMNS', JSON.stringify(cols, null, 2));

await ds.destroy();
