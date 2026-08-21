/**
 * Siembra fotos de demo para probar la galería en el front.
 * Uso: node scripts/seed-gallery-demo.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:3000/api/v1';
const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, 'fixtures');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8AV0QAAAABJRU5ErkJggg==',
  'base64',
);

async function getToken() {
  const res = await fetch(`${BASE}/auth/dev-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rol: 'Administradora' }),
  });
  const data = await res.json();
  return data.accessToken ?? data.access_token ?? data.token;
}

async function create(token, fields, filePath) {
  const form = new FormData();
  form.append('imagen', new Blob([readFileSync(filePath)], { type: 'image/png' }), 'demo.png');
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
  const res = await fetch(`${BASE}/admin/galeria`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function main() {
  mkdirSync(fixturesDir, { recursive: true });
  const img = join(fixturesDir, 'demo-seed.png');
  writeFileSync(img, PNG);
  const token = await getToken();

  const demos = [
    {
      titulo: 'Tanque principal ASADA',
      descripcion: 'Infraestructura de almacenamiento comunal.',
      textoAlternativo: 'Tanque elevado de la ASADA San Juan',
      ordenVisualizacion: 0,
      activo: true,
    },
    {
      titulo: 'Red de distribución',
      descripcion: 'Tubería en sector central.',
      textoAlternativo: 'Tuberías del acueducto comunal',
      ordenVisualizacion: 1,
      activo: true,
    },
    {
      titulo: 'Borrador oculto',
      descripcion: 'Foto inactiva para prueba de filtros.',
      textoAlternativo: 'Imagen de prueba inactiva',
      ordenVisualizacion: 2,
      activo: false,
    },
  ];

  for (const item of demos) {
    const created = await create(token, item, img);
    console.log(`Creada #${created.id}: ${created.titulo} (activo=${created.activo})`);
  }

  const pub = await (await fetch(`${BASE}/public/galeria`)).json();
  console.log(`Publicas visibles: ${pub.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
