require('dotenv').config();

const { spawnSync } = require('node:child_process');
const path = require('node:path');

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
    path.join(__dirname, '..', 'src', 'database', 'run-migrations.ts'),
  ],
  { stdio: 'inherit', env: process.env },
);

process.exit(result.status ?? 1);
