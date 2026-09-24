/**
 * Inspección de entorno y migraciones pendientes.
 * No imprime secretos. Usa el DataSource real de migraciones.
 */
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

const secretKeys = /PASSWORD|SECRET|TOKEN|KEY|CONNECTION_STRING/i;

async function main(): Promise<void> {
  const keys = [
    'NODE_ENV',
    'DB_TYPE',
    'DB_HOST',
    'DB_PORT',
    'DB_DATABASE',
    'DB_USERNAME',
    'DB_TRUSTED_CONNECTION',
    'SMS_ENABLED',
    'SMS_PROVIDER',
    'SMS_TEST_MODE',
    'PORT',
  ];

  console.log('[SIGASJ] Entorno (sin secretos):');
  for (const key of keys) {
    console.log(`  ${key}=${process.env[key] ?? '(undefined)'}`);
  }
  console.log(
    `  DB_PASSWORD=${process.env.DB_PASSWORD ? '(definida, no impresa)' : '(undefined)'}`,
  );
  console.log(
    `  JWT_SECRET=${process.env.JWT_SECRET ? '(definida, no impresa)' : '(undefined)'}`,
  );

  const leaked = Object.keys(process.env).filter((key) => secretKeys.test(key));
  console.log(
    `[SIGASJ] Variables sensibles presentes (nombres): ${leaked.join(', ') || 'ninguna'}`,
  );

  const options = buildMigrationDataSourceOptions();
  console.log('[SIGASJ] DataSource migraciones:');
  console.log(`  type=${options.type}`);
  console.log(`  host=${'host' in options ? options.host : '(n/a)'}`);
  console.log(`  port=${'port' in options ? options.port : '(n/a)'}`);
  console.log(`  database=${'database' in options ? options.database : '(n/a)'}`);
  console.log(`  synchronize=${options.synchronize}`);
  console.log(`  migrationsRun=${options.migrationsRun ?? false}`);

  const host = String('host' in options ? options.host : '');
  const database = String('database' in options ? options.database : '');
  const isLocalHost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === 'sqlserver' ||
    host.toLowerCase().includes('localdb');
  const looksProduction =
    process.env.NODE_ENV === 'production' ||
    /prod|azure|aws|cloud/i.test(host) ||
    /prod/i.test(database);

  console.log(`[SIGASJ] hostLocal=${isLocalHost} looksProduction=${looksProduction}`);

  const dataSource = new DataSource(options);
  await dataSource.initialize();
  console.log('[SIGASJ] Conexión establecida.');

  const executed = await dataSource.query(
    `SELECT name FROM typeorm_migrations ORDER BY id`,
  );
  console.log('[SIGASJ] Migraciones ya aplicadas:');
  for (const row of executed as { name: string }[]) {
    console.log(`  - ${row.name}`);
  }

  const pending = await dataSource.showMigrations();
  console.log(`[SIGASJ] Hay pendientes: ${pending ? 'SÍ' : 'NO'}`);

  const tables = await dataSource.query(`
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
      AND TABLE_NAME IN ('NotificacionAveria', 'IntentoSmsAveria', 'Averia', 'Usuario')
    ORDER BY TABLE_NAME
  `);
  console.log('[SIGASJ] Tablas relevantes:', tables);

  await dataSource.destroy();
}

main().catch((error: unknown) => {
  console.error('[SIGASJ] Error inspección entorno:', error);
  process.exit(1);
});
