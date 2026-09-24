$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000/api/v1'

function Invoke-Json {
  param([string]$Method, [string]$Url, [string]$Token, [object]$Body)
  $headers = @{ Accept = 'application/json' }
  if ($Token) { $headers.Authorization = "Bearer $Token" }
  $params = @{ Method = $Method; Uri = $Url; Headers = $headers; TimeoutSec = 30 }
  if ($null -ne $Body) {
    $params.ContentType = 'application/json'
    $params.Body = ($Body | ConvertTo-Json -Compress)
  }
  try {
    $resp = Invoke-WebRequest @params -UseBasicParsing
    $parsed = $null
    if ($resp.Content) { try { $parsed = $resp.Content | ConvertFrom-Json } catch { $parsed = $resp.Content } }
    return @{ Status = [int]$resp.StatusCode; Body = $parsed }
  } catch {
    $status = 0; $body = $null
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $raw = $reader.ReadToEnd()
        try { $body = $raw | ConvertFrom-Json } catch { $body = $raw }
      } catch {}
    }
    return @{ Status = $status; Body = $body; Error = $_.Exception.Message }
  }
}
function Login-Dev([string]$email) {
  $r = Invoke-Json POST "$base/auth/login" $null @{ email = $email; password = 'dev-login' }
  if ($r.Status -ne 200) { throw "login $email $($r.Status)" }
  return $r.Body.accessToken
}

$admin = Login-Dev 'admin@asadasanjuan.cr'
$font = Login-Dev 'fontanero@asadasanjuan.cr'

# FLUJO 4: PENDIENTE 1005 + horario de prueba → iniciar → resolver
$iniciar = Invoke-Json PATCH "$base/fontanero/averias/1005/iniciar-atencion" $font @{}
$resolver = Invoke-Json PATCH "$base/fontanero/averias/1005/resolver" $font @{ observacionFinal = 'Reparacion sintetica exitosa PBI 2.8.7' }
$dup = Invoke-Json PATCH "$base/admin/averias/1005/estado" $admin @{ estado = 'RESUELTA' }

# FLUJO 1 extra: registro nuevo
$stamp = Get-Date -Format 'HHmmss'
$create = Invoke-Json POST "$base/public/averias" $null @{
  nombreReportante = "E2E resuelta $stamp"
  telefonoReportante = '8888-4444'
  ubicacion = 'Sitio E2E 2.8.7'
  sectorComunidad = 'San Juan'
  descripcion = "Registro para SMS resuelta $stamp"
}
$codigo = $create.Body.data.codigoSeguimiento
$list = Invoke-Json GET "$base/admin/averias?search=$codigo" $admin
$idNew = (@($list.Body.data) | Where-Object { $_.codigoSeguimiento -eq $codigo } | Select-Object -First 1).id
$rev = Invoke-Json PATCH "$base/admin/averias/$idNew/estado" $admin @{ estado = 'EN_REVISION' }
$asg = Invoke-Json PATCH "$base/admin/averias/$idNew/asignacion" $admin @{ fontaneroId = 3 }

$report = [ordered]@{
  iniciar = @{ status = $iniciar.Status; estado = $iniciar.Body.estado; message = $iniciar.Body.message }
  resolver = @{ status = $resolver.Status; message = $resolver.Body.message; estado = $resolver.Body.data.estado }
  dupAdminResuelta = @{ status = $dup.Status; message = $dup.Body.message }
  nuevo = @{
    createStatus = $create.Status
    codigo = $codigo
    id = $idNew
    revStatus = $rev.Status
    assignStatus = $asg.Status
    assignEstado = $asg.Body.estado
  }
}
Write-Output ($report | ConvertTo-Json -Depth 6)
if ($codigo) { $codigo | Out-File "$env:TEMP\sigasj-28-codigoD.txt" -Encoding utf8 }
