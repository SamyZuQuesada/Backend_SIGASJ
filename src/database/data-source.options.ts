import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import {
  assertProductionDatabaseEnv,
  buildMssqlExtra,
  parseDbPort,
  resolveMssqlDriverOptions,
} from '../config/mssql-connection';

const nodeRequire = createRequire(__filename);

const tryLoadMssqlNativeDriver = (): unknown => {
  try {
    return nodeRequire('mssql/msnodesqlv8');
  } catch {
    return undefined;
  }
};

/**
 * Misma fuente de variables que Nest (`database` config).
 * CLI / migraciones / probe deben usar esto — no hardcodear localhost productivo.
 */
export function buildMigrationDataSourceOptions(
  env: NodeJS.ProcessEnv = process.env,
): DataSourceOptions {
  assertProductionDatabaseEnv(env);

  const dbType =
    (env.DB_TYPE as 'postgres' | 'mysql' | 'mariadb' | 'mssql') || 'mssql';
  const defaultPort =
    dbType === 'mssql' ? 1433 : dbType === 'mysql' ? 3306 : 5432;
  const host = env.DB_HOST || 'localhost';
  const port = parseDbPort(env.DB_PORT, defaultPort);
  const database =
    env.NODE_ENV === 'test' && env.DB_DATABASE_TEST
      ? env.DB_DATABASE_TEST
      : env.DB_DATABASE || 'sigasj_db';
  const trustedConnection = env.DB_TRUSTED_CONNECTION === 'true';
  const isLocalDb =
    dbType === 'mssql' && host.toLowerCase().includes('localdb');
  const mssqlOptions = resolveMssqlDriverOptions(env);

  const base: DataSourceOptions = {
    type: dbType,
    host,
    port,
    database,
    entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    subscribers: [join(__dirname, 'subscribers', '*.subscriber.{ts,js}')],
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    logging: env.NODE_ENV === 'development',
  };

  if (dbType === 'mssql' && (trustedConnection || isLocalDb)) {
    const driver = tryLoadMssqlNativeDriver();
    if (!driver) {
      throw new Error(
        'No se pudo cargar msnodesqlv8. Verifique ODBC Driver 17 y permisos de sqlserver.node.',
      );
    }

    const server = isLocalDb ? host : `${host},${port}`;

    return {
      ...base,
      type: 'mssql',
      driver,
      extra: {
        connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${server};Database=${database};Trusted_Connection=yes;TrustServerCertificate=yes;Connection Timeout=30;Pooling=yes;Max Pool Size=10;Min Pool Size=0;`,
        ...buildMssqlExtra(mssqlOptions),
      },
      options: mssqlOptions,
    } as DataSourceOptions;
  }

  const username =
    env.DB_USERNAME || (dbType === 'mssql' ? undefined : 'postgres');
  const password =
    env.DB_PASSWORD || (dbType === 'mssql' ? undefined : 'postgres');

  return {
    ...base,
    username,
    password,
    extra: dbType === 'mssql' ? buildMssqlExtra(mssqlOptions) : undefined,
    options: dbType === 'mssql' ? mssqlOptions : undefined,
  } as DataSourceOptions;
}
