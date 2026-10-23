/**
 * Live POST afiliacion → verify SQL Server join immediately.
 */
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from '../dist/database/data-source.options.js';

loadEnv();

const BASE = process.env.QA_API_BASE ?? 'http://127.0.0.1:3000/api/v1';
const stamp = Date.now();

const payload = {
  fechaSolicitud: '2026-10-23',
  nombre: 'María Elena Rodríguez Vargas',
  identificacion: `01-0${String(stamp).slice(-7)}`,
  vecinoDe: `San Juan QA ${stamp}`,
  estadoCivil: 'Casado(a)',
  telefono: '8888-1234',
  correoElectronico: `qa.afiliacion.${stamp}@example.com`,
  numeroAbonado: `00${String(stamp).slice(-5)}`,
  numeroPlano: `SJ-AFI-${stamp}`,
  folioReal: `F-${stamp}`,
  firmaSolicitante:
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  recomendacion1Nombre: 'Carlos Alberto Mora Chaves',
  recomendacion1Identificacion: '1-0987-6543',
  recomendacion1NumeroAbonado: '12045',
  recomendacion1Firma: 'data:image/png;base64,rec1',
  recomendacion2Nombre: 'Ana Lucía Vargas Quirós',
  recomendacion2Identificacion: '1-2345-6789',
  recomendacion2NumeroAbonado: '13088',
  recomendacion2Firma: 'data:image/png;base64,rec2',
};

async function post(label, body) {
  const res = await fetch(`${BASE}/solicitudes/afiliacion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  console.log(`\n=== ${label} ===`);
  console.log('status', res.status);
  console.log('body', JSON.stringify(json, null, 2).slice(0, 2000));
  return { status: res.status, json };
}

const rOk = await post('CASO_VALIDO', payload);
const rMail = await post('CORREO_INVALIDO', {
  ...payload,
  correoElectronico: 'no-es-correo',
  identificacion: `bad-mail-${stamp}`,
});
const rRec1 = await post('FALTA_REC1', {
  ...payload,
  identificacion: `bad-r1-${stamp}`,
  recomendacion1Nombre: '',
});
const rRec2 = await post('FALTA_REC2', {
  ...payload,
  identificacion: `bad-r2-${stamp}`,
  recomendacion2Identificacion: '',
});
const rAdmin = await post('MASS_ASSIGNMENT', {
  ...payload,
  identificacion: `admin-${stamp}`,
  estado: 'APROBADA',
  fechaSesion: '2026-11-01',
  numeroAcuerdo: 'JD-99',
  revisadoPor: 'hacker',
});

const code =
  rOk.json?.codigoSeguimiento ?? rOk.json?.data?.codigoSeguimiento ?? null;

const ds = new DataSource(buildMigrationDataSourceOptions());
await ds.initialize();

if (code) {
  const rows = await ds.query(
    `
    SELECT s.id AS solId, s.codigoSeguimiento, s.estado, s.tipoSolicitudId,
           d.id AS detId, d.solicitudId, d.nombre, d.identificacion, d.numeroAbonado,
           d.recomendacion1Nombre, d.recomendacion2Nombre,
           d.recomendacion1NumeroAbonado, d.recomendacion2NumeroAbonado,
           CASE WHEN d.firmaSolicitante IS NULL OR d.firmaSolicitante = '' THEN 0 ELSE 1 END AS tieneFirma
    FROM Solicitud s
    INNER JOIN SolicitudAfiliacion d ON d.solicitudId = s.id
    WHERE s.codigoSeguimiento = @0
  `,
    [code],
  );
  console.log('\nJOIN', JSON.stringify(rows, null, 2));
  if (rows[0]) {
    const row = rows[0];
    const okJoin =
      Number(row.solId) === Number(row.solicitudId) &&
      row.recomendacion1Nombre === payload.recomendacion1Nombre &&
      row.recomendacion2Nombre === payload.recomendacion2Nombre &&
      row.recomendacion1NumeroAbonado === payload.recomendacion1NumeroAbonado &&
      row.recomendacion2NumeroAbonado === payload.recomendacion2NumeroAbonado &&
      Number(row.tieneFirma) === 1;
    console.log('JOIN_ASSERT', okJoin);
    if (!okJoin) {
      await ds.destroy();
      process.exit(1);
    }
  }
}

await ds.destroy();

const summary = {
  valido_201: rOk.status === 201,
  correo_400: rMail.status === 400,
  falta_rec1_400: rRec1.status === 400,
  falta_rec2_400: rRec2.status === 400,
  admin_400: rAdmin.status === 400,
  code,
};
console.log('\n=== SUMMARY ===', JSON.stringify(summary, null, 2));
process.exit(
  summary.valido_201 &&
    summary.correo_400 &&
    summary.falta_rec1_400 &&
    summary.falta_rec2_400 &&
    summary.admin_400
    ? 0
    : 1,
);
