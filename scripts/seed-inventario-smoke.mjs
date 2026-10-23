/**
 * Carga datos de inventario en el API local y verifica reglas críticas.
 * Uso: node scripts/seed-inventario-smoke.mjs
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

async function main() {
  console.log(`API: ${API}`)
  console.log(`Usuario: ${EMAIL}`)
  console.log('---')

  const login = await req('POST', '/auth/login', null, {
    email: EMAIL,
    password: PASSWORD,
  })
  if (!login.ok || !login.body?.accessToken) {
    fail('login', `HTTP ${login.status} ${JSON.stringify(login.body)}`)
  }
  const token = login.body.accessToken
  pass('login', `token ok (rol ${login.body.user?.role ?? '?'})`)

  // 1) Categorías
  const cats = []
  for (const nombre of [
    `Tubería QA ${stamp}`,
    `Accesorios QA ${stamp}`,
    `Químicos QA ${stamp}`,
  ]) {
    const res = await req('POST', '/inventario/categorias', token, {
      nombre,
      descripcion: `Categoría de prueba automática ${stamp}`,
    })
    if (!res.ok) fail('categoria.create', `${nombre} → HTTP ${res.status}`)
    cats.push(res.body)
  }
  pass('categoria.create', `${cats.length} categorías creadas`)

  // 2) Proveedores
  const provs = []
  for (const [i, nombre] of [
    `Ferretería QA Central ${stamp}`,
    `Distribuidora QA Norte ${stamp}`,
  ].entries()) {
    const res = await req('POST', '/inventario/proveedores', token, {
      nombre,
      telefono: `2680-11${String(i).padStart(2, '0')}`,
      correo: `ventas.qa.${stamp}.${i}@ejemplo.cr`,
      personaContacto: 'Contacto QA',
    })
    if (!res.ok) fail('proveedor.create', `${nombre} → HTTP ${res.status}`)
    provs.push(res.body)
  }
  pass('proveedor.create', `${provs.length} proveedores creados`)

  // 3) Rechazo: material sin categoría / sin proveedor
  const sinCat = await req('POST', '/inventario/materiales', token, {
    nombre: `Material incompleto sin cat ${stamp}`,
    unidadMedida: 'Unidad',
    stockMinimo: 2,
    idProveedor: provs[0].id,
  })
  if (sinCat.status !== 400) {
    fail('material.reject.sinCategoria', `esperado 400, recibió ${sinCat.status}`)
  }
  pass('material.reject.sinCategoria', 'HTTP 400 correcto')

  const sinProv = await req('POST', '/inventario/materiales', token, {
    nombre: `Material incompleto sin prov ${stamp}`,
    unidadMedida: 'Unidad',
    stockMinimo: 2,
    idCategoria: cats[0].id,
  })
  if (sinProv.status !== 400) {
    fail('material.reject.sinProveedor', `esperado 400, recibió ${sinProv.status}`)
  }
  pass('material.reject.sinProveedor', 'HTTP 400 correcto')

  // 4) Materiales válidos
  const materialesDef = [
    {
      nombre: `Tubo PVC 1/2 QA ${stamp}`,
      unidadMedida: 'Tubo',
      stockMinimo: 10,
      ubicacion: 'Estante A-1',
      idCategoria: cats[0].id,
      idProveedor: provs[0].id,
      entrada: 25,
    },
    {
      nombre: `Válvula bola 1/2 QA ${stamp}`,
      unidadMedida: 'Unidad',
      stockMinimo: 5,
      ubicacion: 'Estante B-2',
      idCategoria: cats[1].id,
      idProveedor: provs[0].id,
      entrada: 12,
    },
    {
      nombre: `Pegamento PVC QA ${stamp}`,
      unidadMedida: 'Tarro',
      stockMinimo: 3,
      ubicacion: 'Estante C-1',
      idCategoria: cats[2].id,
      idProveedor: provs[1].id,
      entrada: 8,
    },
  ]

  const materiales = []
  for (const def of materialesDef) {
    const { entrada, ...payload } = def
    const res = await req('POST', '/inventario/materiales', token, {
      ...payload,
      descripcion: 'Material de prueba automática para auditoría de inventario',
    })
    if (!res.ok) {
      fail('material.create', `${def.nombre} → HTTP ${res.status} ${JSON.stringify(res.body)}`)
    }
    if (res.body.stockActual !== 0) {
      fail('material.create.stockInicial', `${def.nombre} stockActual=${res.body.stockActual}`)
    }
    if (!res.body.idCategoria || !res.body.idProveedor) {
      fail('material.create.relaciones', `${def.nombre} sin categoría/proveedor`)
    }
    materiales.push({ ...res.body, entradaQty: entrada })
  }
  pass(
    'material.create',
    `${materiales.length} materiales con stockActual=0 y cat/prov asignados`,
  )

  // 5) Entradas → actualizar existencias
  for (const mat of materiales) {
    const res = await req('POST', '/inventario/entradas', token, {
      idMaterial: mat.id,
      cantidad: mat.entradaQty,
      idProveedor: mat.idProveedor,
      observacion: `Entrada QA automática ${stamp}`,
    })
    if (!res.ok) {
      fail('entrada.create', `material ${mat.id} → HTTP ${res.status} ${JSON.stringify(res.body)}`)
    }
    const stockActual =
      res.body.stockActual ?? res.body.material?.stockActual ?? res.body?.movimiento?.stockActual
    // Confirmar vía GET
    const detail = await req('GET', `/inventario/materiales/${mat.id}`, token)
    if (!detail.ok) fail('material.detail', `HTTP ${detail.status}`)
    if (detail.body.stockActual !== mat.entradaQty) {
      fail(
        'entrada.stock',
        `${mat.nombre}: esperado ${mat.entradaQty}, actual ${detail.body.stockActual}`,
      )
    }
  }
  pass('entrada.create', 'Entradas registradas y stockActual actualizado')

  // 6) Listado coherente
  const list = await req(
    'GET',
    `/inventario/materiales?nombre=QA%20${stamp}&limit=20`,
    token,
  )
  if (!list.ok) fail('material.list', `HTTP ${list.status}`)
  const encontrados = list.body.data ?? []
  if (encontrados.length < materiales.length) {
    fail(
      'material.list',
      `esperados >= ${materiales.length}, encontrados ${encontrados.length}`,
    )
  }
  pass('material.list', `${encontrados.length} materiales QA visibles en listado`)

  // 7) Rechazo desvincular categoría
  const unlink = await req('PUT', `/inventario/materiales/${materiales[0].id}`, token, {
    idCategoria: null,
  })
  if (unlink.status !== 400) {
    fail('material.reject.unlinkCategoria', `esperado 400, recibió ${unlink.status}`)
  }
  pass('material.reject.unlinkCategoria', 'HTTP 400 correcto')

  console.log('---')
  console.log('Resumen seed inventario:')
  console.log(
    JSON.stringify(
      {
        categorias: cats.map((c) => ({ id: c.id, nombre: c.nombre })),
        proveedores: provs.map((p) => ({ id: p.id, nombre: p.nombre })),
        materiales: materiales.map((m) => ({
          id: m.id,
          nombre: m.nombre,
          stockMinimo: m.stockMinimo,
          stockTrasEntrada: m.entradaQty,
        })),
      },
      null,
      2,
    ),
  )

  const failed = results.filter((r) => !r.ok)
  console.log('---')
  console.log(`Resultado: ${results.length - failed.length}/${results.length} PASS`)
  if (failed.length) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
