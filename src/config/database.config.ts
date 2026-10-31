import { existsSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import {
  TYPEORM_RETRY,
  assertProductionDatabaseEnv,
  buildMssqlExtra,
  parseDbPort,
  resolveMssqlDriverOptions,
} from './mssql-connection';

const nodeRequire = createRequire(__filename);

const tryLoadMssqlNativeDriver = (): unknown => {
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
  assertProductionDatabaseEnv();

  const dbType =
    (process.env.DB_TYPE as 'postgres' | 'mysql' | 'mariadb' | 'mssql') ||
    'mssql';
  const defaultPort =
    dbType === 'mssql' ? 1433 : dbType === 'mysql' ? 3306 : 5432;
  const host = process.env.DB_HOST || 'localhost';
  const database = process.env.DB_DATABASE || 'sigasj_db';
  const trustedConnection = process.env.DB_TRUSTED_CONNECTION === 'true';
  const isLocalDb =
    dbType === 'mssql' && host.toLowerCase().includes('localdb');
  const mssqlOptions = resolveMssqlDriverOptions();

  const base: TypeOrmModuleOptions = {
    type: dbType,
    host,
    database,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    // Producción y resto: esquema solo con `npm run migration:run`.
    synchronize: false,
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    migrationsRun: false,
    subscribers: [__dirname + '/../database/subscribers/*.subscriber{.ts,.js}'],
    logging: process.env.NODE_ENV === 'development',
    retryAttempts: TYPEORM_RETRY.retryAttempts,
    retryDelay: TYPEORM_RETRY.retryDelay,
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
        connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${host};Database=${database};Trusted_Connection=yes;TrustServerCertificate=yes;Connection Timeout=30;Pooling=yes;Max Pool Size=10;Min Pool Size=0;`,
        ...buildMssqlExtra(mssqlOptions),
      },
      options: mssqlOptions,
    };
  }

  if (dbType === 'mssql' && trustedConnection) {
    const driver = tryLoadMssqlNativeDriver();
    if (!driver) {
      return sqlJsFallback(base.entities, base.logging);
    }

    const port = parseDbPort(process.env.DB_PORT, defaultPort);

    return {
      ...base,
      driver,
      port,
      extra: {
        connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${host},${port};Database=${database};Trusted_Connection=yes;TrustServerCertificate=yes;Connection Timeout=30;Pooling=yes;Max Pool Size=10;Min Pool Size=0;`,
        ...buildMssqlExtra(mssqlOptions),
      },
      options: mssqlOptions,
    };
  }

  const username =
    process.env.DB_USERNAME || (dbType === 'mssql' ? undefined : 'postgres');
  const password =
    process.env.DB_PASSWORD || (dbType === 'mssql' ? undefined : 'postgres');

  return {
    ...base,
    port: parseDbPort(process.env.DB_PORT, defaultPort),
    username,
    password,
    extra: dbType === 'mssql' ? buildMssqlExtra(mssqlOptions) : undefined,
    options: dbType === 'mssql' ? mssqlOptions : undefined,
  };
});
