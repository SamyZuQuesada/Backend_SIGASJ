/**
 * Prueba flujo front -> proxy Vite -> backend (sin navegador).
 * Uso: node scripts/e2e-frontend-proxy.mjs
 */
const VITE = 'http://localhost:5173';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8AV0QAAAABJRU5ErkJggg==',
  'base64',
);

let failed = 0;
const ok = (m) => console.log(`OK  ${m}`);
const bad = (m, d) => {
  failed += 1;
  console.error(`FAIL ${m}: ${d}`);
};

async function main() {
  const loginRes = await fetch(`${VITE}/api/v1/auth/dev-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rol: 'Secretaria' }),
  });
  if (!loginRes.ok) {
    bad('login Secretaria via proxy', await loginRes.text());
    process.exit(1);
  }
  const { accessToken } = await loginRes.json();
  ok('login Secretaria via proxy');

  const form = new FormData();
  form.append('imagen', new Blob([PNG], { type: 'image/png' }), 'proxy-test.png');
  form.append('titulo', 'Prueba proxy front');
  form.append('descripcion', 'Subida vía proxy Vite');
  form.append('textoAlternativo', 'Imagen de prueba proxy');
  form.append('ordenVisualizacion', '99');
  form.append('activo', 'true');

  const createRes = await fetch(`${VITE}/api/v1/admin/galeria`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  if (!createRes.ok) {
    bad('POST admin/galeria via proxy', await createRes.text());
    process.exit(1);
  }
  const created = await createRes.json();
  ok(`POST admin/galeria via proxy id=${created.id}`);

  const pubRes = await fetch(`${VITE}/api/v1/public/galeria`);
  const pub = await pubRes.json();
  if (pub.some((p) => p.id === String(created.id))) {
    ok('foto visible en galería pública via proxy');
  } else {
    bad('foto en galería pública', 'no encontrada');
  }

  const imgRes = await fetch(`${VITE}${created.imagenUrl}`);
  if (imgRes.ok) ok('imagen servida via proxy /uploads');
  else bad('imagen /uploads proxy', String(imgRes.status));

  const patchRes = await fetch(`${VITE}/api/v1/admin/galeria/${created.id}/activo`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ activo: false }),
  });
  const patched = await patchRes.json();
  if (patched.activo === false) ok('PATCH activo=false via proxy');
  else bad('PATCH activo', JSON.stringify(patched));

  const pub2 = await (await fetch(`${VITE}/api/v1/public/galeria`)).json();
  if (!pub2.some((p) => p.id === String(created.id))) {
    ok('foto inactiva oculta en pública');
  } else {
    bad('foto inactiva oculta', 'sigue visible');
  }

  const delRes = await fetch(`${VITE}/api/v1/admin/galeria/${created.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (delRes.ok || delRes.status === 204) ok('DELETE via proxy');
  else bad('DELETE', String(delRes.status));

  console.log(`\nFallos: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
