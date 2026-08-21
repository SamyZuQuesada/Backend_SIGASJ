const { existsSync, readFileSync } = require('fs');
const { join } = require('path');
const sql = require('mssql');

function loadEnvFile() {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) {
    return;
  }

  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/u)) {
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

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvFile();

  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '1435';
  const database = process.env.DB_DATABASE || 'SIGASJ';
  const user = process.env.DB_USERNAME || 'sa';
  const password = process.env.DB_PASSWORD || 'SigasjDev2026';

  try {
    await sql.connect(
      `Server=${host},${port};Database=${database};User Id=${user};Password=${password};Encrypt=false;TrustServerCertificate=true;`,
    );
    console.log('SQL_SERVER_OK');
    await sql.close();
  } catch (error) {
    console.error('SQL_SERVER_FAIL', error.message);
    process.exitCode = 1;
  }
}

void main();
