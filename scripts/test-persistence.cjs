const { spawnSync } = require('node:child_process');
const path = require('node:path');
const readline = require('node:readline');

// 1. Limpiar cualquier variable de base de datos local que haya quedado en memoria
delete process.env.DB_PASSWORD;
delete process.env.DB_TRUSTED_CONNECTION;

// 2. Establecer con máxima prioridad los valores estrictos de Azure SQL Database
process.env.DB_TYPE = 'mssql';
process.env.DB_HOST = 'sigasj-dev.database.windows.net';
process.env.DB_PORT = '1433';
process.env.DB_NAME = 'sigasj-dev';
process.env.DB_DATABASE = 'sigasj-dev'; // Prevalece sobre cualquier .env local
process.env.DB_USER = 'sigasj_app';
process.env.DB_USERNAME = 'sigasj_app'; // Prevalece sobre cualquier .env local
process.env.DB_ENCRYPT = 'true';
process.env.DB_TRUST_SERVER_CERTIFICATE = 'false';
process.env.DB_SYNCHRONIZE = 'false';

function runPersistenceScript() {
  const tsNodeBin = path.join(
    __dirname,
    '..',
    'node_modules',
    'ts-node',
    'dist',
    'bin.js',
  );

  const result = spawnSync(
    process.execPath,
    [
      tsNodeBin,
      '-r',
      'tsconfig-paths/register',
      path.join(__dirname, '..', 'src', 'database', 'test-persistence.ts'),
    ],
    { stdio: 'inherit', env: process.env },
  );

  process.exit(result.status ?? 1);
}

// 3. Solicitar SIEMPRE la contraseña de sigasj_app de forma privada (sin eco visual y sin cargar la local)
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

process.stdout.write('Ingrese la contraseña de sigasj_app para Azure SQL (entrada privada): ');

const onData = (char) => {
  const s = char.toString();
  if (s === '\n' || s === '\r' || s === '\u0004') return;
  process.stdout.write('\b*');
};
process.stdin.on('data', onData);

rl.question('', (password) => {
  process.stdin.removeListener('data', onData);
  rl.close();
  process.stdout.write('\n\n');

  const trimmed = password.trim();
  if (!trimmed) {
    console.error('Error: La contraseña de sigasj_app es obligatoria para ejecutar la prueba en Azure SQL.');
    process.exit(1);
  }

  process.env.DB_PASSWORD = trimmed;
  runPersistenceScript();
});
