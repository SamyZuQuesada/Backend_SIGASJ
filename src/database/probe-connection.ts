/**
 * Prueba de conectividad SQL Server (SELECT 1).
 * No modifica datos. No imprime passwords ni connection strings.
 */
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import {
  describeDbTarget,
  resolveMssqlDriverOptions,
  sanitizeDbErrorMessage,
} from '../config/mssql-connection';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

async function main(): Promise<void> {
  const env = process.env;
  const tls = resolveMssqlDriverOptions(env);

  console.log('[SIGASJ] Probe DB (sin secretos)');
  console.log(`  ${describeDbTarget(env)}`);
  console.log(`  encrypt=${tls.encrypt}`);
  console.log(`  trustServerCertificate=${tls.trustServerCertificate}`);
  console.log(`  caConfigured=${Boolean(env.DB_SSL_CA || env.DB_SSL_CA_PATH)}`);

  const options = buildMigrationDataSourceOptions(env);
  console.log(`  synchronize=${options.synchronize}`);
  console.log(`  type=${options.type}`);

  const dataSource = new DataSource(options);
  try {
    await dataSource.initialize();
    console.log('[SIGASJ] Conexión establecida.');

    // TypeORM tipa query() como any; acotamos a unknown sin loguear filas crudas.
    const rows = (await dataSource.query('SELECT 1 AS ok')) as unknown as Array<
      Record<string, unknown>
    >;
    const value =
      Array.isArray(rows) && rows[0] && typeof rows[0] === 'object'
        ? rows[0].ok
        : undefined;
    console.log(`[SIGASJ] SELECT 1 => ${String(value)}`);

    if (String(value) !== '1') {
      throw new Error(`Respuesta inesperada de SELECT 1: ${String(value)}`);
    }

    console.log('[SIGASJ] Probe OK');
  } catch (error: unknown) {
    console.error(`[SIGASJ] Probe FALLÓ: ${sanitizeDbErrorMessage(error)}`);
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

main().catch((error: unknown) => {
  console.error(`[SIGASJ] Probe error: ${sanitizeDbErrorMessage(error)}`);
  process.exit(1);
});
