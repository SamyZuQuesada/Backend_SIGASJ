/**
 * Prueba integral de galería (API directa contra backend local).
 * Uso: node scripts/e2e-gallery-test.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:3000/api/v1';
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const results = [];
let failed = 0;

function pass(name) {
  results.push({ name, ok: true });
  console.log(`OK  ${name}`);
}

function fail(name, detail) {
  failed += 1;
  results.push({ name, ok: false, detail });
  console.error(`FAIL ${name}: ${detail}`);
}

async function getToken(rol) {
  const res = await fetch(`${BASE}/auth/dev-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rol }),
  });
  if (!res.ok) {
    throw new Error(`dev-token ${rol}: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return data.access_token ?? data.accessToken ?? data.token;
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function createPhoto(token, fields, imagePath, imageName = 'test.png') {
  const form = new FormData();
  const blob = new Blob([readFileSync(imagePath)], { type: 'image/png' });
  form.append('imagen', blob, imageName);
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, String(value));
  }
  const res = await fetch(`${BASE}/admin/galeria`, {
    method: 'POST',
    headers: authHeaders(token),
    body: form,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`create: ${res.status} ${text}`);
  }
  return JSON.parse(text);
}

async function main() {
  mkdirSync(fixturesDir, { recursive: true });
  const img1 = join(fixturesDir, 'gallery-test-1.png');
  const img2 = join(fixturesDir, 'gallery-test-2.png');
  writeFileSync(img1, PNG_1X1);
  writeFileSync(img2, PNG_1X1);

  let adminToken;
  let fontaneroToken;
  let photo1;
  let photo2;

  try {
    adminToken = await getToken('Administradora');
    pass('dev-token Administradora');
  } catch (e) {
    fail('dev-token Administradora', e.message);
    process.exit(1);
  }

  try {
    fontaneroToken = await getToken('Fontanero');
    pass('dev-token Fontanero');
  } catch (e) {
    fail('dev-token Fontanero', e.message);
  }

  // Fontanero no debe crear en galería
  try {
    const form = new FormData();
    form.append('imagen', new Blob([PNG_1X1], { type: 'image/png' }), 'x.png');
    form.append('textoAlternativo', 'test');
    const res = await fetch(`${BASE}/admin/galeria`, {
      method: 'POST',
      headers: authHeaders(fontaneroToken),
      body: form,
    });
    if (res.status === 403) pass('Fontanero bloqueado en POST admin/galeria');
    else fail('Fontanero bloqueado en POST admin/galeria', `status ${res.status}`);
  } catch (e) {
    fail('Fontanero bloqueado en POST admin/galeria', e.message);
  }

  // Crear sin imagen debe fallar
  try {
    const form = new FormData();
    form.append('textoAlternativo', 'sin imagen');
    const res = await fetch(`${BASE}/admin/galeria`, {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: form,
    });
    if (res.status === 400) pass('POST sin imagen rechazado (400)');
    else fail('POST sin imagen rechazado', `status ${res.status}`);
  } catch (e) {
    fail('POST sin imagen rechazado', e.message);
  }

  // Crear sin texto alternativo debe fallar
  try {
    const form = new FormData();
    form.append('imagen', new Blob([PNG_1X1], { type: 'image/png' }), 'x.png');
    const res = await fetch(`${BASE}/admin/galeria`, {
      method: 'POST',
      headers: authHeaders(adminToken),
      body: form,
    });
    if (res.status === 400) pass('POST sin textoAlternativo rechazado (400)');
    else fail('POST sin textoAlternativo rechazado', `status ${res.status}`);
  } catch (e) {
    fail('POST sin textoAlternativo rechazado', e.message);
  }

  try {
    photo1 = await createPhoto(adminToken, {
      titulo: 'Obra comunal ASADA',
      descripcion: 'Tanque principal del acueducto',
      textoAlternativo: 'Tanque elevado ASADA San Juan',
      ordenVisualizacion: 0,
      activo: true,
    }, img1);
    if (photo1.id && photo1.imagenUrl?.startsWith('/uploads/galeria/')) {
      pass('POST foto 1 con todos los campos');
    } else {
      fail('POST foto 1', JSON.stringify(photo1));
    }
  } catch (e) {
    fail('POST foto 1', e.message);
  }

  try {
    photo2 = await createPhoto(adminToken, {
      titulo: 'Asamblea general',
      descripcion: 'Reunión de asociados 2026',
      textoAlternativo: 'Asamblea ASADA San Juan',
      ordenVisualizacion: 1,
      activo: false,
    }, img2);
    pass('POST foto 2 (inactiva)');
  } catch (e) {
    fail('POST foto 2', e.message);
  }

  try {
    const res = await fetch(`${BASE}/public/galeria`);
    const publicList = await res.json();
    if (!Array.isArray(publicList)) throw new Error('no es array');
    const ids = publicList.map((p) => p.id);
    if (publicList.length === 1 && ids.includes(String(photo1.id))) {
      pass('GET public/galeria solo activas');
    } else {
      fail('GET public/galeria solo activas', `count=${publicList.length} ids=${ids.join(',')}`);
    }
    if (publicList[0]?.imageUrl && publicList[0]?.altText) {
      pass('DTO público imageUrl + altText');
    } else {
      fail('DTO público', JSON.stringify(publicList[0]));
    }
  } catch (e) {
    fail('GET public/galeria', e.message);
  }

  try {
    const res = await fetch(`${BASE}/admin/galeria?titulo=asamblea`, {
      headers: authHeaders(adminToken),
    });
    const adminList = await res.json();
    if (adminList.length === 1 && adminList[0].titulo === 'Asamblea general') {
      pass('Filtro admin titulo=asamblea');
    } else {
      fail('Filtro admin titulo', JSON.stringify(adminList));
    }
  } catch (e) {
    fail('Filtro admin titulo', e.message);
  }

  try {
    const res = await fetch(`${BASE}/admin/galeria?activo=false&titulo=Asamblea`, {
      headers: authHeaders(adminToken),
    });
    const inactive = await res.json();
    if (inactive.length === 1 && inactive[0].activo === false && inactive[0].titulo === 'Asamblea general') {
      pass('Filtro admin activo=false + titulo');
    } else {
      fail('Filtro admin activo=false + titulo', JSON.stringify(inactive));
    }
  } catch (e) {
    fail('Filtro admin activo=false + titulo', e.message);
  }

  try {
    const form = new FormData();
    form.append('titulo', 'Obra comunal actualizada');
    form.append('descripcion', 'Descripción editada');
    form.append('textoAlternativo', 'Alt editado');
    form.append('ordenVisualizacion', '2');
    form.append('activo', 'true');
    const res = await fetch(`${BASE}/admin/galeria/${photo1.id}`, {
      method: 'PATCH',
      headers: authHeaders(adminToken),
      body: form,
    });
    const updated = await res.json();
    if (updated.titulo === 'Obra comunal actualizada' && updated.ordenVisualizacion === 2) {
      pass('PATCH metadatos foto 1');
    } else {
      fail('PATCH metadatos', JSON.stringify(updated));
    }
  } catch (e) {
    fail('PATCH metadatos', e.message);
  }

  try {
    const res = await fetch(`${BASE}/admin/galeria/${photo2.id}/activo`, {
      method: 'PATCH',
      headers: {
        ...authHeaders(adminToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ activo: true }),
    });
    const toggled = await res.json();
    if (toggled.activo === true) pass('PATCH activo=true foto 2');
    else fail('PATCH activo', JSON.stringify(toggled));
  } catch (e) {
    fail('PATCH activo', e.message);
  }

  try {
    const res = await fetch(`${BASE}/public/galeria`);
    const publicList = await res.json();
    if (publicList.length === 2) pass('Public galería con 2 activas');
    else fail('Public 2 activas', `count=${publicList.length}`);
  } catch (e) {
    fail('Public 2 activas', e.message);
  }

  // Verificar imagen servida estáticamente
  if (photo1?.imagenUrl) {
    try {
      const imgRes = await fetch(`http://localhost:3000${photo1.imagenUrl}`);
      if (imgRes.ok && imgRes.headers.get('content-type')?.includes('image')) {
        pass('Imagen estática /uploads/galeria/*');
      } else {
        fail('Imagen estática', `status ${imgRes.status}`);
      }
    } catch (e) {
      fail('Imagen estática', e.message);
    }
  }

  // Proxy frontend
  try {
    const res = await fetch('http://localhost:5173/api/v1/public/galeria');
    if (res.ok) pass('Proxy Vite /api/v1/public/galeria');
    else fail('Proxy Vite', `status ${res.status}`);
  } catch (e) {
    fail('Proxy Vite', e.message);
  }

  try {
    const res = await fetch(`${BASE}/admin/galeria/${photo2.id}`, {
      method: 'DELETE',
      headers: authHeaders(adminToken),
    });
    if (res.status === 200 || res.status === 204) pass('DELETE foto 2');
    else fail('DELETE foto 2', `status ${res.status}`);
  } catch (e) {
    fail('DELETE foto 2', e.message);
  }

  try {
    const res = await fetch(`${BASE}/admin/galeria/${photo1.id}`, {
      method: 'DELETE',
      headers: authHeaders(adminToken),
    });
    if (res.status === 200 || res.status === 204) pass('DELETE foto 1');
    else fail('DELETE foto 1', `status ${res.status}`);
  } catch (e) {
    fail('DELETE foto 1', e.message);
  }

  console.log('\n--- Resumen ---');
  console.log(`Total: ${results.length}, OK: ${results.length - failed}, FAIL: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
