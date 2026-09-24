$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000/api/v1'
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$report = [ordered]@{}

function Invoke-Json {
  param(
    [string]$Method,
    [string]$Url,
    [string]$Token,
    [object]$Body
  )
  $headers = @{ Accept = 'application/json' }
  if ($Token) { $headers.Authorization = "Bearer $Token" }
  $params = @{
    Method = $Method
    Uri = $Url
    Headers = $headers
    TimeoutSec = 30
  }
  if ($null -ne $Body) {
    $params.ContentType = 'application/json'
    $params.Body = ($Body | ConvertTo-Json -Compress)
  }
  try {
    $resp = Invoke-WebRequest @params -UseBasicParsing
    $parsed = $null
    if ($resp.Content) {
      try { $parsed = $resp.Content | ConvertFrom-Json } catch { $parsed = $resp.Content }
    }
    return @{ Status = [int]$resp.StatusCode; Body = $parsed; Error = $null }
  } catch {
    $ex = $_.Exception
    $status = 0
    $body = $null
    if ($ex.Response) {
      $status = [int]$ex.Response.StatusCode
      try {
        $reader = New-Object System.IO.StreamReader($ex.Response.GetResponseStream())
        $raw = $reader.ReadToEnd()
        try { $body = $raw | ConvertFrom-Json } catch { $body = $raw }
      } catch {}
    }
    return @{ Status = $status; Body = $body; Error = $ex.Message }
  }
}

function Login-Dev([string]$email) {
  $r = Invoke-Json -Method POST -Url "$base/auth/login" -Body @{ email = $email; password = 'dev-login' }
  if ($r.Status -ne 200 -or -not $r.Body.accessToken) {
    throw "Login failed for $email status=$($r.Status)"
  }
  return $r.Body.accessToken
}

$payload = @{
  nombreReportante = "E2E PBI28 $stamp"
  identificacionReportante = '1-0000-0000'
  telefonoReportante = '8888-0000'
  ubicacion = 'Calle sintetica E2E 2.8, casa prueba'
  sectorComunidad = 'San Juan'
  descripcion = "Fuga sintetica para cierre PBI 2.8 $stamp"
}

$adminToken = Login-Dev 'admin@asadasanjuan.cr'
$fontToken = Login-Dev 'fontanero@asadasanjuan.cr'
$secToken = Login-Dev 'secretaria@asadasanjuan.cr'
$report.login = 'OK'

$beforeAdmin = Invoke-Json GET "$base/notificaciones" $adminToken
$beforeCount = @($beforeAdmin.Body.data).Count
$report.beforeAdminCount = $beforeCount

$failPost = Invoke-Json POST "$base/public/averias" $null @{ nombreReportante = 'X' }
$afterFailAdmin = Invoke-Json GET "$base/notificaciones" $adminToken
$report.failedPost = @{
  status = $failPost.Status
  inboxUnchanged = (@($afterFailAdmin.Body.data).Count -eq $beforeCount)
}

$okPost = Invoke-Json POST "$base/public/averias" $null $payload
$report.publicCreate = @{ status = $okPost.Status; codigo = $okPost.Body.data.codigoSeguimiento; estado = $okPost.Body.data.estado }
$codigo = $okPost.Body.data.codigoSeguimiento

$adminInbox = Invoke-Json GET "$base/notificaciones" $adminToken
$secInbox = Invoke-Json GET "$base/notificaciones" $secToken
$fontInbox0 = Invoke-Json GET "$base/notificaciones" $fontToken
$matchAdmin = @($adminInbox.Body.data) | Where-Object { $_.titulo -like "*$codigo*" -or $_.mensaje -like "*$codigo*" }
$matchSec = @($secInbox.Body.data) | Where-Object { $_.titulo -like "*$codigo*" -or $_.mensaje -like "*$codigo*" }
$matchFont0 = @($fontInbox0.Body.data) | Where-Object { $_.titulo -like "*$codigo*" -or $_.mensaje -like "*$codigo*" }
$report.inboxAfterCreate = @{
  adminStatus = $adminInbox.Status
  adminNoLeidas = $adminInbox.Body.noLeidas
  adminMatchCount = @($matchAdmin).Count
  secretariaMatchCount = @($matchSec).Count
  fontaneroMatchCount = @($matchFont0).Count
  adminTipo = @($matchAdmin)[0].tipo
  adminLeida = @($matchAdmin)[0].leida
  adminId = @($matchAdmin)[0].id
  adminIdAveria = @($matchAdmin)[0].idAveria
}

$list = Invoke-Json GET "$base/admin/averias?search=$codigo" $adminToken
$averia = @($list.Body.data) | Where-Object { $_.codigoSeguimiento -eq $codigo } | Select-Object -First 1
$report.averiaList = @{ status = $list.Status; id = $averia.id; estado = $averia.estado }

Write-Output ($report | ConvertTo-Json -Depth 6)
$codigo | Out-File -FilePath "$env:TEMP\sigasj-28-codigo.txt" -Encoding utf8
if ($averia.id) { $averia.id | Out-File -FilePath "$env:TEMP\sigasj-28-id.txt" -Encoding utf8 }
if (@($matchAdmin)[0].id) { @($matchAdmin)[0].id | Out-File -FilePath "$env:TEMP\sigasj-28-notif.txt" -Encoding utf8 }
