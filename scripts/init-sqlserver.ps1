# Crea la base SIGASJ en el contenedor local de SQL Server (Docker).

$ErrorActionPreference = 'Stop'

$containerName = 'sigasj-sqlserver'
$databaseName = if ($env:DB_DATABASE) { $env:DB_DATABASE } else { 'SIGASJ' }
# Debe coincidir con MSSQL_SA_PASSWORD en docker-compose.yml (no usar DB_PASSWORD del equipo).
$saPassword = if ($env:MSSQL_SA_PASSWORD) { $env:MSSQL_SA_PASSWORD } else { 'SigasjDev2026' }

Write-Host "==> Esperando SQL Server en contenedor $containerName"
$ready = $false
for ($attempt = 1; $attempt -le 30; $attempt++) {
  docker exec $containerName /opt/mssql-tools18/bin/sqlcmd `
    -S localhost -U sa -P $saPassword -C -Q "SELECT 1" 1>$null 2>$null
  if ($LASTEXITCODE -eq 0) {
    $ready = $true
    break
  }
  Start-Sleep -Seconds 2
}

if (-not $ready) {
  Write-Error "SQL Server no respondió a tiempo. Revise Docker Desktop y el contenedor $containerName."
}

Write-Host "==> Creando base $databaseName (si no existe)"
docker exec $containerName /opt/mssql-tools18/bin/sqlcmd `
  -S localhost -U sa -P $saPassword -C `
  -Q "IF DB_ID(N'$databaseName') IS NULL CREATE DATABASE [$databaseName];"

if ($LASTEXITCODE -ne 0) {
  Write-Error 'No se pudo crear o verificar la base de datos SIGASJ.'
}

Write-Host "Base $databaseName lista."
