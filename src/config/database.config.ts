import { createRequire } from 'node:module';
import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

const nodeRequire = createRequire(__filename);

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
  };

  if (isLocalDb) {
    return {
      ...base,
      driver: nodeRequire('mssql/msnodesqlv8'),
      extra: {
        connectionString: `Driver={ODBC Driver 17 for SQL Server};Server=${host};Database=${database};Trusted_Connection=yes;TrustServerCertificate=yes;`,
      },
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    };
  }

  return {
    ...base,
    port: parseInt(process.env.DB_PORT || String(defaultPort), 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    options:
      dbType === 'mssql'
        ? { encrypt: false, trustServerCertificate: true }
        : undefined,
  };
});
