/**
 * Live E2E QA: upload documentos → POST disponibilidad-servicios → verify SQL Server.
 * No ejecuta migraciones destructivas.
 *
 * Requisitos: API en QA_API_BASE (default http://127.0.0.1:3000/api/v1) y BD configurada.
 */
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from '../dist/database/data-source.options.js';

loadEnv();

const BASE = process.env.QA_API_BASE ?? 'http://127.0.0.1:3000/api/v1';
const stamp = Date.now();

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const FIRMA =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function uploadDoc(tipoDocumento, tag) {
  const form = new FormData();
  form.append(
    'archivo',
    new Blob([PNG_BYTES], { type: 'image/png' }),
    `${tipoDocumento}-${tag}-${stamp}.png`,
  );
  form.append('tipoDocumento', tipoDocumento);
  const res = await fetch(`${BASE}/solicitudes/documentos`, {
    method: 'POST',
    body: form,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (res.status !== 201) {
    throw new Error(
      `Upload ${tipoDocumento}/${tag} falló ${res.status}: ${text.slice(0, 400)}`,
    );
  }
  return { id: json.id, tokenReclamo: json.tokenReclamo, tipoDocumento };
}

async function docsFor(tipos, tag) {
  const uploaded = [];
  for (const tipo of tipos) {
    uploaded.push(await uploadDoc(tipo, tag));
  }
  return uploaded.map((d) => ({ id: d.id, tokenReclamo: d.tokenReclamo }));
}

async function post(label, body) {
  const res = await fetch(`${BASE}/solicitudes/disponibilidad-servicios`, {
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
  console.log('body', JSON.stringify(json, null, 2).slice(0, 2500));
  return { status: res.status, json };
}

const common = {
  medioNotificacionPrincipal: 'Correo electrónico',
  valorNotificacionPrincipal: `qa.disp.${stamp}@example.com`,
  medioNotificacionSecundario: 'Teléfono',
  valorNotificacionSecundario: '8888-9999',
  provincia: 'San José',
  canton: 'Pérez Zeledón',
  distrito: 'San Isidro de El General',
  direccionExacta: `100 m norte iglesia QA DISP ${stamp}`,
  folioReal: `F-${stamp}`,
  planoCatastrado: `SJ-CAT-${stamp}`,
  naturalezaInmueble: 'Inscrito',
  calidadTitular: 'Propietario',
  descripcionProyecto: `Proyecto QA disponibilidad ${stamp}`,
  cantidadDormitorios: 3,
  unidadesHabitacionales: 4,
  areaConstruccion: 185.5,
  niveles: 2,
  caudalRequerido: 0.75,
  autorizacionInspeccion: true,
  firma: FIRMA,
};

console.log('BASE', BASE);
console.log('Subiendo documentos pendientes por caso…');

const docsPf = await docsFor(['identificacion', 'plano-catastrado'], 'pf');
const docsPj = await docsFor(
  ['identificacion', 'plano-catastrado', 'poder'],
  'pj',
);
const docsDerechos = await docsFor(
  ['identificacion', 'plano-catastrado'],
  'derechos',
);
const docsEstacion = await docsFor(
  ['identificacion', 'plano-catastrado', 'poder'],
  'estacion',
);
const docsAuthFalse = await docsFor(
  ['identificacion', 'plano-catastrado'],
  'authfalse',
);

const fisicaFracc = {
  ...common,
  tipoPersona: 'Persona física',
  nombreFisica: 'María Elena',
  primerApellidoFisica: 'Rodríguez',
  segundoApellidoFisica: 'Vargas',
  identificacionFisica: '1-1234-0567',
  telefonoFisica: '8888-1234',
  proposito: 'Fraccionamiento',
  nis: `NIS-PF-${stamp}`,
  numeroDisponibilidadAnterior: `DISP-PREV-${stamp}`,
  documentos: docsPf,
};

const juridicaUrb = {
  ...common,
  tipoPersona: 'Persona jurídica',
  razonSocial: `Inversiones QA DISP ${stamp} S.A.`,
  identificacionJuridica: '3-101-123456',
  nombreRepresentante: 'Luis Alberto Mora Chaves',
  identificacionRepresentante: '1-0987-6543',
  telefonoRepresentante: '8777-4321',
  proposito: 'Urbanización',
  calidadTitular: 'Representante legal',
  documentos: docsPj,
};

const fisicaDerechos = {
  ...common,
  tipoPersona: 'Persona física',
  nombreFisica: 'Carlos',
  primerApellidoFisica: 'Mora',
  segundoApellidoFisica: 'Chaves',
  identificacionFisica: '1-2222-3333',
  telefonoFisica: '8777-1111',
  proposito: 'Propiedades en derechos',
  documentos: docsDerechos,
};

delete fisicaDerechos.cantidadDormitorios;
delete fisicaDerechos.unidadesHabitacionales;
delete fisicaDerechos.areaConstruccion;
delete fisicaDerechos.niveles;
delete fisicaDerechos.caudalRequerido;
delete fisicaDerechos.nis;

const fisicaEstacion = {
  ...common,
  tipoPersona: 'Persona física',
  nombreFisica: 'Ana',
  primerApellidoFisica: 'Vargas',
  segundoApellidoFisica: 'Quirós',
  identificacionFisica: '1-4444-5555',
  telefonoFisica: '8666-2222',
  proposito: 'Estación de combustible',
  documentos: docsEstacion,
};

const autorizacionFalse = {
  ...common,
  tipoPersona: 'Persona física',
  nombreFisica: 'Pedro',
  primerApellidoFisica: 'Solís',
  segundoApellidoFisica: 'Rojas',
  identificacionFisica: '1-6666-7777',
  telefonoFisica: '8555-3333',
  proposito: 'Fraccionamiento',
  autorizacionInspeccion: false,
  documentos: docsAuthFalse,
};

const sinDesc = {
  ...fisicaFracc,
  identificacionFisica: '9-0000-0001',
  descripcionProyecto: '   ',
  documentos: await docsFor(['identificacion', 'plano-catastrado'], 'sindesc'),
};

const sinDocs = {
  ...fisicaFracc,
  identificacionFisica: '9-0000-0002',
  documentos: [],
};

const propositoInvalido = {
  ...fisicaFracc,
  identificacionFisica: '9-0000-0003',
  proposito: 'Ampliación inventada',
  documentos: await docsFor(['identificacion', 'plano-catastrado'], 'badprop'),
};

const massAssignment = {
  ...fisicaFracc,
  identificacionFisica: '9-0000-0004',
  estado: 'Aprobada',
  solicitudId: 999999,
  aprobadoPor: 'hacker',
  revisadoPor: 'hacker',
  createdAt: '2000-01-01T00:00:00.000Z',
  documentos: await docsFor(['identificacion', 'plano-catastrado'], 'mass'),
};

const docRefInvalida = {
  ...fisicaFracc,
  identificacionFisica: '9-0000-0005',
  documentos: [{ id: 999999001, tokenReclamo: 'token-inexistente' }],
};

// CASO "disponibilidad anterior requerida ausente" = BLOCKED (PDF oficial ausente).

const rPf = await post('CASO1_FISICA_FRACCIONAMIENTO', fisicaFracc);
const rPj = await post('CASO2_JURIDICA_URBANIZACION', juridicaUrb);
const rDerechos = await post('CASO_PROPOSITO_DERECHOS_NULLS', fisicaDerechos);
const rEstacion = await post('CASO_PROPOSITO_ESTACION', fisicaEstacion);
const rAuthFalse = await post('CASO_AUTORIZACION_FALSE', autorizacionFalse);
const rSinDesc = await post('CASO_SIN_DESCRIPCION', sinDesc);
const rSinDocs = await post('CASO_SIN_DOCUMENTOS', sinDocs);
const rBadProp = await post('CASO_PROPOSITO_INVALIDO', propositoInvalido);
const rMass = await post('CASO_MASS_ASSIGNMENT', massAssignment);
const rBadDoc = await post('CASO_DOC_REF_INVALIDA', docRefInvalida);

const ds = new DataSource(buildMigrationDataSourceOptions());
await ds.initialize();

const happy = [rPf, rPj, rDerechos, rEstacion, rAuthFalse].filter(
  (r) => r.status === 201,
);
const codes = happy
  .map((r) => r.json?.codigoSeguimiento ?? r.json?.data?.codigoSeguimiento)
  .filter(Boolean);

console.log('\n=== VERIFY_BD ===');
console.log('codes_to_find', codes);

const bdRows = {};
for (const code of codes) {
  const rows = await ds.query(
    `
    SELECT s.id AS solId, s.codigoSeguimiento, s.estado, s.tipoSolicitudId,
           d.id AS detId, d.solicitudId, d.tipoPersona, d.proposito,
           d.nombreFisica, d.primerApellidoFisica, d.razonSocial,
           d.identificacionJuridica, d.descripcionProyecto,
           d.areaConstruccion, d.caudalRequerido, d.cantidadDormitorios,
           d.unidadesHabitacionales, d.niveles, d.nis,
           d.numeroDisponibilidadAnterior, d.autorizacionInspeccion,
           d.naturalezaInmueble, d.calidadTitular,
           CASE WHEN d.firma IS NULL OR d.firma = '' THEN 0 ELSE 1 END AS tieneFirma
    FROM Solicitud s
    INNER JOIN SolicitudDisponibilidadServicios d ON d.solicitudId = s.id
    WHERE s.codigoSeguimiento = @0
  `,
    [code],
  );
  bdRows[code] = rows;
  console.log(`JOIN_${code}`, JSON.stringify(rows, null, 2));

  if (rows[0]) {
    const docs = await ds.query(
      `
      SELECT id, tipoDocumento, solicitudId, nombreOriginal
      FROM DocumentoSolicitud
      WHERE solicitudId = @0
    `,
      [rows[0].solId],
    );
    console.log(`DOCS_${code}`, JSON.stringify(docs, null, 2));
    const fkOk = Number(rows[0].solId) === Number(rows[0].solicitudId);
    console.log(`FK_OK_${code}`, fkOk);
  }
}

const orphanDetalles = await ds.query(`
  SELECT COUNT(*) AS huerfanos
  FROM SolicitudDisponibilidadServicios d
  LEFT JOIN Solicitud s ON s.id = d.solicitudId
  WHERE s.id IS NULL
`);
console.log('ORPHAN_DETALLES', orphanDetalles);

await ds.destroy();

const codeOf = (r) => r.json?.codigoSeguimiento ?? r.json?.data?.codigoSeguimiento;
const pfRow = bdRows[codeOf(rPf)]?.[0];
const pjRow = bdRows[codeOf(rPj)]?.[0];
const derechosRow = bdRows[codeOf(rDerechos)]?.[0];

const summary = {
  fisica_fraccionamiento_201: rPf.status === 201,
  juridica_urbanizacion_201: rPj.status === 201,
  proposito_derechos_201: rDerechos.status === 201,
  proposito_estacion_201: rEstacion.status === 201,
  sin_descripcion_400: rSinDesc.status === 400,
  sin_documentos_400: rSinDocs.status === 400,
  proposito_invalido_400: rBadProp.status === 400,
  mass_assignment_400: rMass.status === 400,
  doc_ref_invalida_400: rBadDoc.status === 400,
  autorizacion_false_201: rAuthFalse.status === 201,
  bd_persona_fisica: Boolean(
    pfRow &&
      pfRow.tipoPersona === 'Persona física' &&
      pfRow.nombreFisica === 'María Elena' &&
      pfRow.razonSocial == null,
  ),
  bd_persona_juridica: Boolean(
    pjRow &&
      pjRow.tipoPersona === 'Persona jurídica' &&
      pjRow.razonSocial?.includes('Inversiones QA DISP') &&
      pjRow.nombreFisica == null,
  ),
  bd_nulls_cuando_omitidos: Boolean(
    derechosRow &&
      derechosRow.cantidadDormitorios == null &&
      derechosRow.areaConstruccion == null &&
      derechosRow.caudalRequerido == null &&
      derechosRow.nis == null,
  ),
  bd_decimales: Boolean(
    pfRow &&
      Number(pfRow.areaConstruccion) === 185.5 &&
      Number(pfRow.caudalRequerido) === 0.75,
  ),
  bd_disponibilidad_anterior_persistida: Boolean(
    pfRow && pfRow.numeroDisponibilidadAnterior === `DISP-PREV-${stamp}`,
  ),
  bd_fk: Boolean(pfRow && Number(pfRow.solId) === Number(pfRow.solicitudId)),
  disponibilidad_anterior_required_rule: 'BLOCKED_PDF',
  proyecto_nuevo_definicion: 'BLOCKED_PDF',
  codes,
};

console.log('\n=== SUMMARY ===', JSON.stringify(summary, null, 2));

const pass =
  summary.fisica_fraccionamiento_201 &&
  summary.juridica_urbanizacion_201 &&
  summary.proposito_derechos_201 &&
  summary.proposito_estacion_201 &&
  summary.sin_descripcion_400 &&
  summary.sin_documentos_400 &&
  summary.proposito_invalido_400 &&
  summary.mass_assignment_400 &&
  summary.doc_ref_invalida_400 &&
  summary.autorizacion_false_201 &&
  summary.bd_persona_fisica &&
  summary.bd_persona_juridica &&
  summary.bd_nulls_cuando_omitidos &&
  summary.bd_decimales &&
  summary.bd_fk;

process.exit(pass ? 0 : 1);
