/**
 * Carga datos de prueba en los módulos principales vía API local.
 * Prerequisito: backend en marcha (`npm run start:dev`).
 *
 * Uso:
 *   node scripts/seed-demo-all.mjs
 *   API_BASE_URL=http://localhost:3000/api/v1 QA_ADMIN_EMAIL=... QA_ADMIN_PASSWORD=... node scripts/seed-demo-all.mjs
 *
 * Después, para el KPI legacy de solicitudes del dashboard:
 *   npm run seed:demo:solicitudes-servicio
 */
const API = process.env.API_BASE_URL?.trim() || 'http://localhost:3000/api/v1'
const EMAIL = process.env.QA_ADMIN_EMAIL?.trim() || 'admin@asadasanjuan.cr'
const PASSWORD = process.env.QA_ADMIN_PASSWORD?.trim() || 'Password123!'
const stamp = Date.now()
const results = []

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

async function req(method, path, token, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  return { status: res.status, ok: res.ok, body: json }
}

function cedulaDemo(i) {
  // 9 dígitos únicos válidos para formato nacional (sin guiones aceptado)
  const base = 100000000 + ((stamp + i * 137) % 800000000)
  return String(base)
}

async function main() {
  console.log(`API: ${API}`)
  console.log(`Usuario: ${EMAIL}`)
  console.log(`Stamp: ${stamp}`)
  console.log('---')

  const login = await req('POST', '/auth/login', null, {
    email: EMAIL,
    password: PASSWORD,
  })
  if (!login.ok || !login.body?.accessToken) {
    fail('login', `HTTP ${login.status} ${JSON.stringify(login.body)}`)
  }
  const token = login.body.accessToken
  pass('login', `rol ${login.body.user?.role ?? '?'}`)

  // --- Asociados (KPI abonadosActivos) ---
  const asociados = []
  const asociadosDef = [
    { nombre: 'María', apellidos: 'Solís Vargas' },
    { nombre: 'Carlos', apellidos: 'Mora Jiménez' },
    { nombre: 'Ana', apellidos: 'Rojas Castro' },
    { nombre: 'Luis', apellidos: 'Hernández Soto' },
    { nombre: 'Elena', apellidos: 'Chaves Quirós' },
  ]
  for (const [i, def] of asociadosDef.entries()) {
    const cedula = cedulaDemo(i + 1)
    const res = await req('POST', '/asociados', token, {
      nombre: def.nombre,
      apellidos: def.apellidos,
      cedula,
      correoElectronico: `asociado.demo.${stamp}.${i}@asadasanjuan.cr`,
    })
    if (!res.ok) {
      fail('asociados.create', `HTTP ${res.status} ${JSON.stringify(res.body)}`)
    }
    asociados.push(res.body)
  }
  pass('asociados.create', `${asociados.length} asociados activos`)

  // --- Averías públicas (KPI averiasReportadas) ---
  const averias = []
  const averiasDef = [
    {
      nombreReportante: 'Pedro Alfaro',
      ubicacion: '200 m norte de la plaza, casa amarilla',
      sectorComunidad: 'San Juan centro',
      descripcion: 'Fuga visible en tubería de distribución frente a la casa.',
    },
    {
      nombreReportante: 'Laura Méndez',
      ubicacion: 'Calle principal, hidrante frente al salón comunal',
      sectorComunidad: 'Barrio Nuevo',
      descripcion: 'Baja presión constante desde hace dos días.',
    },
    {
      nombreReportante: 'José Vargas',
      ubicacion: 'Camino a la toma, cerca del tanque elevado',
      sectorComunidad: 'Los Ángeles',
      descripcion: 'Tubería rota con charco en la vía pública.',
    },
  ]
  for (const [i, def] of averiasDef.entries()) {
    const res = await req('POST', '/public/averias', null, {
      ...def,
      identificacionReportante: `1-2345-67${80 + i}`,
      telefonoReportante: `8888-12${String(i).padStart(2, '0')}`,
      correoReportante: `reportante.demo.${stamp}.${i}@ejemplo.cr`,
    })
    if (!res.ok) {
      fail('averias.create', `HTTP ${res.status} ${JSON.stringify(res.body)}`)
    }
    averias.push(res.body?.data ?? res.body)
  }
  pass('averias.create', `${averias.length} averías en estado recibida`)

  // --- Solicitudes digitales (módulo admin) ---
  const solicitudes = []
  for (let i = 0; i < 3; i += 1) {
    const res = await req('POST', '/solicitudes/arreglo-pago', null, {
      nombre: `Solicitante Demo ${i + 1}`,
      cedula: `1-1111-0${200 + i}`,
      vecinoDe: 'San Juan de Desamparados, 100 m este de la iglesia',
      telefono: `8700-10${String(i).padStart(2, '0')}`,
      numeroCuentaServicio: `CTA-DEMO-${stamp}-${i}`,
      montoPrimaInicial: 15000 + i * 5000,
      plazoSeleccionado: '6 meses',
    })
    if (!res.ok) {
      fail(
        'solicitudes.arregloPago',
        `HTTP ${res.status} ${JSON.stringify(res.body)}`,
      )
    }
    const created = res.body?.data ?? res.body
    solicitudes.push(created)
  }
  // Una en revisión para variedad de estados en el listado admin.
  const firstId =
    solicitudes[0]?.id ??
    solicitudes[0]?.solicitudId ??
    solicitudes[0]?.data?.id
  if (firstId) {
    const revision = await req('PATCH', `/solicitudes/${firstId}/estado`, token, {
      estadoNuevo: 'EN_REVISION',
      observacionPublica: 'En revisión (datos de demostración).',
    })
    if (!revision.ok) {
      warn(
        'solicitudes.enRevision',
        `id=${firstId} HTTP ${revision.status} ${JSON.stringify(revision.body)}`,
      )
    }
  }
  pass('solicitudes.create', `${solicitudes.length} solicitudes digitales en trámite`)

  // --- Inventario + alerta de reposición (KPI alertas) ---
  const cat = await req('POST', '/inventario/categorias', token, {
    nombre: `Demo Tubería ${stamp}`,
    descripcion: 'Categoría demo seed-all',
  })
  if (!cat.ok) fail('inventario.categoria', `HTTP ${cat.status}`)

  const prov = await req('POST', '/inventario/proveedores', token, {
    nombre: `Proveedor Demo ${stamp}`,
    telefono: '2680-9900',
    correo: `proveedor.demo.${stamp}@ejemplo.cr`,
    personaContacto: 'Contacto Demo',
  })
  if (!prov.ok) fail('inventario.proveedor', `HTTP ${prov.status}`)

  const matOk = await req('POST', '/inventario/materiales', token, {
    nombre: `Tubo PVC Demo ${stamp}`,
    unidadMedida: 'Tubo',
    stockMinimo: 5,
    ubicacion: 'Estante Demo A',
    idCategoria: cat.body.id,
    idProveedor: prov.body.id,
    descripcion: 'Material demo con stock saludable',
  })
  if (!matOk.ok) fail('inventario.material', `HTTP ${matOk.status}`)

  const entradaOk = await req('POST', '/inventario/entradas', token, {
    idMaterial: matOk.body.id,
    cantidad: 20,
    idProveedor: prov.body.id,
    observacion: `Entrada demo ${stamp}`,
  })
  if (!entradaOk.ok) fail('inventario.entrada', `HTTP ${entradaOk.status}`)

  const matAlerta = await req('POST', '/inventario/materiales', token, {
    nombre: `Válvula Bajo Stock Demo ${stamp}`,
    unidadMedida: 'Unidad',
    stockMinimo: 15,
    ubicacion: 'Estante Demo B',
    idCategoria: cat.body.id,
    idProveedor: prov.body.id,
    descripcion: 'Material demo para generar alerta de reposición',
  })
  if (!matAlerta.ok) fail('inventario.materialAlerta', `HTTP ${matAlerta.status}`)

  const entradaBaja = await req('POST', '/inventario/entradas', token, {
    idMaterial: matAlerta.body.id,
    cantidad: 3,
    idProveedor: prov.body.id,
    observacion: `Entrada baja demo ${stamp}`,
  })
  if (!entradaBaja.ok) {
    fail('inventario.entradaBaja', `HTTP ${entradaBaja.status}`)
  }
  // La alerta solo se genera al reducir stock (salida), no en la entrada.
  const salidaAlerta = await req('POST', '/inventario/salidas', token, {
    idMaterial: matAlerta.body.id,
    cantidad: 1,
    observacion: `Salida demo para alerta ${stamp}`,
  })
  if (!salidaAlerta.ok) {
    fail(
      'inventario.salidaAlerta',
      `HTTP ${salidaAlerta.status} ${JSON.stringify(salidaAlerta.body)}`,
    )
  }
  pass(
    'inventario.create',
    `2 materiales; alerta generada vía salida en material id=${matAlerta.body.id}`,
  )

  // --- Comunicados ---
  for (const [i, item] of [
    {
      titulo: `Corte programado demo ${stamp}`,
      tipo: 'Mantenimiento',
      prioridad: 'Alta',
    },
    {
      titulo: `Aviso de junta demo ${stamp}`,
      tipo: 'Comunicado',
      prioridad: 'Media',
    },
  ].entries()) {
    const res = await req('POST', '/admin/comunicados', token, {
      titulo: item.titulo,
      descripcion: 'Comunicado de prueba para demo del panel.',
      contenido:
        'Este es un comunicado de demostración generado por seed-demo-all.',
      tipo: item.tipo,
      prioridad: item.prioridad,
      estado: 'Activo',
      esPublico: true,
      fechaPublicacion: new Date().toISOString(),
    })
    if (!res.ok) {
      fail('comunicados.create', `HTTP ${res.status} ${JSON.stringify(res.body)}`)
    }
  }
  pass('comunicados.create', '2 comunicados públicos')

  // --- Proyectos ---
  for (const nombre of [
    `Ampliación de red demo ${stamp}`,
    `Mejora de tanque demo ${stamp}`,
  ]) {
    const res = await req('POST', '/admin/proyectos', token, {
      nombre,
      descripcion: 'Proyecto de demostración ASADA San Juan.',
      encargadoRealizacion: 'Comité de obras',
      duracion: '6 meses',
      estado: 'EN_PROCESO',
    })
    if (!res.ok) {
      fail('proyectos.create', `HTTP ${res.status} ${JSON.stringify(res.body)}`)
    }
  }
  pass('proyectos.create', '2 proyectos')

  // --- Galería ---
  for (let i = 0; i < 3; i += 1) {
    const res = await req('POST', '/admin/galeria', token, {
      titulo: `Foto demo ${i + 1} ${stamp}`,
      descripcion: 'Imagen de demostración del acueducto.',
      textoAlternativo: `Infraestructura ASADA demo ${i + 1}`,
      ordenVisualizacion: i + 1,
      activa: true,
      url: `https://picsum.photos/seed/sigasj${stamp}${i}/800/600`,
    })
    if (!res.ok) {
      fail('galeria.create', `HTTP ${res.status} ${JSON.stringify(res.body)}`)
    }
  }
  pass('galeria.create', '3 fotos')

  // --- Transparencia ---
  for (const [i, nombre] of [
    `Informe de calidad del agua demo ${stamp}`,
    `Estados financieros demo ${stamp}`,
  ].entries()) {
    const res = await req('POST', '/admin/transparencia', token, {
      nombre,
      descripcionBreve: 'Documento de demostración para el portal público.',
      ordenVisualizacion: i + 1,
      activa: true,
      tipoArchivo: 'pdf',
      archivoUrl: `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf`,
    })
    if (!res.ok) {
      fail(
        'transparencia.create',
        `HTTP ${res.status} ${JSON.stringify(res.body)}`,
      )
    }
  }
  pass('transparencia.create', '2 documentos')

  // --- RRHH colaboradores ---
  const puestos = await req('GET', '/rrhh/puestos', token)
  const listaPuestos = Array.isArray(puestos.body)
    ? puestos.body
    : (puestos.body?.data ?? puestos.body?.items ?? [])
  const puestoId =
    listaPuestos.find((p) => /fontanero/i.test(p.nombre ?? ''))?.id ??
    listaPuestos[0]?.id
  if (!puestoId) {
    warn('rrhh.puestos', 'No hay puestos; se omite colaboradores')
  } else {
    for (let i = 0; i < 2; i += 1) {
      const res = await req('POST', '/rrhh/colaboradores', token, {
        nombre: i === 0 ? 'Diego' : 'Sofía',
        apellidos: i === 0 ? 'Campos Rojas' : 'Núñez Solano',
        cedula: cedulaDemo(40 + i),
        correoElectronico: `colaborador.demo.${stamp}.${i}@asadasanjuan.cr`,
        cargo: 'Fontanero',
        puestoId,
      })
      if (!res.ok) {
        warn(
          'rrhh.colaboradores',
          `HTTP ${res.status} ${JSON.stringify(res.body)}`,
        )
      }
    }
    pass('rrhh.colaboradores', `puestoId=${puestoId}`)
  }

  // --- Verificación rápida de KPIs ---
  const [asocList, averiaList, alertas, solsPend, solsRev] = await Promise.all([
    req('GET', '/asociados?activo=true&page=1&limit=1', token),
    req('GET', '/admin/averias?page=1&limit=1&estado=RECIBIDA', token),
    req(
      'GET',
      '/admin/inventario/alertas-reposicion?estado=PENDIENTE&page=1&limit=1',
      token,
    ),
    req('GET', '/solicitudes?page=1&limit=1&estado=PENDIENTE', token),
    req('GET', '/solicitudes?page=1&limit=1&estado=EN_REVISION', token),
  ])

  const kpi = {
    asociados: asocList.body?.total ?? null,
    averiasRecibidas: averiaList.body?.total ?? null,
    alertasPendientes: alertas.body?.total ?? null,
    solicitudesPendiente: solsPend.body?.total ?? null,
    solicitudesEnRevision: solsRev.body?.total ?? null,
  }
  console.log('---')
  console.log('KPI actuales:', JSON.stringify(kpi, null, 2))

  const failed = results.filter((r) => !r.ok)
  console.log('---')
  console.log(`Resultado: ${results.length - failed.length}/${results.length} PASS`)
  if (failed.length) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
