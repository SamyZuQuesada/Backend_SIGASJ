# Backend SIGASJ — SQL Server en Docker (desarrollo local)

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

function Wait-SqlServerContainer {
  param(
    [string]$ContainerName,
    [int]$MaxAttempts = 60
  )

  Write-Host "==> Esperando healthcheck de $ContainerName"
  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    $status = docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $ContainerName 2>$null
    if ($status -eq 'healthy' -or $status -eq 'running') {
      docker exec $ContainerName /opt/mssql-tools18/bin/sqlcmd `
        -S localhost -U sa -P SigasjDev2026 -C -Q "SELECT 1" 1>$null 2>$null
      if ($LASTEXITCODE -eq 0) {
        return
      }
    }
    Start-Sleep -Seconds 2
  }

  Write-Error "SQL Server en Docker no quedó listo. Revise: docker logs $ContainerName"
}

$envPath = Join-Path (Get-Location) '.env'
Write-Host '==> Configurando .env para Docker (sigasj-sqlserver)'
Copy-Item '.env.example' $envPath -Force

Write-Host '==> Levantando contenedor sigasj-sqlserver'
docker compose up -d sqlserver --remove-orphans
if ($LASTEXITCODE -ne 0) {
  Write-Error 'No se pudo iniciar Docker. Abra Docker Desktop e intente de nuevo.'
}

Wait-SqlServerContainer -ContainerName 'sigasj-sqlserver'

Write-Host '==> Inicializando base SIGASJ'
npm run db:init
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host '==> Probando conexion Node -> SQL Server (Docker :1435)'
npm run db:test
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ''
Write-Host 'Docker listo. Siguiente paso:'
Write-Host '  npm run start:dev'
