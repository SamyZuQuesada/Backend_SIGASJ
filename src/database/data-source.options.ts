import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

const nodeRequire = createRequire(__filename);

const mssqlPool = {
  max: 10,
  min: 0,
  idleTimeoutMillis: 30_000,
  acquireTimeoutMillis: 30_000,
};

const mssqlOptions = {
  encrypt: false,
  trustServerCertificate: true,
  enableArithAbort: true,
  connectTimeout: 30_000,
  requestTimeout: 30_000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000,
};

const tryLoadMssqlNativeDriver = (): unknown | undefined => {
  try {
    return nodeRequire('mssql/msnodesqlv8');
  } catch {
    return undefined;
  }
};

export function buildMigrationDataSourceOptions(): DataSourceOptions {
  const dbType =
    (process.env.DB_TYPE as 'postgres' | 'mysql' | 'mariadb' | 'mssql') ||
    'mssql';
  const defaultPort =
    dbType === 'mssql' ? 1433 : dbType === 'mysql' ? 3306 : 5432;
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || String(defaultPort), 10);
  const database =
    process.env.NODE_ENV === 'test' && process.env.DB_DATABASE_TEST
      ? process.env.DB_DATABASE_TEST
      : process.env.DB_DATABASE || 'sigasj_db';
  const trustedConnection = process.env.DB_TRUSTED_CONNECTION === 'true';
  const isLocalDb =
    dbType === 'mssql' && host.toLowerCase().includes('localdb');

  const base: DataSourceOptions = {
    type: dbType,
    host,
    port,
    database,
    entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
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
        connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${server};Database=${database};Trusted_Connection=yes;TrustServerCertificate=yes;Connection Timeout=30;Pooling=yes;Max Pool Size=10;Min Pool Size=1;`,
        pool: mssqlPool,
        options: mssqlOptions,
        connectionTimeout: 30_000,
        requestTimeout: 30_000,
      },
    } as DataSourceOptions;
  }

  return {
    ...base,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    extra:
      dbType === 'mssql'
        ? {
            pool: mssqlPool,
            connectionTimeout: 30_000,
            requestTimeout: 30_000,
            options: mssqlOptions,
          }
        : undefined,
  } as DataSourceOptions;
}
