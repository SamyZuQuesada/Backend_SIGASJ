/**
 * SEED DE QA MANUAL — carga datos ricos en TODOS los módulos vía API en vivo.
 *
 * Prerrequisito: backend en marcha (`npm run start:dev`, PORT=3001 según .env).
 *
 * Uso:
 *   node scripts/seed-demo-all.mjs
 *   npm run seed:demo
 *
 * Variables de entorno (todas opcionales):
 *   API_BASE_URL         (default http://localhost:3001/api/v1)
 *   QA_ADMIN_EMAIL       (default admin@asadasanjuan.cr)
 *   QA_ADMIN_PASSWORD    (default Password123!)
 *   QA_FONTANERO_EMAIL   (default fontanero@asadasanjuan.cr)
 *   QA_FONTANERO_PASSWORD(default = QA_ADMIN_PASSWORD, es decir Password123!)
 *
 * Reglas del seed:
 *   - Solo el login del administrador es "hard fail"; el resto usa warn().
 *   - NO inventa Lecturas/Consumos, campos de Junta ni crea Asociados desde afiliación.
 *   - Cada corrida usa stamp=Date.now() para datos únicos y es re-ejecutable.
 *
 * Después, para el KPI legacy de solicitudes del dashboard:
 *   npm run seed:demo:solicitudes-servicio
 */

// ═══════════════════════════════════════════════════════════════════════════
// 1. Configuración
// ═══════════════════════════════════════════════════════════════════════════
const API = (process.env.API_BASE_URL?.trim() || 'http://localhost:3001/api/v1').replace(/\/+$/, '')
const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL?.trim() || 'admin@asadasanjuan.cr'
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD?.trim() || 'Password123!'
const FONTANERO_EMAIL = process.env.QA_FONTANERO_EMAIL?.trim() || 'fontanero@asadasanjuan.cr'
const FONTANERO_PASSWORD = process.env.QA_FONTANERO_PASSWORD?.trim() || ADMIN_PASSWORD

const stamp = Date.now()
const results = []
/** Conteo de lo creado por módulo para el resumen final. */
const creado = {}

const PDF_BYTES = Buffer.from('%PDF-1.4\n%demo\n')
const FIRMA_PNG = 'data:image/png;base64,iVBORw0KGgo='

// ═══════════════════════════════════════════════════════════════════════════
// 2. Helpers de reporte
// ═══════════════════════════════════════════════════════════════════════════
function pass(fase, detail) {
  results.push({ fase, ok: true, detail })
  console.log(`PASS  ${fase}: ${detail}`)
}

function warn(fase, detail) {
  results.push({ fase, ok: true, detail: `WARN ${detail}` })
  console.warn(`WARN  ${fase}: ${detail}`)
}

function fail(fase, detail) {
  results.push({ fase, ok: false, detail })
  console.error(`FAIL  ${fase}: ${detail}`)
  throw new Error(`${fase}: ${detail}`)
}

function contar(modulo, n = 1) {
  creado[modulo] = (creado[modulo] ?? 0) + n
}

function resumirError(body) {
  if (body == null) return ''
  const msg = body.message ?? body.error ?? body.raw ?? body
  const texto = typeof msg === 'string' ? msg : JSON.stringify(msg)
  return texto.length > 300 ? `${texto.slice(0, 300)}…` : texto
}

/** pass() si la respuesta fue OK; si no, warn() (nunca aborta). */
function registrar(fase, res, detalle) {
  if (res?.ok) {
    pass(fase, detalle)
    return true
  }
  warn(fase, `HTTP ${res?.status} ${resumirError(res?.body)}`)
  return false
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Helpers HTTP
// ═══════════════════════════════════════════════════════════════════════════
async function parseRespuesta(res) {
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  return { status: res.status, ok: res.ok, body: json }
}

async function req(method, path, token, body) {
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return await parseRespuesta(res)
  } catch (err) {
    return { status: 0, ok: false, body: { error: String(err?.message ?? err) } }
  }
}

/** Multipart/FormData: NO se fija Content-Type (fetch agrega el boundary). */
async function reqMultipart(method, path, token, formData) {
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    })
    return await parseRespuesta(res)
  } catch (err) {
    return { status: 0, ok: false, body: { error: String(err?.message ?? err) } }
  }
}

/** Arma FormData con campos de texto y, opcionalmente, un PDF mínimo. */
function crearFormData(campos, archivo) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(campos)) {
    if (v !== undefined && v !== null) fd.append(k, String(v))
  }
  if (archivo) {
    fd.append(
      archivo.campo,
      new Blob([PDF_BYTES], { type: 'application/pdf' }),
      archivo.nombre,
    )
  }
  return fd
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Helpers de datos
// ═══════════════════════════════════════════════════════════════════════════
const DIA_MS = 86_400_000

/** Primer elemento tipo lista de respuestas con distintos envoltorios. */
function lista(body) {
  if (Array.isArray(body)) return body
  return body?.data ?? body?.items ?? body?.rows ?? []
}

function pickId(body) {
  return (
    body?.id ??
    body?.data?.id ??
    body?.solicitud?.id ??
    body?.movimiento?.id ??
    body?.data?.movimiento?.id ??
    null
  )
}

/** Cédula nacional de 9 dígitos (formato válido, única por stamp + índice). */
function cedulaDemo(i) {
  return String(100000000 + ((stamp + i * 104729) % 800000000))
}

function cedulaFormateada(i) {
  const c = cedulaDemo(i)
  return `${c[0]}-${c.slice(1, 5)}-${c.slice(5)}`
}

function telefonoDemo(i) {
  return `8${String(800 + (i % 100)).padStart(3, '0')}-${String((stamp + i * 31) % 10000).padStart(4, '0')}`
}

/** YYYY-MM-DD relativo a hoy en hora de Costa Rica (UTC-6). */
function fechaRelativa(dias) {
  return new Date(Date.now() - 6 * 3600_000 + dias * DIA_MS).toISOString().slice(0, 10)
}

function isoRelativo(dias) {
  return new Date(Date.now() + dias * DIA_MS).toISOString()
}

function sumarDias(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + n * DIA_MS).toISOString().slice(0, 10)
}

/** Feriados de Costa Rica (mismo criterio del backend) para evitar fechas inválidas en RRHH. */
function esFeriado(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const fijos = ['01-01', '04-11', '05-01', '07-25', '08-02', '08-15', '08-31', '09-15', '12-01', '12-25']
  if (fijos.includes(`${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)) return true
  const a = y % 19, b = Math.floor(y / 100), c = y % 100
  const dd = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - dd - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const mm = Math.floor((a + 11 * h + 22 * l) / 451)
  const mesP = Math.floor((h + l - 7 * mm + 114) / 31)
  const diaP = ((h + l - 7 * mm + 114) % 31) + 1
  const pascua = `${y}-${String(mesP).padStart(2, '0')}-${String(diaP).padStart(2, '0')}`
  return iso === sumarDias(pascua, -3) || iso === sumarDias(pascua, -2)
}

function esDiaHabil(iso) {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay()
  return dow !== 0 && dow !== 6 && !esFeriado(iso)
}

/**
 * Prueba fechas hábiles consecutivas desde `inicio` hasta que `fn(inicio, fin)` responda OK
 * (reintenta ante 400/409 por solapes de corridas anteriores). `dias` = largo del rango.
 */
async function conFechasLibres(inicio, dias, fn, { intentos = 12, paso = 1 } = {}) {
  let cursor = inicio
  let ultimo = null
  let probados = 0
  while (probados < intentos) {
    const fin = sumarDias(cursor, dias - 1)
    if (esDiaHabil(cursor) && esDiaHabil(fin)) {
      probados += 1
      ultimo = await fn(cursor, fin)
      if (ultimo.ok) return { res: ultimo, inicio: cursor, fin }
      if (![400, 409].includes(ultimo.status)) break
      cursor = sumarDias(cursor, Math.max(paso, dias))
    } else {
      cursor = sumarDias(cursor, 1)
    }
  }
  return { res: ultimo, inicio: null, fin: null }
}

/** Ejecuta una sección; cualquier excepción inesperada se degrada a warn(). */
async function seccion(nombre, fn) {
  console.log(`\n── ${nombre} ──`)
  try {
    return await fn()
  } catch (err) {
    warn(nombre, `sección interrumpida: ${err?.message ?? err}`)
    return undefined
  }
}

async function login(email, password) {
  return req('POST', '/auth/login', null, { email, password })
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Sección: Asociados
// ═══════════════════════════════════════════════════════════════════════════
async function seedAsociados(ctx) {
  const { token } = ctx
  const defs = [
    { nombre: 'María', apellidos: 'Solís Vargas', meses: 36 },
    { nombre: 'Carlos', apellidos: 'Mora Jiménez', meses: 30 },
    { nombre: 'Ana', apellidos: 'Rojas Castro', meses: 24 },
    { nombre: 'Luis', apellidos: 'Hernández Soto', meses: 18 },
    { nombre: 'Elena', apellidos: 'Chaves Quirós', meses: 12 },
    { nombre: 'Jorge', apellidos: 'Barrantes Solano', meses: 6 },
  ]
  ctx.asociados = []
  for (const [i, def] of defs.entries()) {
    const cedula = cedulaDemo(i + 1)
    const res = await req('POST', '/asociados', token, {
      nombre: def.nombre,
      apellidos: def.apellidos,
      cedula,
      correoElectronico: `asociado.demo.${stamp}.${i}@asadasanjuan.cr`,
      fechaRegistro: isoRelativo(-def.meses * 30),
    })
    if (registrar('asociados.create', res, `${def.nombre} ${def.apellidos}`)) {
      ctx.asociados.push({ ...def, cedula, cedulaFmt: cedulaFormateada(i + 1), id: pickId(res.body), numero: `AB-${String(1000 + i)}` })
      contar('Asociados')
    }
  }

  // Desactivar y reactivar uno; dejar otro inactivo para ver el filtro en la UI.
  const [, , , aReactivar, aInactivo] = ctx.asociados
  if (aReactivar?.id) {
    const off = await req('PATCH', `/asociados/${aReactivar.id}/estado`, token, {
      activo: false,
      motivo: 'Cambio temporal de domicilio (demo QA).',
    })
    if (registrar('asociados.desactivar', off, `id=${aReactivar.id}`)) {
      const on = await req('PATCH', `/asociados/${aReactivar.id}/estado`, token, { activo: true })
      registrar('asociados.reactivar', on, `id=${aReactivar.id} reactivado`)
    }
  }
  if (aInactivo?.id) {
    const off = await req('PATCH', `/asociados/${aInactivo.id}/estado`, token, {
      activo: false,
      motivo: 'Solicitud de baja voluntaria del servicio (demo QA, queda inactivo).',
    })
    registrar('asociados.inactivo', off, `id=${aInactivo.id} queda INACTIVO`)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. Sección: Averías públicas + flujo admin/fontanero
// ═══════════════════════════════════════════════════════════════════════════
async function seedAverias(ctx) {
  const { token, fontaneroToken, fontaneroId } = ctx
  const defs = [
    {
      nombreReportante: 'Pedro Alfaro Núñez',
      ubicacion: '200 m norte de la plaza, casa amarilla con portón negro',
      sectorComunidad: 'San Juan centro',
      descripcion: 'Fuga visible en tubería de distribución frente a la casa; el agua corre hacia la calle.',
    },
    {
      nombreReportante: 'Laura Méndez Araya',
      ubicacion: 'Calle principal, frente al salón comunal',
      sectorComunidad: 'Barrio Nuevo',
      descripcion: 'Baja presión constante desde hace dos días en toda la cuadra.',
    },
    {
      nombreReportante: 'José Vargas Prado',
      ubicacion: 'Camino a la toma, cerca del tanque elevado',
      sectorComunidad: 'Los Ángeles',
      descripcion: 'Tubería rota con charco permanente en la vía pública.',
    },
    {
      nombreReportante: 'Marta Quesada Brenes',
      ubicacion: 'Residencial Las Palmas, casa #14',
      sectorComunidad: 'Las Palmas',
      descripcion: 'Medidor con fuga interna; el contador gira sin consumo.',
    },
  ]

  const creadas = []
  for (const [i, def] of defs.entries()) {
    const res = await req('POST', '/public/averias', null, {
      ...def,
      identificacionReportante: cedulaFormateada(60 + i),
      telefonoReportante: telefonoDemo(60 + i),
      correoReportante: `reportante.demo.${stamp}.${i}@ejemplo.cr`,
    })
    const data = res.body?.data ?? res.body
    if (registrar('averias.create', res, `código ${data?.codigoSeguimiento ?? '?'}`)) {
      creadas.push({ codigo: data?.codigoSeguimiento, id: null })
      contar('Averías públicas')
    }
  }

  // Resolver ids reales vía listado admin (la API pública solo devuelve el código).
  for (const a of creadas) {
    if (!a.codigo) continue
    const res = await req('GET', `/admin/averias?search=${encodeURIComponent(a.codigo)}&page=1&limit=5`, token)
    const item = lista(res.body).find((x) => x.codigoSeguimiento === a.codigo) ?? lista(res.body)[0]
    a.id = item?.id ?? null
    if (!a.id) warn('averias.resolverId', `Sin id para ${a.codigo}`)
  }
  ctx.averias = creadas

  // Ayudante opcional para la primera asignación.
  const ayudantes = await req('GET', '/admin/averias/ayudantes', token)
  const ayudanteId = lista(ayudantes.body)[0]?.id

  // Plan por avería: [estado revisión?, prioridad, clasificación, asignar?]
  const plan = [
    { prioridad: 'ALTA', clasificacion: 'TUBO_MADRE', asignar: true, resolver: true },
    { prioridad: 'MEDIA', clasificacion: 'TUBO_MEDIDOR', asignar: true, resolver: false },
    { prioridad: 'URGENTE', clasificacion: 'FUGA', asignar: false, resolver: false },
    // La cuarta queda RECIBIDA (KPI averiasReportadas).
  ]

  for (const [i, p] of plan.entries()) {
    const a = creadas[i]
    if (!a?.id) continue
    const base = `/admin/averias/${a.id}`

    registrar('averias.enRevision', await req('PATCH', `${base}/estado`, token, { estado: 'EN_REVISION' }), a.codigo)
    registrar('averias.prioridad', await req('PATCH', `${base}/prioridad`, token, { prioridad: p.prioridad }), `${a.codigo} → ${p.prioridad}`)
    registrar('averias.clasificacion', await req('PATCH', `${base}/clasificacion`, token, { clasificacion: p.clasificacion }), `${a.codigo} → ${p.clasificacion}`)

    if (!p.asignar) continue
    if (!fontaneroId) {
      warn('averias.asignacion', `Sin id de fontanero; se omite asignación de ${a.codigo}`)
      continue
    }
    let asign = await req('PATCH', `${base}/asignacion`, token, {
      fontaneroId,
      ...(i === 0 && ayudanteId ? { ayudanteId } : {}),
    })
    if (!asign.ok && i === 0 && ayudanteId) {
      asign = await req('PATCH', `${base}/asignacion`, token, { fontaneroId })
    }
    if (!registrar('averias.asignacion', asign, `${a.codigo} → fontanero ${fontaneroId}`)) continue
    a.asignada = true
    // Si la asignación no cambió el estado, forzarlo a ASIGNADA (no falla si ya lo está).
    await req('PATCH', `${base}/estado`, token, { estado: 'ASIGNADA' })

    if (fontaneroToken) {
      const obs = await req('POST', `/fontanero/averias/${a.id}/observaciones`, fontaneroToken, {
        observacion: `Visita preliminar: se confirma el reporte en sitio (${p.clasificacion}). Se coordinará cuadrilla y materiales. Seed ${stamp}.`,
      })
      registrar('averias.observacionFontanero', obs, a.codigo)
    }

    if (p.resolver) {
      // Intento 1: el admin pasa a EN_ATENCION; intento 2: el fontanero inicia atención.
      let enAtencion = await req('PATCH', `${base}/estado`, token, { estado: 'EN_ATENCION' })
      if (!enAtencion.ok && fontaneroToken) {
        warn('averias.enAtencion(admin)', `HTTP ${enAtencion.status} ${resumirError(enAtencion.body)} → probando iniciar-atencion`)
        enAtencion = await req('PATCH', `/fontanero/averias/${a.id}/iniciar-atencion`, fontaneroToken, {})
      }
      if (!registrar('averias.enAtencion', enAtencion, a.codigo)) {
        warn('averias.resolver', 'Probable fuera de horario laboral; se omite resolución')
        continue
      }
      if (fontaneroToken) {
        const resuelta = await req('PATCH', `/fontanero/averias/${a.id}/resolver`, fontaneroToken, {
          observacionFinal: 'Se reemplazó el tramo dañado de tubería y se verificó que no continúe la fuga. Presión normalizada.',
        })
        registrar('averias.resolver', resuelta, `${a.codigo} RESUELTA`)
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. Sección: Solicitudes digitales
// ═══════════════════════════════════════════════════════════════════════════
async function subirDocumentoSolicitud(tipoDocumento, nombre) {
  const fd = crearFormData({ tipoDocumento }, { campo: 'archivo', nombre })
  const res = await reqMultipart('POST', '/solicitudes/documentos', null, fd)
  const d = res.body?.data ?? res.body
  if (!res.ok || !d?.id || !d?.tokenReclamo) {
    warn('solicitudes.documento', `${tipoDocumento}: HTTP ${res.status} ${resumirError(res.body)}`)
    return null
  }
  return { id: d.id, tokenReclamo: d.tokenReclamo }
}

async function patchEstadoSolicitud(token, id, estadoNuevo, extra = {}) {
  if (!id) return
  const res = await req('PATCH', `/solicitudes/${id}/estado`, token, { estadoNuevo, ...extra })
  registrar('solicitudes.estado', res, `id=${id} → ${estadoNuevo}`)
}

async function seedSolicitudes(ctx) {
  const { token } = ctx
  const asoc = ctx.asociados ?? []
  const solicitudes = {}

  // --- Arreglo de pago (3) ---
  const plazos = ['6 meses', '12 meses', '3 meses']
  solicitudes.arreglo = []
  for (let i = 0; i < 3; i += 1) {
    const res = await req('POST', '/solicitudes/arreglo-pago', null, {
      nombre: ['Juan Carlos Rodríguez Mora', 'Silvia Araya Campos', 'Mario Zúñiga Peña'][i],
      cedula: cedulaFormateada(100 + i),
      vecinoDe: 'San Juan de Desamparados, 100 m este de la iglesia católica',
      telefono: telefonoDemo(100 + i),
      numeroCuentaServicio: `CTA-DEMO-${stamp}-${i}`,
      montoPrimaInicial: 15000 + i * 7500,
      plazoSeleccionado: plazos[i],
      firma: FIRMA_PNG,
    })
    if (registrar('solicitudes.arregloPago', res, `#${i + 1} ${res.body?.codigoSeguimiento ?? ''}`)) {
      solicitudes.arreglo.push(pickId(res.body))
      contar('Solicitudes')
    }
  }

  // --- Cambio de titular (1) ---
  {
    const res = await req('POST', '/solicitudes/cambio-titular', null, {
      nombreSolicitante: 'Ana Lucía Vargas Quirós',
      identificacionSolicitante: cedulaFormateada(110),
      telefono: telefonoDemo(110),
      nombrePropietarioRegistral: 'Carlos Alberto Mora Jiménez',
      identificacionPropietario: cedulaFormateada(111),
      folioReal: '123456-000',
      planoCatastrado: 'SJ-1234567-2020',
      planoAgrimensura: 'AG-998877-2019',
      naturalezaInmueble: 'Inscrito',
      calidadTitular: 'Propietario',
      nis: `NIS-${String(stamp).slice(-6)}`,
      facturaANombreDe: 'Carlos Alberto Mora Jiménez',
      medioNotificacionPrincipal: 'Correo electrónico',
      medioNotificacionSecundario: 'Teléfono',
      firma: FIRMA_PNG,
    })
    if (registrar('solicitudes.cambioTitular', res, res.body?.codigoSeguimiento ?? '')) {
      solicitudes.cambio = pickId(res.body)
      contar('Solicitudes')
    }
  }

  // --- Afiliación (1): recomendaciones con asociados activos; NO crea Asociado ---
  {
    const r1 = asoc[0]
    const r2 = asoc[1]
    const res = await req('POST', '/solicitudes/afiliacion', null, {
      fechaSolicitud: fechaRelativa(-1),
      nombre: 'María Elena Rodríguez Vargas',
      identificacion: cedulaFormateada(120),
      vecinoDe: 'San Juan, 200 m norte de la plaza',
      estadoCivil: 'Casado(a)',
      telefono: telefonoDemo(120),
      correoElectronico: `afiliacion.demo.${stamp}@ejemplo.cr`,
      numeroAbonado: `AB-${String(stamp).slice(-5)}`,
      numeroPlano: 'SJ-1234567-2020',
      folioReal: '123456-000',
      firmaSolicitante: FIRMA_PNG,
      recomendacion1Nombre: r1 ? `${r1.nombre} ${r1.apellidos}` : 'María Solís Vargas',
      recomendacion1Identificacion: r1?.cedulaFmt ?? cedulaFormateada(1),
      recomendacion1NumeroAbonado: r1?.numero ?? 'AB-1000',
      recomendacion1Firma: FIRMA_PNG,
      recomendacion2Nombre: r2 ? `${r2.nombre} ${r2.apellidos}` : 'Carlos Mora Jiménez',
      recomendacion2Identificacion: r2?.cedulaFmt ?? cedulaFormateada(2),
      recomendacion2NumeroAbonado: r2?.numero ?? 'AB-1001',
      recomendacion2Firma: FIRMA_PNG,
    })
    if (registrar('solicitudes.afiliacion', res, res.body?.codigoSeguimiento ?? '')) {
      solicitudes.afiliacion = pickId(res.body)
      contar('Solicitudes')
    }
  }

  // --- Servicio existente (1). /constancia-servicio es alias → se omite ---
  {
    const res = await req('POST', '/solicitudes/servicio-existente', null, {
      tipoServicio: 'Domiciliar',
      nis: `NIS-${String(stamp).slice(-5)}1`,
      propietarioInmueble: 'María Elena Rodríguez Vargas',
      nombreSolicitante: 'Carlos Alberto Mora Jiménez',
      identificacionSolicitante: cedulaFormateada(130),
      correoElectronico: `servicio.demo.${stamp}@ejemplo.cr`,
      telefono: telefonoDemo(130),
      folioReal: '123456-000',
      planoCatastrado: 'SJ-1234567-2020',
      planoAgrimensura: 'AG-998877-2019',
      naturalezaInmueble: 'Inscrito',
      calidadTitular: 'Propietario',
      provincia: 'San José',
      canton: 'Desamparados',
      distrito: 'San Juan de Dios',
      direccionExacta: '100 m norte de la iglesia, casa esquinera color verde',
      motivo: 'Bono de vivienda',
      tramitePorRealizar: 'Solicitud de bono BANHVI',
      medioNotificacionPrincipal: 'Correo electrónico',
      medioNotificacionSecundario: 'Teléfono',
      firma: FIRMA_PNG,
    })
    if (registrar('solicitudes.servicioExistente', res, res.body?.codigoSeguimiento ?? '')) {
      solicitudes.servicio = pickId(res.body)
      contar('Solicitudes')
    }
  }

  // --- Infraestructura / linderos (1): identificación + plano catastrado + agrimensura ---
  {
    const docs = (
      await Promise.all([
        subirDocumentoSolicitud('identificacion', 'identificacion.pdf'),
        subirDocumentoSolicitud('plano-catastrado', 'plano-catastrado.pdf'),
        subirDocumentoSolicitud('plano-agrimensura', 'plano-agrimensura.pdf'),
      ])
    ).filter(Boolean)
    if (docs.length === 3) {
      const res = await req('POST', '/solicitudes/infraestructura-linderos', null, {
        nis: `NIS-${String(stamp).slice(-5)}2`,
        tipoPersona: 'Persona física',
        nombreFisica: 'María Elena',
        apellidosFisica: 'Rodríguez Vargas',
        identificacionFisica: cedulaFormateada(140),
        telefonoFisica: telefonoDemo(140),
        calidadTitular: 'Propietario',
        provincia: 'San José',
        canton: 'Desamparados',
        distrito: 'San Rafael Arriba',
        direccionExacta: 'Calle Los Cedros, 300 m sur del cementerio',
        folioReal: '654321-000',
        planoCatastrado: 'SJ-7654321-2021',
        planoAgrimensura: 'AG-445566-2021',
        proposito: 'Reunión de fincas',
        medioNotificacionPrincipal: 'Correo electrónico',
        valorNotificacionPrincipal: `linderos.demo.${stamp}@ejemplo.cr`,
        medioNotificacionSecundario: 'Teléfono',
        valorNotificacionSecundario: telefonoDemo(141),
        firma: FIRMA_PNG,
        documentos: docs,
      })
      if (registrar('solicitudes.infraestructuraLinderos', res, res.body?.codigoSeguimiento ?? '')) {
        solicitudes.infra = pickId(res.body)
        contar('Solicitudes')
      }
    } else {
      warn('solicitudes.infraestructuraLinderos', 'No se pudieron subir los 3 documentos; se omite')
    }
  }

  // --- Disponibilidad de servicios (1): identificación + plano catastrado ---
  {
    const docs = (
      await Promise.all([
        subirDocumentoSolicitud('identificacion', 'identificacion.pdf'),
        subirDocumentoSolicitud('plano-catastrado', 'plano-catastrado.pdf'),
      ])
    ).filter(Boolean)
    if (docs.length === 2) {
      const res = await req('POST', '/solicitudes/disponibilidad-servicios', null, {
        tipoPersona: 'Persona física',
        nombreFisica: 'Roberto',
        primerApellidoFisica: 'Campos',
        segundoApellidoFisica: 'Villalobos',
        identificacionFisica: cedulaFormateada(150),
        telefonoFisica: telefonoDemo(150),
        medioNotificacionPrincipal: 'Correo electrónico',
        valorNotificacionPrincipal: `disponibilidad.demo.${stamp}@ejemplo.cr`,
        medioNotificacionSecundario: 'Teléfono',
        valorNotificacionSecundario: telefonoDemo(151),
        provincia: 'San José',
        canton: 'Desamparados',
        distrito: 'San Juan de Dios',
        direccionExacta: 'Lote 12, Calle Real, 500 m este de la escuela',
        folioReal: '777888-000',
        planoCatastrado: 'SJ-1112223-2022',
        nis: `NIS-${String(stamp).slice(-5)}3`,
        naturalezaInmueble: 'Inscrito',
        calidadTitular: 'Propietario',
        proposito: 'Fraccionamiento',
        descripcionProyecto: 'Fraccionamiento de finca madre en 4 lotes residenciales con acceso a calle pública.',
        cantidadDormitorios: 3,
        unidadesHabitacionales: 4,
        areaConstruccion: 185.5,
        niveles: 2,
        caudalRequerido: 0.75,
        autorizacionInspeccion: true,
        firma: FIRMA_PNG,
        documentos: docs,
      })
      if (registrar('solicitudes.disponibilidadServicios', res, res.body?.codigoSeguimiento ?? '')) {
        solicitudes.disponibilidad = pickId(res.body)
        contar('Solicitudes')
      }
    } else {
      warn('solicitudes.disponibilidadServicios', 'No se pudieron subir los documentos; se omite')
    }
  }

  // --- Variedad de estados (la afiliación NO se aprueba: no crea Asociado) ---
  const [a0, a1, a2] = solicitudes.arreglo
  await patchEstadoSolicitud(token, a0, 'EN_REVISION', { observacionPublica: 'Su solicitud está siendo revisada por la administración.' })
  await patchEstadoSolicitud(token, a1, 'APROBADA', {
    observacionPublica: 'Arreglo de pago aprobado. Puede apersonarse a firmar el convenio.',
    notaInterna: 'Aprobado en sesión de comité (demo QA).',
  })
  await patchEstadoSolicitud(token, a2, 'RECHAZADA', {
    observacionPublica: 'No cumple con la prima inicial mínima requerida.',
    notaInterna: 'Rechazo de demostración para QA.',
  })
  await patchEstadoSolicitud(token, solicitudes.cambio, 'EN_REVISION', { observacionPublica: 'Verificando la documentación registral.' })
  await patchEstadoSolicitud(token, solicitudes.infra, 'EN_REVISION', { observacionPublica: 'Inspección técnica programada.' })
  await patchEstadoSolicitud(token, solicitudes.servicio, 'APROBADA', { observacionPublica: 'Constancia lista para retiro en oficina.' })
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. Sección: Inventario
// ═══════════════════════════════════════════════════════════════════════════
async function seedInventario(ctx) {
  const { token, fontaneroToken } = ctx

  // --- Categorías (una exige fecha de vencimiento) ---
  const catTub = await req('POST', '/inventario/categorias', token, {
    nombre: `Tubería y accesorios ${stamp}`,
    descripcion: 'Tubos, codos, válvulas y accesorios PVC/PEAD para la red de distribución.',
    requiereFechaVencimiento: false,
  })
  const catQui = await req('POST', '/inventario/categorias', token, {
    nombre: `Insumos químicos ${stamp}`,
    descripcion: 'Cloro y productos de potabilización con fecha de caducidad.',
    requiereFechaVencimiento: true,
  })
  const catTubId = pickId(catTub.body)
  const catQuiId = pickId(catQui.body)
  registrar('inventario.categoria', catTub, `id=${catTubId}`) && contar('Inventario: categorías')
  registrar('inventario.categoriaVencimiento', catQui, `id=${catQuiId}`) && contar('Inventario: categorías')
  if (!catTubId) return warn('inventario', 'Sin categoría base; se omite el resto del inventario')

  // --- Proveedores (campos completos) ---
  const provDefs = [
    {
      nombre: `Ferretería Central ${stamp}`,
      razonSocial: 'Ferretería Central de Desamparados S.A.',
      identificacion: `3-101-${String(stamp).slice(-6)}`,
      telefono: '2250-1122',
      correo: `ventas.central.${stamp}@ejemplo.cr`,
      direccion: 'Desamparados centro, 150 m sur del Banco Nacional',
      personaContacto: 'Carlos Méndez Rojas',
    },
    {
      nombre: `Químicos del Valle ${stamp}`,
      razonSocial: 'Distribuidora Química del Valle Ltda.',
      identificacion: `3-102-${String(stamp).slice(-6)}`,
      telefono: '2440-8899',
      correo: `pedidos.quimicos.${stamp}@ejemplo.cr`,
      direccion: 'Zona Industrial de Cartago, bodega 8',
      personaContacto: 'Patricia Araya Solís',
    },
  ]
  const provIds = []
  for (const def of provDefs) {
    const res = await req('POST', '/inventario/proveedores', token, def)
    if (registrar('inventario.proveedor', res, def.nombre)) {
      provIds.push(pickId(res.body))
      contar('Inventario: proveedores')
    }
  }
  const [prov1, prov2 = provIds[0]] = provIds
  if (!prov1) return warn('inventario', 'Sin proveedor; se omite el resto del inventario')

  // --- Materiales (con precio) ---
  const matDefs = [
    { clave: 'tubo', nombre: `Tubo PVC 1/2" ${stamp}`, unidadMedida: 'Tubo', stockMinimo: 5, ubicacion: 'Estante A-1', idCategoria: catTubId, idProveedor: prov1, precioUnitario: 4500, descripcion: 'Tubo PVC SDR-17 de 1/2 pulgada, 6 m.', entrada: 40 },
    { clave: 'codo', nombre: `Codo PVC 90° 1/2" ${stamp}`, unidadMedida: 'Unidad', stockMinimo: 10, ubicacion: 'Estante A-2', idCategoria: catTubId, idProveedor: prov1, precioUnitario: 850, descripcion: 'Codo de presión 90 grados.', entrada: 60 },
    { clave: 'cloro', nombre: `Cloro granulado 65% ${stamp}`, unidadMedida: 'Kg', stockMinimo: 8, ubicacion: 'Bodega química', idCategoria: catQuiId ?? catTubId, idProveedor: prov2, precioUnitario: 12500, descripcion: 'Hipoclorito de calcio para potabilización.', entrada: 25, vencimiento: true },
    { clave: 'valvula', nombre: `Válvula de bola 1" ${stamp}`, unidadMedida: 'Unidad', stockMinimo: 15, ubicacion: 'Estante B-1', idCategoria: catTubId, idProveedor: prov1, precioUnitario: 18500, descripcion: 'Válvula de bola de bronce. Material para el flujo de reposición.', entrada: 3 },
    { clave: 'medidor', nombre: `Medidor domiciliar 1/2" ${stamp}`, unidadMedida: 'Unidad', stockMinimo: 12, ubicacion: 'Estante B-2', idCategoria: catTubId, idProveedor: prov2, precioUnitario: 32000, descripcion: 'Medidor de agua clase B. Queda con alerta PENDIENTE.', entrada: 4 },
  ]
  const mats = {}
  for (const def of matDefs) {
    const { clave, entrada, vencimiento, ...payload } = def
    const body = vencimiento
      ? { ...payload, requiereFechaVencimiento: true, fechaVencimiento: fechaRelativa(365) }
      : payload
    const res = await req('POST', '/inventario/materiales', token, body)
    if (!registrar('inventario.material', res, def.nombre)) continue
    mats[clave] = { id: pickId(res.body), prov: def.idProveedor, entrada, precio: def.precioUnitario, nombre: def.nombre }
    contar('Inventario: materiales')
  }

  // --- Entradas (con documento PDF en la primera) ---
  let primeraEntrada = true
  for (const m of Object.values(mats)) {
    const res = await req('POST', '/inventario/entradas', token, {
      idMaterial: m.id,
      cantidad: m.entrada,
      idProveedor: m.prov,
      precioUnitario: m.precio,
      observacion: `Ingreso inicial por compra, factura demo ${stamp}.`,
      fechaMovimiento: new Date().toISOString(),
    })
    if (!registrar('inventario.entrada', res, `${m.nombre} +${m.entrada}`)) continue
    contar('Inventario: entradas')
    const movId = pickId(res.body)
    if (primeraEntrada && movId) {
      primeraEntrada = false
      const doc = await reqMultipart(
        'POST',
        `/inventario/entradas/${movId}/documentos`,
        token,
        crearFormData({}, { campo: 'archivo', nombre: 'factura-demo.pdf' }),
      )
      registrar('inventario.entradaDocumento', doc, `movimiento ${movId}`)
    }
  }

  // --- Salida normal (stock holgado, sin alerta) ---
  if (mats.tubo) {
    const res = await req('POST', '/inventario/salidas', token, {
      idMaterial: mats.tubo.id,
      cantidad: 4,
      observacion: 'Salida por mantenimiento preventivo de red (demo).',
      fechaMovimiento: new Date().toISOString(),
    })
    registrar('inventario.salida', res, `tubo −4`) && contar('Inventario: salidas')
  }

  // --- Alertas: la salida deja el stock bajo el mínimo ---
  for (const clave of ['valvula', 'medidor']) {
    const m = mats[clave]
    if (!m) continue
    const res = await req('POST', '/inventario/salidas', token, {
      idMaterial: m.id,
      cantidad: 1,
      observacion: `Salida que dispara alerta de reposición (${clave}).`,
    })
    registrar('inventario.salidaAlerta', res, `${clave} bajo stock mínimo`) && contar('Inventario: salidas')
  }

  // --- Solicitudes de materiales (fontanero) + aprobación + despacho ---
  const averiaId = (ctx.averias ?? []).find((a) => a.asignada)?.id ?? null
  if (!fontaneroToken || !mats.tubo || !mats.codo) {
    warn('inventario.solicitudMateriales', 'Sin sesión de fontanero o materiales; se omite')
  } else {
    const crearSolicitud = async (materiales, observacion, conAveria) => {
      const cuerpo = { observacion, materiales }
      let res = await req('POST', '/fontanero/solicitudes-materiales', fontaneroToken, {
        ...cuerpo,
        ...(conAveria && averiaId ? { idAveria: averiaId } : {}),
      })
      if (!res.ok && conAveria && averiaId) {
        res = await req('POST', '/fontanero/solicitudes-materiales', fontaneroToken, cuerpo)
      }
      return res
    }

    const sol1 = await crearSolicitud(
      [
        { idMaterial: mats.tubo.id, cantidad: 2, observacion: 'Para reparar tramo dañado' },
        { idMaterial: mats.codo.id, cantidad: 4, observacion: 'Cambios de dirección' },
      ],
      'Materiales para reparación de fuga en tubería de distribución.',
      true,
    )
    const sol1Id = pickId(sol1.body)
    if (registrar('inventario.solicitudMateriales', sol1, `id=${sol1Id}`)) {
      contar('Inventario: solicitudes de materiales')
      const aprob = await req('PATCH', `/admin/solicitudes-materiales/${sol1Id}/aprobar`, token, {})
      if (registrar('inventario.aprobarSolicitud', aprob, `id=${sol1Id}`)) {
        const desp = await req('POST', '/inventario/salidas', token, {
          idMaterial: mats.tubo.id,
          cantidad: 2,
          idSolicitud: sol1Id,
          ...(averiaId ? { idAveria: averiaId } : {}),
          observacion: `Despacho de la solicitud #${sol1Id}.`,
        })
        registrar('inventario.despacho', desp, `solicitud ${sol1Id} despachada`) && contar('Inventario: salidas')
      }
    }

    // Segunda solicitud queda PENDIENTE para probar aprobar/rechazar en la UI.
    const sol2 = await crearSolicitud(
      [{ idMaterial: mats.codo.id, cantidad: 6, observacion: 'Reserva para próxima ruta' }],
      'Solicitud pendiente de revisión (demo QA).',
      false,
    )
    registrar('inventario.solicitudMaterialesPendiente', sol2, `id=${pickId(sol2.body)}`) &&
      contar('Inventario: solicitudes de materiales')
  }

  // --- Cadena alerta → reposición → compra → recepción (solo material válvula) ---
  if (!mats.valvula) return
  const alertasRes = await req('GET', '/admin/inventario/alertas-reposicion?estado=PENDIENTE&page=1&limit=100', token)
  const alerta = lista(alertasRes.body).find((a) => (a.idMaterial ?? a.material?.id) === mats.valvula.id)
  if (!alerta) {
    warn('inventario.alerta', 'No se encontró la alerta de la válvula; se omite cadena de reposición')
    return
  }
  pass('inventario.alerta', `alerta id=${alerta.id} (stock ${alerta.stockActual}/${alerta.stockMinimo})`)
  const cantidadRepo = 30
  const repo = await req('POST', `/admin/inventario/alertas-reposicion/${alerta.id}/reposicion`, token, {
    cantidad: cantidadRepo,
    observacion: 'Reposición generada desde alerta de stock mínimo (demo QA).',
  })
  const repoId = pickId(repo.body)
  if (!registrar('inventario.reposicion', repo, `id=${repoId}`) || !repoId) return
  contar('Inventario: reposiciones')

  const compra = await req('POST', `/admin/inventario/reposiciones/${repoId}/compra`, token, {
    idProveedor: mats.valvula.prov,
    fechaCompra: new Date().toISOString(),
    referenciaCompra: `OC-DEMO-${stamp}`,
    observacion: 'Compra registrada por la administración (demo QA).',
    detalles: [{ idMaterial: mats.valvula.id, cantidad: cantidadRepo, observacion: 'Compra completa' }],
  })
  if (!registrar('inventario.compra', compra, `reposición ${repoId}`)) return

  const recepcion = await req('POST', '/admin/inventario/recepciones', token, {
    idReposicion: repoId,
    observacion: 'Recepción completa en bodega, conforme a factura.',
    detalles: [{ idMaterial: mats.valvula.id, cantidad: cantidadRepo }],
  })
  registrar('inventario.recepcion', recepcion, `reposición ${repoId} recibida`)
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. Sección: RRHH
// ═══════════════════════════════════════════════════════════════════════════
async function seedRrhh(ctx) {
  const { token, fontaneroToken, fontaneroId, fontaneroEmail } = ctx

  // --- Puestos (crear si no existen) ---
  const puestosRes = await req('GET', '/rrhh/puestos', token)
  let puestos = lista(puestosRes.body)
  const asegurarPuesto = async (nombre, critico) => {
    let p = puestos.find((x) => (x.nombre ?? '').toLowerCase() === nombre.toLowerCase())
    if (p) return p.id
    const res = await req('POST', '/rrhh/puestos', token, { nombre, critico, activo: true })
    if (registrar('rrhh.puesto', res, nombre)) {
      contar('RRHH: puestos')
      p = res.body?.data ?? res.body
      puestos = [...puestos, p]
      return p?.id
    }
    return undefined
  }
  const puestoFontaneroId = (await asegurarPuesto('Fontanero', true)) ?? puestos[0]?.id
  const puestoAdminId = (await asegurarPuesto('Asistente administrativo', false)) ?? puestoFontaneroId
  const puestoOperadorId = (await asegurarPuesto('Operador de planta', true)) ?? puestoFontaneroId
  if (!puestoFontaneroId) return warn('rrhh', 'No hay puestos disponibles; se omite RRHH')

  // --- Colaboradores (el primero vinculado al usuario fontanero) ---
  const defs = [
    { nombre: 'Diego', apellidos: 'Campos Rojas', cargo: 'Fontanero', puestoId: puestoFontaneroId, usuarioId: fontaneroId },
    { nombre: 'Sofía', apellidos: 'Núñez Solano', cargo: 'Asistente administrativa', puestoId: puestoAdminId },
    { nombre: 'Andrés', apellidos: 'Villalobos Mena', cargo: 'Operador de planta', puestoId: puestoOperadorId },
  ]
  const colabs = []
  const existentesAntes = await req('GET', '/rrhh/colaboradores?page=1&limit=100', token)
  const listaExistentes = lista(existentesAntes.body)
  for (const [i, def] of defs.entries()) {
    // Evitar duplicar a Diego (u otros) si ya hay un colaborador con el mismo
    // nombre+apellidos, o si el usuario fontanero ya está vinculado.
    const porUsuario = def.usuarioId
      ? listaExistentes.find((c) => Number(c.usuarioId) === Number(def.usuarioId))
      : null
    const porNombre = listaExistentes.find(
      (c) =>
        String(c.nombre || '').toLowerCase() === def.nombre.toLowerCase() &&
        String(c.apellidos || '').toLowerCase() === def.apellidos.toLowerCase() &&
        c.activo !== false,
    )
    const previo = porUsuario || porNombre
    if (previo) {
      if (def.usuarioId && !previo.usuarioId) {
        const link = await req('PATCH', `/rrhh/colaboradores/${previo.id}`, token, {
          usuarioId: def.usuarioId,
        })
        if (registrar('rrhh.colaborador.link', link, `vincular id=${previo.id}`)) {
          previo.usuarioId = def.usuarioId
        }
      }
      pass('rrhh.colaborador', `reutilizado id=${previo.id} (${def.nombre} ${def.apellidos})`)
      colabs.push({ id: previo.id, ...def })
      continue
    }

    const payload = {
      nombre: def.nombre,
      apellidos: def.apellidos,
      cedula: cedulaDemo(40 + i),
      correoElectronico: `colaborador.demo.${stamp}.${i}@asadasanjuan.cr`,
      cargo: def.cargo,
      puestoId: def.puestoId,
      ...(def.usuarioId ? { usuarioId: def.usuarioId } : {}),
    }
    const res = await req('POST', '/rrhh/colaboradores', token, payload)
    if (registrar('rrhh.colaborador', res, `${def.nombre} ${def.apellidos}`)) {
      const created = { id: pickId(res.body), ...def, usuarioId: def.usuarioId ?? null }
      colabs.push(created)
      listaExistentes.push({
        id: created.id,
        nombre: def.nombre,
        apellidos: def.apellidos,
        usuarioId: def.usuarioId ?? null,
        activo: true,
      })
      contar('RRHH: colaboradores')
    } else if (res.status === 409 && def.usuarioId) {
      const existentes = await req('GET', '/rrhh/colaboradores?page=1&limit=100', token)
      const reusado = lista(existentes.body).find((c) => Number(c.usuarioId) === Number(def.usuarioId))
      if (reusado) {
        pass('rrhh.colaborador', `reutilizado id=${reusado.id} (ya vinculado al fontanero)`)
        colabs.push({ id: reusado.id, ...def })
      } else {
        colabs.push(null)
      }
    } else {
      colabs.push(null)
    }
  }
  const [cFontanero, cAdmin, cOperador] = colabs
  ctx.colaboradorFontaneroId = cFontanero?.id ?? null

  // --- Vacaciones: perfiles demo por colaborador (idempotente si ya hay movimientos) ---
  const perfilesVacaciones = [
    {
      colaborador: cFontanero,
      etiqueta: 'Fontanero',
      movimientos: [
        {
          tipo: 'ACUMULADO',
          cantidadDias: 15,
          fecha: '2026-01-15',
          observaciones: 'Acumulado del periodo 2025 (demo QA).',
        },
        {
          tipo: 'DISFRUTADO',
          cantidadDias: 1,
          fecha: '2026-03-10',
          observaciones: 'Día de vacaciones disfrutado (demo QA).',
        },
      ],
    },
    {
      colaborador: cAdmin,
      etiqueta: 'Administrativa',
      movimientos: [
        {
          tipo: 'ACUMULADO',
          cantidadDias: 12,
          fecha: '2026-01-15',
          observaciones: 'Acumulado del periodo 2025 (demo QA).',
        },
        {
          tipo: 'DISFRUTADO',
          cantidadDias: 3,
          fecha: '2026-02-16',
          observaciones: 'Vacaciones de febrero (demo QA).',
        },
        {
          tipo: 'AJUSTE',
          cantidadDias: 1,
          signoAjuste: 1,
          fecha: '2026-03-03',
          observaciones: 'Ajuste por día feriado laborado (demo QA).',
        },
      ],
    },
    {
      colaborador: cOperador,
      etiqueta: 'Operador',
      movimientos: [
        {
          tipo: 'ACUMULADO',
          cantidadDias: 14,
          fecha: '2026-01-20',
          observaciones: 'Acumulado del periodo 2025 (demo QA).',
        },
        {
          tipo: 'DISFRUTADO',
          cantidadDias: 5,
          fecha: '2026-04-06',
          observaciones: 'Semana santa / descanso programado (demo QA).',
        },
        {
          tipo: 'AJUSTE',
          cantidadDias: 2,
          signoAjuste: -1,
          fecha: '2026-05-12',
          observaciones: 'Corrección por duplicidad de acumulación (demo QA).',
        },
      ],
    },
  ]

  for (const perfil of perfilesVacaciones) {
    const colab = perfil.colaborador
    if (!colab?.id) continue
    const balRes = await req(
      'GET',
      `/rrhh/vacaciones/colaboradores/${colab.id}/balance`,
      token,
    )
    const yaTiene = Number(balRes.body?.totalMovimientos ?? 0) > 0
    if (yaTiene) {
      pass(
        `rrhh.vacaciones(${perfil.etiqueta})`,
        `omitido id=${colab.id}: ya tiene ${balRes.body.totalMovimientos} movimiento(s)`,
      )
      continue
    }
    for (const mov of perfil.movimientos) {
      const registrarMov = (fecha) =>
        req('POST', '/rrhh/vacaciones/movimientos', token, {
          colaboradorId: colab.id,
          tipo: mov.tipo,
          cantidadDias: mov.cantidadDias,
          fecha,
          observaciones: mov.observaciones,
          ...(mov.signoAjuste ? { signoAjuste: mov.signoAjuste } : {}),
        })
      let res
      let fechaUsada = mov.fecha
      if (mov.tipo === 'DISFRUTADO') {
        const intento = await conFechasLibres(mov.fecha, mov.cantidadDias, (ini) =>
          registrarMov(ini),
        )
        res = intento.res
        fechaUsada = intento.inicio ?? mov.fecha
      } else {
        res = await registrarMov(mov.fecha)
      }
      const detalle = `${mov.tipo} ${mov.tipo === 'DISFRUTADO' || mov.signoAjuste === -1 ? '−' : '+'}${mov.cantidadDias} (${fechaUsada})`
      if (registrar(`rrhh.vacaciones(${perfil.etiqueta})`, res, detalle)) {
        contar('RRHH: movimientos de vacaciones')
      }
    }
  }

  // Rellenar otros activos sin historial (duplicados de seeds previos, etc.).
  const todosActivos = lista(
    (await req('GET', '/rrhh/colaboradores?page=1&limit=100&activo=true', token)).body,
  ).filter((c) => c.activo !== false)
  const idsPerfil = new Set(
    perfilesVacaciones.map((p) => p.colaborador?.id).filter(Boolean),
  )
  let idxExtra = 0
  for (const colab of todosActivos) {
    if (!colab?.id || idsPerfil.has(colab.id)) continue
    const balRes = await req(
      'GET',
      `/rrhh/vacaciones/colaboradores/${colab.id}/balance`,
      token,
    )
    if (Number(balRes.body?.totalMovimientos ?? 0) > 0) continue
    const adquiridos = 8 + (idxExtra % 5) * 2
    const disfrutados = 1 + (idxExtra % 3)
    idxExtra += 1
    const acum = await req('POST', '/rrhh/vacaciones/movimientos', token, {
      colaboradorId: colab.id,
      tipo: 'ACUMULADO',
      cantidadDias: adquiridos,
      fecha: '2026-01-22',
      observaciones: 'Acumulado del periodo 2025 (demo QA, colaborador adicional).',
    })
    if (!registrar('rrhh.vacaciones(extra)', acum, `id=${colab.id} +${adquiridos}`)) continue
    contar('RRHH: movimientos de vacaciones')
    const { res, inicio } = await conFechasLibres('2026-03-16', disfrutados, (fecha) =>
      req('POST', '/rrhh/vacaciones/movimientos', token, {
        colaboradorId: colab.id,
        tipo: 'DISFRUTADO',
        cantidadDias: disfrutados,
        fecha,
        observaciones: 'Disfrute parcial (demo QA, colaborador adicional).',
      }),
    )
    if (registrar('rrhh.vacaciones(extra)', res, `id=${colab.id} −${disfrutados} (${inicio})`)) {
      contar('RRHH: movimientos de vacaciones')
    }
  }

  // --- Permiso (colaboradora administrativa) ---
  if (cAdmin?.id) {
    const { res, inicio, fin } = await conFechasLibres('2026-03-17', 2, (ini, fin) =>
      req('POST', '/rrhh/permisos', token, {
        colaboradorId: cAdmin.id,
        fechaInicio: ini,
        fechaFin: fin,
        motivo: 'Cita médica y trámite personal',
        observaciones: 'Permiso con goce de salario autorizado por la administración (demo QA).',
      }),
    )
    registrar('rrhh.permiso', res, `${inicio} → ${fin}`) && contar('RRHH: permisos')
  }

  // --- Incapacidad (operador) ---
  if (cOperador?.id) {
    const res = await req('POST', '/rrhh/incapacidades', token, {
      colaboradorId: cOperador.id,
      fechaInicio: '2026-02-02',
      fechaFin: '2026-02-06',
      origen: 'CCSS',
      observaciones: 'Incapacidad por infección respiratoria, boleta CCSS demo.',
    })
    registrar('rrhh.incapacidad', res, 'CCSS 2026-02-02 → 2026-02-06') && contar('RRHH: incapacidades')
  }

  // --- Solicitudes de ausencia del fontanero (PERMISO) + aprobar/rechazar como admin ---
  if (!fontaneroToken || !cFontanero?.id) {
    return warn('rrhh.solicitudAusencia', 'Sin sesión de fontanero o colaborador vinculado; se omite')
  }
  const enviarAusencia = (ini, fin, motivo, conPdf) => {
    const fd = crearFormData(
      {
        tipo: 'PERMISO',
        fechaInicio: ini,
        fechaFin: fin,
        correo: fontaneroEmail,
        motivo,
      },
      conPdf ? { campo: 'documentos', nombre: 'comprobante.pdf' } : undefined,
    )
    return reqMultipart('POST', '/fontanero/solicitudes-ausencia', fontaneroToken, fd)
  }

  const sA = await conFechasLibres('2026-04-14', 2, (ini, fin) =>
    enviarAusencia(ini, fin, 'Trámite en el Registro Nacional y cita médica familiar', true),
  )
  const sB = await conFechasLibres(sA.fin ? sumarDias(sA.fin, 7) : '2026-04-28', 1, (ini, fin) =>
    enviarAusencia(ini, fin, 'Asunto familiar urgente', false),
  )
  const idA = pickId(sA.res?.body)
  const idB = pickId(sB.res?.body)
  if (registrar('rrhh.solicitudAusencia(A)', sA.res, `id=${idA} ${sA.inicio}`)) contar('RRHH: solicitudes de ausencia')
  if (registrar('rrhh.solicitudAusencia(B)', sB.res, `id=${idB} ${sB.inicio}`)) contar('RRHH: solicitudes de ausencia')

  if (idA) {
    registrar('rrhh.aprobarAusencia', await req('PATCH', `/rrhh/solicitudes-ausencia/${idA}/aprobar`, token, {}), `id=${idA}`)
  }
  if (idB) {
    registrar(
      'rrhh.rechazarAusencia',
      await req('PATCH', `/rrhh/solicitudes-ausencia/${idB}/rechazar`, token, {
        motivoRechazo: 'Fechas coinciden con mantenimiento programado de la planta (demo QA).',
      }),
      `id=${idB}`,
    )
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. Sección: Contenido público (proyectos, galería, transparencia, comunicados, contacto, formularios)
// ═══════════════════════════════════════════════════════════════════════════
async function seedContenido(ctx) {
  const { token } = ctx

  // --- Proyectos (3 estados) ---
  const proyectos = [
    { nombre: `Ampliación de red San Juan Norte ${stamp}`, estado: 'EN_PROCESO', encargadoRealizacion: 'Comité de obras / Ing. Mariana Solís', duracion: '6 meses', descripcion: 'Extensión de 1.8 km de tubería PEAD para 45 nuevas conexiones domiciliares.' },
    { nombre: `Construcción de tanque de 200 m³ ${stamp}`, estado: 'PENDIENTE', encargadoRealizacion: 'Junta administradora / Ing. Esteban Mora', duracion: '10 meses', descripcion: 'Nuevo tanque de almacenamiento para mejorar la presión en sectores altos.' },
    { nombre: `Sustitución de tubería madre ${stamp}`, estado: 'COMPLETADO', encargadoRealizacion: 'Equipo de fontanería ASADA', duracion: '3 meses', descripcion: 'Reemplazo de 600 m de tubería de asbesto-cemento por PVC.' },
  ]
  for (const [i, p] of proyectos.entries()) {
    const res = await req('POST', '/admin/proyectos', token, {
      ...p,
      imagenPrincipal: `https://picsum.photos/seed/sigasj-proy-${stamp}-${i}/1200/700`,
    })
    if (registrar('proyectos.create', res, `${p.estado}`)) {
      contar('Proyectos')
      const id = pickId(res.body)
      if (id) await req('PATCH', `/admin/proyectos/${id}/visibilidad`, token, { activo: true })
    }
  }

  // --- Galería (3) ---
  for (let i = 0; i < 3; i += 1) {
    const res = await req('POST', '/admin/galeria', token, {
      titulo: `Obra de captación ${i + 1} · ${stamp}`,
      descripcion: 'Imagen de demostración de la infraestructura del acueducto comunal.',
      textoAlternativo: `Infraestructura ASADA San Juan, vista ${i + 1}`,
      ordenVisualizacion: i + 1,
      activa: true,
      url: `https://picsum.photos/seed/sigasj-gal-${stamp}-${i}/800/600`,
    })
    registrar('galeria.create', res, `foto ${i + 1}`) && contar('Galería')
  }

  // --- Transparencia (2) ---
  const docsTransparencia = [
    { nombre: `Informe de calidad del agua ${stamp}`, descripcionBreve: 'Resultados trimestrales de análisis fisicoquímicos y bacteriológicos.' },
    { nombre: `Estados financieros anuales ${stamp}`, descripcionBreve: 'Estados financieros auditados del último periodo fiscal.' },
  ]
  for (const [i, d] of docsTransparencia.entries()) {
    const res = await req('POST', '/admin/transparencia', token, {
      ...d,
      ordenVisualizacion: i + 1,
      activa: true,
      tipoArchivo: 'pdf',
      archivoUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    })
    registrar('transparencia.create', res, d.nombre) && contar('Transparencia')
  }

  // --- Comunicados (2, campos completos) ---
  const comunicados = [
    {
      titulo: `Corte programado por mantenimiento ${stamp}`,
      descripcion: 'Suspensión temporal del servicio en el sector norte por reparación de tubería madre.',
      contenido: 'Se informa a los abonados que el sábado, de 8:00 a.m. a 2:00 p.m., el servicio de agua estará suspendido en San Juan Norte. Se recomienda almacenar agua con anticipación.',
      tipo: 'Mantenimiento',
      prioridad: 'Alta',
      fechaExpiracion: isoRelativo(30),
    },
    {
      titulo: `Asamblea general de asociados ${stamp}`,
      descripcion: 'Convocatoria a la asamblea ordinaria anual de la ASADA.',
      contenido: 'Se convoca a todos los asociados activos a la asamblea general ordinaria. Se presentará el informe de labores y el presupuesto del próximo periodo.',
      tipo: 'Comunicado',
      prioridad: 'Media',
      fechaExpiracion: isoRelativo(60),
    },
  ]
  for (const [i, c] of comunicados.entries()) {
    const res = await req('POST', '/admin/comunicados', token, {
      ...c,
      estado: 'Activo',
      esPublico: true,
      fechaPublicacion: new Date().toISOString(),
      imagenUrl: `https://picsum.photos/seed/sigasj-com-${stamp}-${i}/900/500`,
    })
    registrar('comunicados.create', res, c.tipo) && contar('Comunicados')
  }

  // --- Contacto institucional ---
  const contacto = await req('PUT', '/admin/contacto', token, {
    telefono: '2250-0000',
    email: 'info@asadasanjuan.cr',
    direccion: 'San Juan de Desamparados, 100 m este de la iglesia católica',
    horarioAtencion: 'Lunes a viernes de 7:30 a.m. a 4:00 p.m.',
    referenciaUbicacion: 'Frente al salón comunal, edificio de dos plantas color celeste',
    mapaUrl: 'https://maps.google.com/?q=9.8997,-84.0679',
    latitud: 9.8997,
    longitud: -84.0679,
    zoomMapa: 16,
  })
  registrar('contacto.update', contacto, 'datos de contacto completos')
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. Sección: Formularios descargables (multipart)
// ═══════════════════════════════════════════════════════════════════════════
async function seedFormularios(ctx) {
  const { token } = ctx
  const defs = [
    { nombre: `Formulario de solicitud de nueva conexión ${stamp}`, descripcion: 'Complete y presente en oficina junto con copia de cédula y plano catastrado.' },
    { nombre: `Formulario de reporte de avería ${stamp}`, descripcion: 'Formato físico para reportar averías cuando no hay acceso a internet.' },
  ]
  for (const [i, d] of defs.entries()) {
    const fd = crearFormData(
      {
        nombre: d.nombre,
        descripcion: d.descripcion,
        activo: 'true',
        fechaPublicacion: new Date().toISOString(),
      },
      { campo: 'archivo', nombre: `formulario-demo-${i + 1}.pdf` },
    )
    const res = await reqMultipart('POST', '/admin/formularios-descargables', token, fd)
    registrar('formularios.create', res, d.nombre) && contar('Formularios descargables')
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 12. Sección: Actividades del fontanero
// ═══════════════════════════════════════════════════════════════════════════
const DATOS_POR_TIPO = {
  CONTROL_FUGAS: {
    titulo: 'Control de fugas sector Los Ángeles',
    ubicacion: 'Los Ángeles, camino a la toma',
    ubicacionFuga: 'Unión de tubería de 2" a 50 m del tanque elevado',
    descripcion: 'Recorrido de inspección; se detectó fuga menor en unión.',
  },
  TOMA_PRESION: {
    titulo: 'Toma de presión red principal',
    ubicacion: 'Barrio Nuevo, hidrante frente al salón comunal',
    presionMedida: 42.5,
    descripcion: 'Medición de presión en hora pico.',
  },
  VISITA_CAMPO: {
    titulo: 'Visita de campo a nueva urbanización',
    ubicacion: 'Residencial Las Palmas',
    resultadoVisita: 'Se verificó el punto de conexión y se acordó la ubicación del medidor con el desarrollador.',
    descripcion: 'Inspección previa a conexión de lotes.',
  },
  CONTROL_CLOROS: {
    titulo: 'Control de cloro residual',
    ubicacion: 'Tanque de almacenamiento principal',
    cantidadCloro: 1.2,
    descripcion: 'Lectura de cloro residual libre en salida del tanque.',
  },
  CONTROL_OPERATIVO: {
    titulo: 'Control operativo de caudal en captación',
    ubicacion: 'Naciente La Esperanza',
    caudal: 3.4,
    descripcion: 'Aforo y revisión de válvulas en la captación.',
  },
}

async function seedActividades(ctx) {
  const { token, fontaneroToken } = ctx
  if (!fontaneroToken) return warn('actividades', 'Sin sesión de fontanero; se omite')

  const tiposRes = await req('GET', '/fontanero/actividades/tipos', fontaneroToken)
  const tipos = lista(tiposRes.body)
  if (!tiposRes.ok || tipos.length === 0) {
    return warn('actividades.tipos', `HTTP ${tiposRes.status} sin tipos activos`)
  }
  pass('actividades.tipos', tipos.map((t) => t.codigo).join(', '))

  const fecha = fechaRelativa(-1) // ayer: la fecha de actividad no puede ser futura
  const creadas = []
  for (const [i, tipo] of tipos.entries()) {
    const especifico = DATOS_POR_TIPO[tipo.codigo]
    if (!especifico) {
      warn('actividades.create', `Tipo ${tipo.codigo} sin plantilla; se omite`)
      continue
    }
    const res = await req('POST', '/fontanero/actividades', fontaneroToken, {
      tipoActividadId: tipo.id,
      fechaActividad: fecha,
      horaInicio: '07:30',
      fechaFin: fecha,
      horaFin: `${String(10 + (i % 5)).padStart(2, '0')}:45`,
      observaciones: `Registro de demostración generado por el seed (${stamp}).`,
      ...especifico,
    })
    if (registrar('actividades.create', res, `${tipo.codigo}`)) {
      creadas.push({ id: pickId(res.body), codigo: tipo.codigo })
      contar('Actividades de fontanero')
    }
  }

  const aRevisar = creadas.find((a) => a.id)
  if (aRevisar) {
    const res = await req('PATCH', `/admin/actividades/${aRevisar.id}/revisar`, token, {
      estado: 'APROBADA',
      observacion: 'Actividad revisada y aprobada por la administración (demo QA).',
    })
    registrar('actividades.revisar', res, `id=${aRevisar.id} (${aRevisar.codigo}) → APROBADA`)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 13. Verificación de KPIs y resumen
// ═══════════════════════════════════════════════════════════════════════════
async function verificarKpis(token) {
  const [asocList, averiaList, alertas, solsPend, solsRev] = await Promise.all([
    req('GET', '/asociados?activo=true&page=1&limit=1', token),
    req('GET', '/admin/averias?page=1&limit=1&estado=RECIBIDA', token),
    req('GET', '/admin/inventario/alertas-reposicion?estado=PENDIENTE&page=1&limit=1', token),
    req('GET', '/solicitudes?page=1&limit=1&estado=PENDIENTE', token),
    req('GET', '/solicitudes?page=1&limit=1&estado=EN_REVISION', token),
  ])
  const kpi = {
    asociadosActivos: asocList.body?.total ?? null,
    averiasRecibidas: averiaList.body?.total ?? null,
    alertasPendientes: alertas.body?.total ?? null,
    solicitudesPendiente: solsPend.body?.total ?? null,
    solicitudesEnRevision: solsRev.body?.total ?? null,
  }
  console.log('KPI actuales:', JSON.stringify(kpi, null, 2))
}

function imprimirResumen() {
  console.log('\n══════════ RESUMEN DE DATOS CREADOS ══════════')
  const entradas = Object.entries(creado)
  if (entradas.length === 0) console.log('(no se creó ningún registro)')
  for (const [modulo, n] of entradas) console.log(`  • ${modulo}: ${n}`)

  const advertencias = results.filter((r) => r.detail.startsWith('WARN')).length
  const fallos = results.filter((r) => !r.ok).length
  console.log('──────────────────────────────────────────────')
  console.log(`Pasos: ${results.length} · advertencias: ${advertencias} · fallos: ${fallos}`)

  console.log('\n══════════ CREDENCIALES PARA QA MANUAL ══════════')
  console.log(`  Administradora: ${ADMIN_EMAIL}  /  ${ADMIN_PASSWORD}`)
  console.log(`  Fontanero:      ${FONTANERO_EMAIL}  /  ${FONTANERO_PASSWORD}`)
  console.log(`  API:            ${API}`)
  console.log('\nRecordatorios:')
  console.log('  - El asociado inactivo queda así a propósito (filtro de estado en la UI).')
  console.log('  - La afiliación queda PENDIENTE: no se crea Asociado automáticamente.')
  console.log('  - No se cargan Lecturas/Consumos ni campos de Junta (fuera del alcance del seed).')
  console.log('\nSugerido (opcional, no bloqueante) para el KPI legacy de solicitudes del dashboard:')
  console.log('  npm run seed:demo:solicitudes-servicio')
}

// ═══════════════════════════════════════════════════════════════════════════
// 14. Main
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`API: ${API}`)
  console.log(`Admin: ${ADMIN_EMAIL} · Fontanero: ${FONTANERO_EMAIL}`)
  console.log(`Stamp: ${stamp}`)

  // Único paso "hard fail": login de la administradora.
  const loginAdmin = await login(ADMIN_EMAIL, ADMIN_PASSWORD)
  if (!loginAdmin.ok || !loginAdmin.body?.accessToken) {
    fail('login', `HTTP ${loginAdmin.status} ${JSON.stringify(loginAdmin.body)}`)
  }
  const ctx = {
    token: loginAdmin.body.accessToken,
    fontaneroToken: null,
    fontaneroId: null,
    fontaneroEmail: FONTANERO_EMAIL,
    asociados: [],
    averias: [],
  }
  pass('login', `admin rol ${loginAdmin.body.user?.role ?? '?'}`)

  // Login del fontanero (soft): habilita averías, materiales, RRHH y actividades.
  const loginFont = await login(FONTANERO_EMAIL, FONTANERO_PASSWORD)
  if (loginFont.ok && loginFont.body?.accessToken) {
    ctx.fontaneroToken = loginFont.body.accessToken
    ctx.fontaneroId = loginFont.body.user?.idUsuario ?? loginFont.body.user?.id ?? null
    pass('login.fontanero', `rol ${loginFont.body.user?.role ?? '?'}`)
  } else {
    warn('login.fontanero', `HTTP ${loginFont.status} ${resumirError(loginFont.body)} — se omiten pasos del fontanero`)
  }

  // Id numérico del fontanero (Usuario.idUsuario) desde GET /usuarios.
  const usuarios = await req('GET', '/usuarios', ctx.token)
  const usuarioFontanero = lista(usuarios.body).find(
    (u) => (u.correo ?? u.email ?? '').toLowerCase() === FONTANERO_EMAIL.toLowerCase(),
  )
  if (usuarioFontanero?.id) {
    ctx.fontaneroId = usuarioFontanero.id
    pass('usuarios.fontanero', `id=${ctx.fontaneroId}`)
  } else if (ctx.fontaneroId) {
    warn('usuarios.fontanero', `No aparece en /usuarios; se usa id del login (${ctx.fontaneroId})`)
  } else {
    warn('usuarios.fontanero', 'No se pudo resolver el id del fontanero')
  }

  await seccion('Asociados', () => seedAsociados(ctx))
  await seccion('Averías', () => seedAverias(ctx))
  await seccion('Solicitudes', () => seedSolicitudes(ctx))
  await seccion('Inventario', () => seedInventario(ctx))
  await seccion('RRHH', () => seedRrhh(ctx))
  await seccion('Contenido público', () => seedContenido(ctx))
  await seccion('Formularios descargables', () => seedFormularios(ctx))
  await seccion('Actividades del fontanero', () => seedActividades(ctx))
  await seccion('KPIs', () => verificarKpis(ctx.token))

  imprimirResumen()
  if (results.some((r) => !r.ok)) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
