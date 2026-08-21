import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { DataSource } from 'typeorm';

type DbType = 'postgres' | 'mysql' | 'mariadb' | 'mssql';

function loadEnvFile(): void {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/u);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (key) {
      process.env[key] = value;
    }
  }
}

function resolveDbType(): DbType {
  const configured = process.env.DB_TYPE as DbType | undefined;
  if (
    configured === 'postgres' ||
    configured === 'mysql' ||
    configured === 'mariadb' ||
    configured === 'mssql'
  ) {
    return configured;
  }

  return 'mssql';
}

function defaultPort(dbType: DbType): number {
  if (dbType === 'mssql') {
    return 1435;
  }
  if (dbType === 'mysql' || dbType === 'mariadb') {
    return 3306;
  }

  return 5432;
}

loadEnvFile();

const dbType = resolveDbType();

export default new DataSource({
  type: dbType,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || String(defaultPort(dbType)), 10),
  username: process.env.DB_USERNAME || (dbType === 'mssql' ? 'sa' : 'postgres'),
  password: process.env.DB_PASSWORD || 'SigasjDev2026',
  database: process.env.DB_DATABASE || (dbType === 'mssql' ? 'SIGASJ' : 'sigasj_db'),
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, './migrations/*{.ts,.js}')],
  synchronize: false,
  options: dbType === 'mssql' ? { encrypt: false, trustServerCertificate: true } : undefined,
});
