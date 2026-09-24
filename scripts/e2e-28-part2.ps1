$ErrorActionPreference = 'Stop'
$base = 'http://localhost:3000/api/v1'
$codigo = (Get-Content "$env:TEMP\sigasj-28-codigo.txt").Trim()
$idAveria = [int](Get-Content "$env:TEMP\sigasj-28-id.txt").Trim()
$idNotif = [int](Get-Content "$env:TEMP\sigasj-28-notif.txt").Trim()

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

$adminToken = Login-Dev 'admin@asadasanjuan.cr'
$fontToken = Login-Dev 'fontanero@asadasanjuan.cr'
$secToken = Login-Dev 'secretaria@asadasanjuan.cr'

$afterRestart = Invoke-Json GET "$base/notificaciones" $adminToken
$stillThere = @($afterRestart.Body.data) | Where-Object { $_.id -eq $idNotif }
$report = [ordered]@{
  afterRestart = @{
    status = $afterRestart.Status
    found = (@($stillThere).Count -eq 1)
    leida = @($stillThere)[0].leida
    idAveria = @($stillThere)[0].idAveria
    noLeidas = $afterRestart.Body.noLeidas
  }
}

$lectura = Invoke-Json PATCH "$base/notificaciones/$idNotif/lectura" $adminToken @{}
$afterRead = Invoke-Json GET "$base/notificaciones" $adminToken
$readRow = @($afterRead.Body.data) | Where-Object { $_.id -eq $idNotif }
$report.lecturaPropia = @{
  status = $lectura.Status
  leida = $lectura.Body.leida
  fechaLectura = $lectura.Body.fechaLectura
  getLeida = @($readRow)[0].leida
  noLeidas = $afterRead.Body.noLeidas
}

$ajena = Invoke-Json PATCH "$base/notificaciones/$idNotif/lectura" $fontToken @{}
$report.lecturaAjena = @{ status = $ajena.Status; message = $ajena.Body.message }

# Averia B assignment
$stamp = Get-Date -Format 'HHmmss'
$payloadB = @{
  nombreReportante = "E2E asignacion $stamp"
  telefonoReportante = '8888-1111'
  ubicacion = 'Sitio E2E asignacion 2.8'
  sectorComunidad = 'San Juan'
  descripcion = "Asignacion sintetica PBI 2.8 $stamp"
}
$createB = Invoke-Json POST "$base/public/averias" $null $payloadB
$codigoB = $createB.Body.data.codigoSeguimiento
$listB = Invoke-Json GET "$base/admin/averias?search=$codigoB" $adminToken
$idB = (@($listB.Body.data) | Where-Object { $_.codigoSeguimiento -eq $codigoB } | Select-Object -First 1).id
$estadoRev = Invoke-Json PATCH "$base/admin/averias/$idB/estado" $adminToken @{ estado = 'EN_REVISION' }
$failAssign = Invoke-Json PATCH "$base/admin/averias/$idB/asignacion" $adminToken @{ fontaneroId = 999999 }
$inboxFontFail = Invoke-Json GET "$base/notificaciones" $fontToken
$fontFailMatch = @($inboxFontFail.Body.data) | Where-Object { $_.idAveria -eq $idB }
$okAssign = Invoke-Json PATCH "$base/admin/averias/$idB/asignacion" $adminToken @{ fontaneroId = 3 }
$repeatAssign = Invoke-Json PATCH "$base/admin/averias/$idB/asignacion" $adminToken @{ fontaneroId = 3 }
$inboxFontOk = Invoke-Json GET "$base/notificaciones" $fontToken
$fontOkMatch = @($inboxFontOk.Body.data) | Where-Object { $_.idAveria -eq $idB -and $_.tipo -eq 'AVERIA_ASIGNADA_FONTANERO' }
$inboxAdminB = Invoke-Json GET "$base/notificaciones" $adminToken
$adminAssignMatch = @($inboxAdminB.Body.data) | Where-Object { $_.idAveria -eq $idB -and $_.tipo -eq 'AVERIA_ASIGNADA_FONTANERO' }
$secB = Invoke-Json GET "$base/notificaciones" $secToken
$secAssignMatch = @($secB.Body.data) | Where-Object { $_.idAveria -eq $idB }

$report.asignacion = @{
  codigoB = $codigoB
  idB = $idB
  enRevisionStatus = $estadoRev.Status
  enRevisionEstado = $estadoRev.Body.estado
  failAssignStatus = $failAssign.Status
  fontInboxAfterFail = @($fontFailMatch).Count
  assignStatus = $okAssign.Status
  assignEstado = $okAssign.Body.estado
  assignFontaneroId = $okAssign.Body.fontanero.id
  horario = $okAssign.Body.horarioLaboral
  repeatStatus = $repeatAssign.Status
  fontInboxCount = @($fontOkMatch).Count
  fontNotifId = @($fontOkMatch)[0].id
  fontIdAveria = @($fontOkMatch)[0].idAveria
  adminGotAssignNotif = @($adminAssignMatch).Count
  secretariaGotAny = @($secAssignMatch).Count
}

# Lectura fontanero + GET detalle
$fontRead = $null
if (@($fontOkMatch)[0].id) {
  $fontRead = Invoke-Json PATCH "$base/notificaciones/$(@($fontOkMatch)[0].id)/lectura" $fontToken @{}
}
$fontDetail = Invoke-Json GET "$base/fontanero/averias/$idB" $fontToken
$fontAlien = Invoke-Json GET "$base/fontanero/averias/$idAveria" $fontToken
$iniciar = Invoke-Json PATCH "$base/fontanero/averias/$idB/iniciar-atencion" $fontToken @{}
$resolver = Invoke-Json PATCH "$base/fontanero/averias/$idB/resolver" $fontToken @{ observacionFinal = 'Cierre sintetico E2E 2.8' }

$report.fontaneroNav = @{
  lecturaStatus = $fontRead.Status
  lecturaLeida = $fontRead.Body.leida
  detalleStatus = $fontDetail.Status
  detalleCodigo = $fontDetail.Body.codigoSeguimiento
  alienStatus = $fontAlien.Status
  iniciarStatus = $iniciar.Status
  iniciarMessage = $iniciar.Body.message
  resolverStatus = $resolver.Status
}

# Averia C: EN_REVISION -> PENDIENTE administrativo (ruta 2.3, no GET)
$payloadC = @{
  nombreReportante = "E2E pendiente $stamp"
  telefonoReportante = '8888-2222'
  ubicacion = 'Sitio E2E pendiente 2.8'
  sectorComunidad = 'San Juan'
  descripcion = "Pendiente sintetico PBI 2.8 $stamp"
}
$createC = Invoke-Json POST "$base/public/averias" $null $payloadC
$codigoC = $createC.Body.data.codigoSeguimiento
$listC = Invoke-Json GET "$base/admin/averias?search=$codigoC" $adminToken
$idC = (@($listC.Body.data) | Where-Object { $_.codigoSeguimiento -eq $codigoC } | Select-Object -First 1).id
$revC = Invoke-Json PATCH "$base/admin/averias/$idC/estado" $adminToken @{ estado = 'EN_REVISION' }
$pendC = Invoke-Json PATCH "$base/admin/averias/$idC/estado" $adminToken @{ estado = 'PENDIENTE' }
$getC = Invoke-Json GET "$base/admin/averias/$idC" $adminToken
$report.pendienteAdmin = @{
  codigoC = $codigoC
  idC = $idC
  revStatus = $revC.Status
  pendStatus = $pendC.Status
  pendEstado = $pendC.Body.estado
  getStatus = $getC.Status
}

$codigo | Out-File "$env:TEMP\sigasj-28-codigoA.txt" -Encoding utf8
$codigoB | Out-File "$env:TEMP\sigasj-28-codigoB.txt" -Encoding utf8
$codigoC | Out-File "$env:TEMP\sigasj-28-codigoC.txt" -Encoding utf8
$idB | Out-File "$env:TEMP\sigasj-28-idB.txt" -Encoding utf8

Write-Output ($report | ConvertTo-Json -Depth 8)
