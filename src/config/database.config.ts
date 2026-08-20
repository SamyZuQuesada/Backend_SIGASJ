import { registerAs } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export default registerAs('database', (): TypeOrmModuleOptions => {
  const dbType = (process.env.DB_TYPE as 'postgres' | 'mysql' | 'mariadb' | 'mssql') || 'postgres';
  const defaultPort = dbType === 'mssql' ? 1433 : dbType === 'mysql' ? 3306 : 5432;

  return {
    type: dbType,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || String(defaultPort), 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'sigasj_db',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: process.env.NODE_ENV === 'development',
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    migrationsRun: false,
    logging: process.env.NODE_ENV === 'development',
    options: dbType === 'mssql' ? { encrypt: false, trustServerCertificate: true } : undefined,
  } as TypeOrmModuleOptions;
});
