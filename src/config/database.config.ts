import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

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
};

const tryLoadMssqlNativeDriver = (): unknown | undefined => {
  try {
    return nodeRequire('mssql/msnodesqlv8');
  } catch {
    return undefined;
  }
};

const sqlJsFallback = (
  entities: TypeOrmModuleOptions['entities'],
  logging: TypeOrmModuleOptions['logging'],
): TypeOrmModuleOptions => {
  const location = join(process.cwd(), 'data', 'sigasj-local.sqlite');
  const folder = dirname(location);
  if (!existsSync(folder)) {
    mkdirSync(folder, { recursive: true });
  }

  console.warn(
    '[SIGASJ] Windows bloqueó msnodesqlv8 (sqlserver.node). LocalDB no se puede usar.',
  );
  console.warn(
    '[SIGASJ] Arranque temporal con SQL.js en data/sigasj-local.sqlite. No es la base SIGASJ.',
  );
  console.warn(
    '[SIGASJ] Para SQL Server: permite ese .node en Smart App Control o usa DB_HOST=localhost con usuario/contraseña.',
  );

  return {
    type: 'sqljs',
    location,
    autoSave: true,
    entities,
    synchronize: true,
    logging,
  };
};

export default registerAs('database', (): TypeOrmModuleOptions => {
  const dbType =
    (process.env.DB_TYPE as 'postgres' | 'mysql' | 'mariadb' | 'mssql') ||
    'postgres';
  const defaultPort =
    dbType === 'mssql' ? 1433 : dbType === 'mysql' ? 3306 : 5432;
  const host = process.env.DB_HOST || 'localhost';
  const database = process.env.DB_DATABASE || 'sigasj_db';
  const isLocalDb =
    dbType === 'mssql' && host.toLowerCase().includes('localdb');

  const base: TypeOrmModuleOptions = {
    type: dbType,
    host,
    database,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: process.env.NODE_ENV !== 'production',
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    migrationsRun: false,
    logging: process.env.NODE_ENV === 'development',
    retryAttempts: 8,
    retryDelay: 2000,
  };

  if (isLocalDb) {
    const driver = tryLoadMssqlNativeDriver();
    if (!driver) {
      return sqlJsFallback(base.entities, base.logging);
    }

    return {
      ...base,
      driver,
      extra: {
        connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${host};Database=${database};Trusted_Connection=yes;TrustServerCertificate=yes;Connection Timeout=30;Pooling=yes;Max Pool Size=10;Min Pool Size=1;`,
        pool: mssqlPool,
        options: mssqlOptions,
        connectionTimeout: 30_000,
        requestTimeout: 30_000,
      },
      options: mssqlOptions,
    };
  }

  return {
    ...base,
    port: parseInt(process.env.DB_PORT || String(defaultPort), 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    extra:
      dbType === 'mssql'
        ? {
            pool: mssqlPool,
            connectionTimeout: 30_000,
            requestTimeout: 30_000,
          }
        : undefined,
    options: dbType === 'mssql' ? mssqlOptions : undefined,
  };
});
