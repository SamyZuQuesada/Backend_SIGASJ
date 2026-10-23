/**
 * Live E2E QA: POST infraestructura-linderos → verify SQL Server immediately.
 * Does not run Jest migrations (avoids destructive DOWN on shared DB).
 */
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from '../dist/database/data-source.options.js';

loadEnv();

const BASE = process.env.QA_API_BASE ?? 'http://127.0.0.1:3000/api/v1';
const stamp = Date.now();

const baseCommon = {
  calidadTitular: 'Propietario',
  provincia: 'San José',
  canton: 'Pérez Zeledón',
  distrito: 'San Isidro de El General',
  direccionExacta: `100 m norte iglesia QA ${stamp}`,
  folioReal: `F-${stamp}`,
  planoCatastrado: `SJ-CAT-${stamp}`,
  proposito: 'Reunión de fincas',
  medioNotificacionPrincipal: 'Correo electrónico',
  valorNotificacionPrincipal: `qa.infra.${stamp}@example.com`,
  medioNotificacionSecundario: 'Teléfono',
  valorNotificacionSecundario: '8888-9999',
  firma: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
};

async function post(label, body) {
  const res = await fetch(`${BASE}/solicitudes/infraestructura-linderos`, {
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
  console.log('body', JSON.stringify(json, null, 2));
  return { status: res.status, json };
}

const fisica = {
  ...baseCommon,
  nis: `NIS-PF-${stamp}`,
  tipoPersona: 'Persona física',
  nombreFisica: 'María Elena',
  apellidosFisica: 'Rodríguez Vargas',
  identificacionFisica: '1-1234-0567',
  telefonoFisica: '8888-1234',
  planoAgrimensura: `AG-PF-${stamp}`,
};

const juridica = {
  ...baseCommon,
  nis: `NIS-PJ-${stamp}`,
  tipoPersona: 'Persona jurídica',
  razonSocial: `Inversiones QA ${stamp} S.A.`,
  cedulaJuridica: '3-101-123456',
  nombreRepresentante: 'Luis Alberto Mora Chaves',
  identificacionRepresentante: '1-0987-6543',
  telefonoRepresentante: '8777-4321',
  planoAgrimensura: `AG-PJ-${stamp}`,
  calidadTitular: 'Representante legal',
};

const missingPlano = {
  ...fisica,
  nis: `NIS-MISS-${stamp}`,
  planoAgrimensura: '',
};

const massAssignment = {
  ...fisica,
  nis: `NIS-MASS-${stamp}`,
  planoAgrimensura: `AG-MASS-${stamp}`,
  estado: 'Aprobada',
  solicitudId: 999999,
  aprobadoPor: 'hacker',
  revisadoPor: 'hacker',
  funcionario: 'hacker',
  observacionesInternas: 'no debe persistir',
  createdAt: '2000-01-01T00:00:00.000Z',
  updatedAt: '2000-01-01T00:00:00.000Z',
};

const badPurpose = {
  ...fisica,
  nis: `NIS-BADP-${stamp}`,
  proposito: 'Ampliación inventada',
  planoAgrimensura: `AG-BADP-${stamp}`,
};

const rPf = await post('CASO1_FISICA_PROP1', fisica);
const rPj = await post('CASO2_JURIDICA_PROP1', juridica);
const rMiss = await post('CASO3_DOC_FALTANTE', missingPlano);
const rMass = await post('MASS_ASSIGNMENT', massAssignment);
const rBad = await post('PROPOSITO_INVALIDO', badPurpose);

const ds = new DataSource(buildMigrationDataSourceOptions());
await ds.initialize();

const codes = [rPf, rPj, rMass]
  .map((r) => r.json?.codigoSeguimiento ?? r.json?.data?.codigoSeguimiento)
  .filter(Boolean);

console.log('\n=== VERIFY_BD ===');
console.log('codes_to_find', codes);

for (const code of codes) {
  const rows = await ds.query(
    `
    SELECT s.id AS solId, s.codigoSeguimiento, s.estado,
           d.id AS detId, d.solicitudId, d.nis, d.tipoPersona, d.proposito,
           d.nombreFisica, d.apellidosFisica, d.razonSocial, d.cedulaJuridica,
           d.planoCatastrado, d.planoAgrimensura, d.calidadTitular,
           d.provincia, d.canton, d.distrito,
           CASE WHEN d.firma IS NULL OR d.firma = '' THEN 0 ELSE 1 END AS tieneFirma
    FROM Solicitud s
    INNER JOIN SolicitudInfraestructuraLinderos d ON d.solicitudId = s.id
    WHERE s.codigoSeguimiento = @0
  `,
    [code],
  );
  console.log(`JOIN_${code}`, JSON.stringify(rows, null, 2));
}

const orphanCheck = await ds.query(`
  SELECT COUNT(*) AS huérfanos
  FROM SolicitudInfraestructuraLinderos d
  LEFT JOIN Solicitud s ON s.id = d.solicitudId
  WHERE s.id IS NULL
`);
console.log('ORPHAN_DETALLES', orphanCheck);

await ds.destroy();

const summary = {
  fisica_201: rPf.status === 201,
  juridica_201: rPj.status === 201,
  missing_doc_400: rMiss.status === 400,
  mass_rejected_or_stripped: rMass.status === 400 || rMass.status === 201,
  bad_purpose_400: rBad.status === 400,
  codes,
};
console.log('\n=== SUMMARY ===', JSON.stringify(summary, null, 2));
process.exit(
  summary.fisica_201 &&
    summary.juridica_201 &&
    summary.missing_doc_400 &&
    summary.bad_purpose_400
    ? 0
    : 1,
);
