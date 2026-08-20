# Backend SIGASJ — arranque local (PowerShell)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot ..

Write-Host '==> Copiando .env.example -> .env (si no existe)'
if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
}

Write-Host '==> npm install'
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) {
  Write-Error 'npm install falló. Revise certificados TLS o ejecute en terminal externa.'
}

Write-Host '==> build'
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host '==> tests galería'
npm test -- --testPathPatterns=galeria
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ''
Write-Host 'Base de datos SQL Server (Docker recomendado):'
Write-Host '  npm run db:setup          # .env + contenedor + base SIGASJ + prueba'
Write-Host '  npm run db:up && npm run db:init   # solo contenedor e init'
Write-Host ''
Write-Host 'Alternativa sin Docker: SQL Server del equipo en localhost:1434 (DB_PORT=1434, DB_PASSWORD del equipo)'
Write-Host ''
Write-Host 'Con BD lista:'
Write-Host '  npm run migration:run   # prod / entornos compartidos'
Write-Host '  npm run start:dev       # dev: TypeORM synchronize crea tablas si NODE_ENV=development'
Write-Host ''
