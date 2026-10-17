/**
 * QA funcional/integral 6.5.x — historial administrativo.
 * npx ts-node -r dotenv/config src/database/qa-historial-funcional-integral.ts
 */
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/restrict-template-expressions, prettier/prettier */
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

const API = process.env.API_BASE_URL?.trim() || 'http://localhost:3000/api/v1';
const EMAIL = process.env.QA_ADMIN_EMAIL?.trim() || 'admin@asadasanjuan.cr';
const PASSWORD = process.env.QA_ADMIN_PASSWORD?.trim() || 'Password123!';
const FONTANERO = 'fontanero@asadasanjuan.cr';

type Json = Record<string, unknown>;

const results: Array<{ fase: string; ok: boolean; detail: string }> = [];

function pass(fase: string, detail: string) {
  results.push({ fase, ok: true, detail });
  console.log(`PASS  ${fase}: ${detail}`);
}

function fail(fase: string, detail: string): never {
  results.push({ fase, ok: false, detail });
  console.error(`FAIL  ${fase}: ${detail}`);
  throw new Error(`${fase}: ${detail}`);
}

async function login(email = EMAIL, password = PASSWORD): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login ${email} HTTP ${res.status}`);
  const body = (await res.json()) as Json;
  const token =
    (body.accessToken as string) ||
    (body.access_token as string) ||
    (body.token as string);
  if (!token) throw new Error('login sin token');
  return token;
}

async function api(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<{ status: number; body: Json }> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let parsed: Json = {};
  try {
    parsed = (await res.json()) as Json;
  } catch {
    parsed = {};
  }
  return { status: res.status, body: parsed };
}

async function sqlSnapshots(ds: DataSource, colaboradorId: number) {
  const counts = await ds.query(
    `
    SELECT
      (SELECT COUNT(*) FROM PermisoColaborador WHERE colaboradorId = @0) AS permisos,
      (SELECT COUNT(*) FROM MovimientoVacaciones WHERE colaboradorId = @0) AS vacaciones,
      (SELECT COUNT(*) FROM Incapacidad WHERE colaboradorId = @0) AS incapacidades,
      (SELECT MAX(CONVERT(varchar(33), updatedAt, 126)) FROM PermisoColaborador WHERE colaboradorId = @0) AS maxPermisoUpdated,
      (SELECT MAX(CONVERT(varchar(33), updatedAt, 126)) FROM Incapacidad WHERE colaboradorId = @0) AS maxIncapUpdated,
      (SELECT MAX(CONVERT(varchar(33), updatedAt, 126)) FROM Colaborador WHERE id = @0) AS colaboradorUpdated
    `,
    [colaboradorId],
  );
  const permisos = await ds.query(
    `SELECT id, fechaInicio, fechaFin, motivo, CONVERT(varchar(33), updatedAt, 126) AS updatedAt
     FROM PermisoColaborador WHERE colaboradorId = @0 ORDER BY id`,
    [colaboradorId],
  );
  const vacaciones = await ds.query(
    `SELECT id, tipo, cantidadDias, fecha, observaciones
     FROM MovimientoVacaciones WHERE colaboradorId = @0 ORDER BY id`,
    [colaboradorId],
  );
  const incapacidades = await ds.query(
    `SELECT id, fechaInicio, fechaFin, observaciones, CONVERT(varchar(33), updatedAt, 126) AS updatedAt
     FROM Incapacidad WHERE colaboradorId = @0 ORDER BY id`,
    [colaboradorId],
  );
  return { counts: counts[0], permisos, vacaciones, incapacidades };
}

async function main() {
  const token = await login();
  const ds = new DataSource(buildMigrationDataSourceOptions());
  await ds.initialize();

  try {
    // --- FASE 2: colaborador de prueba ---
    const suffix = String(Date.now()).slice(-6);
    const createColab = await api('POST', '/rrhh/colaboradores', token, {
      nombre: 'QA Historial',
      apellidos: `Integral${suffix}`,
      cedula: `1-${suffix.slice(0, 4)}-${suffix.slice(2)}`,
      correoElectronico: `qa.historial.${suffix}@asadasanjuan.cr`,
      cargo: 'Fontanero',
    });
    if (createColab.status !== 201) {
      fail('F2 colaborador', `HTTP ${createColab.status}`);
    }
    const colaboradorId = Number(createColab.body.id);
    pass('F2 colaborador', `id=${colaboradorId}`);

    // colaborador vacío (sin movimientos)
    const emptyColab = await api('POST', '/rrhh/colaboradores', token, {
      nombre: 'QA Vacio',
      apellidos: `Hist${suffix}`,
      cedula: `2-${suffix.slice(0, 4)}-${suffix.slice(2)}`,
      correoElectronico: `qa.vacio.${suffix}@asadasanjuan.cr`,
      cargo: 'Administrativa',
    });
    const emptyId = Number(emptyColab.body.id);

    // --- FASE 3: permiso ---
    const permiso = await api('POST', '/rrhh/permisos', token, {
      colaboradorId,
      fechaInicio: '2026-09-01',
      fechaFin: '2026-09-01',
      motivo: 'QA permiso historial',
      observaciones: 'obs permiso',
    });
    if (permiso.status !== 201) fail('F3 permiso', `HTTP ${permiso.status}`);
    const permisoId = Number(permiso.body.id);
    let snap = await sqlSnapshots(ds, colaboradorId);
    if (!snap.permisos.some((p: { id: number }) => Number(p.id) === permisoId)) {
      fail('F3 permiso SQL', 'no persistió');
    }
    pass('F3 permiso', `id=${permisoId}`);

    // --- FASE 4: vacaciones acumuladas ---
    const acum = await api('POST', '/rrhh/vacaciones/movimientos', token, {
      colaboradorId,
      tipo: 'ACUMULADO',
      cantidadDias: 5,
      fecha: '2026-08-15',
      observaciones: 'QA acumulado',
    });
    if (acum.status !== 201 && acum.status !== 200) {
      fail('F4 acumulado', `HTTP ${acum.status}`);
    }
    const acumId = Number(acum.body.id);
    snap = await sqlSnapshots(ds, colaboradorId);
    const acumSql = snap.vacaciones.find(
      (v: { id: number }) => Number(v.id) === acumId,
    );
    if (!acumSql || String(acumSql.tipo) !== 'ACUMULADO') {
      fail('F4 acumulado SQL', 'tipo/id incorrecto');
    }
    pass('F4 acumulado', `id=${acumId} dias=5`);

    // --- FASE 5: vacaciones disfrutadas ---
    const disfr = await api('POST', '/rrhh/vacaciones/movimientos', token, {
      colaboradorId,
      tipo: 'DISFRUTADO',
      cantidadDias: 2,
      fecha: '2026-10-05',
      observaciones: 'QA disfrutado',
    });
    if (disfr.status !== 201 && disfr.status !== 200) {
      fail('F5 disfrutado', `HTTP ${disfr.status}`);
    }
    const disfrId = Number(disfr.body.id);
    snap = await sqlSnapshots(ds, colaboradorId);
    if (snap.vacaciones.length < 2) {
      fail('F5 disfrutado', 'acumulado sobrescrito o perdido');
    }
    const tiposVac = snap.vacaciones.map((v: { tipo: string }) => String(v.tipo));
    if (!tiposVac.includes('ACUMULADO') || !tiposVac.includes('DISFRUTADO')) {
      fail('F5 disfrutado', `tipos=${tiposVac.join(',')}`);
    }
    pass('F5 disfrutado', `id=${disfrId}; ambos presentes`);

    // --- FASE 6: incapacidad ---
    const incap = await api('POST', '/rrhh/incapacidades', token, {
      colaboradorId,
      fechaInicio: '2026-11-10',
      fechaFin: '2026-11-12',
      observaciones: 'QA incapacidad historial',
    });
    if (incap.status !== 201) fail('F6 incapacidad', `HTTP ${incap.status}`);
    const incapId = Number(incap.body.id);
    snap = await sqlSnapshots(ds, colaboradorId);
    if (!snap.incapacidades.some((i: { id: number }) => Number(i.id) === incapId)) {
      fail('F6 incapacidad SQL', 'no persistió');
    }
    pass('F6 incapacidad', `id=${incapId}`);

    // Eventos extra para paginación y filtros de rango
    const extras = [
      { fechaInicio: '2026-01-05', fechaFin: '2026-01-05', motivo: 'antes rango' },
      { fechaInicio: '2026-12-20', fechaFin: '2026-12-20', motivo: 'despues rango' },
      { fechaInicio: '2026-06-01', fechaFin: '2026-06-01', motivo: 'extra permiso 1' },
      { fechaInicio: '2026-06-15', fechaFin: '2026-06-15', motivo: 'extra permiso 2' },
      { fechaInicio: '2026-07-01', fechaFin: '2026-07-01', motivo: 'extra permiso 3' },
    ];
    for (const e of extras) {
      const r = await api('POST', '/rrhh/permisos', token, {
        colaboradorId,
        ...e,
        observaciones: null,
      });
      if (r.status !== 201) fail('extra permiso', `HTTP ${r.status}`);
    }
    await api('POST', '/rrhh/vacaciones/movimientos', token, {
      colaboradorId,
      tipo: 'ACUMULADO',
      cantidadDias: 1,
      fecha: '2026-04-01',
      observaciones: 'extra vac',
    });
    await api('POST', '/rrhh/incapacidades', token, {
      colaboradorId,
      fechaInicio: '2026-05-01',
      fechaFin: '2026-05-03',
      observaciones: 'extra incap',
    });

    snap = await sqlSnapshots(ds, colaboradorId);
    const sqlTotal =
      Number(snap.counts.permisos) +
      Number(snap.counts.vacaciones) +
      Number(snap.counts.incapacidades);

    // --- FASE 7-8: historial consolidado + trazabilidad ---
    const hist = await api(
      'GET',
      `/rrhh/colaboradores/${colaboradorId}/historial?limit=100`,
      token,
    );
    if (hist.status !== 200) fail('F7 historial', `HTTP ${hist.status}`);
    const historial = (hist.body.historial as Array<Json>) || [];
    const tipos = new Set(historial.map((e) => String(e.tipo)));
    if (!tipos.has('PERMISO') || !tipos.has('VACACION') || !tipos.has('INCAPACIDAD')) {
      fail('F7 historial', `tipos incompletos: ${[...tipos].join(',')}`);
    }
    if (Number(hist.body.colaborador && (hist.body.colaborador as Json).id) !== colaboradorId) {
      fail('F7 historial', 'colaborador incorrecto');
    }
    const hasAcum = historial.some(
      (e) =>
        e.tipo === 'VACACION' &&
        e.tipoMovimiento === 'ACUMULADO' &&
        Number(e.id) === acumId,
    );
    const hasDisfr = historial.some(
      (e) =>
        e.tipo === 'VACACION' &&
        e.tipoMovimiento === 'DISFRUTADO' &&
        Number(e.id) === disfrId,
    );
    const hasPerm = historial.some(
      (e) => e.tipo === 'PERMISO' && Number(e.id) === permisoId,
    );
    const hasInc = historial.some(
      (e) => e.tipo === 'INCAPACIDAD' && Number(e.id) === incapId,
    );
    if (!hasAcum || !hasDisfr || !hasPerm || !hasInc) {
      fail('F8 trazabilidad', 'faltan IDs originales en historial');
    }
    pass(
      'F7-F8 historial+trazabilidad',
      `eventos=${historial.length} sql=${sqlTotal}`,
    );

    // --- FASE 9: orden ---
    for (let i = 1; i < historial.length; i++) {
      const prev = String(historial[i - 1].fecha);
      const cur = String(historial[i].fecha);
      if (prev < cur) fail('F9 orden', `${prev} antes que ${cur}`);
    }
    pass('F9 orden', 'fecha DESC estable');

    // --- FASE 10-12: filtros por tipo ---
    const fPerm = await api(
      'GET',
      `/rrhh/colaboradores/${colaboradorId}/historial?tipo=PERMISO&limit=100`,
      token,
    );
    const permList = (fPerm.body.historial as Array<Json>) || [];
    if (
      fPerm.status !== 200 ||
      permList.some((e) => e.tipo !== 'PERMISO') ||
      Number(fPerm.body.total) !== Number(snap.counts.permisos)
    ) {
      fail('F10 filtro PERMISO', `total=${fPerm.body.total}`);
    }
    pass('F10 filtro PERMISO', `total=${fPerm.body.total}`);

    const fVac = await api(
      'GET',
      `/rrhh/colaboradores/${colaboradorId}/historial?tipo=VACACION&limit=100`,
      token,
    );
    const vacList = (fVac.body.historial as Array<Json>) || [];
    const vacMovs = new Set(
      vacList.map((e) => String(e.tipoMovimiento)).filter(Boolean),
    );
    if (
      fVac.status !== 200 ||
      vacList.some((e) => e.tipo !== 'VACACION') ||
      !vacMovs.has('ACUMULADO') ||
      !vacMovs.has('DISFRUTADO')
    ) {
      fail('F11 filtro VACACION', `movs=${[...vacMovs].join(',')}`);
    }
    pass('F11 filtro VACACION', `total=${fVac.body.total} acum+disfr`);

    const fInc = await api(
      'GET',
      `/rrhh/colaboradores/${colaboradorId}/historial?tipo=INCAPACIDAD&limit=100`,
      token,
    );
    const incList = (fInc.body.historial as Array<Json>) || [];
    if (
      fInc.status !== 200 ||
      incList.some((e) => e.tipo !== 'INCAPACIDAD') ||
      Number(fInc.body.total) !== Number(snap.counts.incapacidades)
    ) {
      fail('F12 filtro INCAPACIDAD', `total=${fInc.body.total}`);
    }
    pass('F12 filtro INCAPACIDAD', `total=${fInc.body.total}`);

    // --- FASE 13: rango fechas ---
    const fRange = await api(
      'GET',
      `/rrhh/colaboradores/${colaboradorId}/historial?fechaDesde=2026-08-01&fechaHasta=2026-11-30&limit=100`,
      token,
    );
    const rangeList = (fRange.body.historial as Array<Json>) || [];
    if (
      rangeList.some(
        (e) =>
          String(e.fecha) < '2026-08-01' || String(e.fecha) > '2026-11-30',
      )
    ) {
      fail('F13 fechas', 'evento fuera de rango');
    }
    const idsRange = new Set(rangeList.map((e) => `${e.tipo}:${e.id}`));
    if (
      !idsRange.has(`PERMISO:${permisoId}`) ||
      !idsRange.has(`VACACION:${acumId}`) ||
      !idsRange.has(`VACACION:${disfrId}`) ||
      !idsRange.has(`INCAPACIDAD:${incapId}`)
    ) {
      fail('F13 fechas', 'faltan eventos esperados dentro del rango');
    }
    pass('F13 fechas', `total=${fRange.body.total}`);

    // --- FASE 14: combinación ---
    const fComb = await api(
      'GET',
      `/rrhh/colaboradores/${colaboradorId}/historial?tipo=PERMISO&fechaDesde=2026-08-01&fechaHasta=2026-11-30&limit=100`,
      token,
    );
    const comb = (fComb.body.historial as Array<Json>) || [];
    if (comb.some((e) => e.tipo !== 'PERMISO')) {
      fail('F14 combinación', 'mezcla de tipos');
    }
    if (
      comb.some(
        (e) =>
          String(e.fecha) < '2026-08-01' || String(e.fecha) > '2026-11-30',
      )
    ) {
      fail('F14 combinación', 'fuera de rango');
    }
    pass('F14 combinación', `PERMISO+rango total=${fComb.body.total}`);

    // --- FASE 15-17: paginación ---
    const p1 = await api(
      'GET',
      `/rrhh/colaboradores/${colaboradorId}/historial?page=1&limit=3`,
      token,
    );
    const p2 = await api(
      'GET',
      `/rrhh/colaboradores/${colaboradorId}/historial?page=2&limit=3`,
      token,
    );
    const h1 = (p1.body.historial as Array<Json>) || [];
    const h2 = (p2.body.historial as Array<Json>) || [];
    const keys1 = new Set(h1.map((e) => `${e.tipo}:${e.id}`));
    const overlap = h2.filter((e) => keys1.has(`${e.tipo}:${e.id}`));
    if (
      Number(p1.body.total) !== sqlTotal ||
      Number(p1.body.page) !== 1 ||
      Number(p1.body.limit) !== 3 ||
      Number(p1.body.totalPages) !== Math.ceil(sqlTotal / 3) ||
      overlap.length > 0
    ) {
      fail(
        'F15-17 paginación',
        `total=${p1.body.total} overlap=${overlap.length}`,
      );
    }
    pass(
      'F15-17 paginación',
      `page1=${h1.length} page2=${h2.length} totalPages=${p1.body.totalPages}`,
    );

    const pFilt = await api(
      'GET',
      `/rrhh/colaboradores/${colaboradorId}/historial?tipo=PERMISO&page=2&limit=2`,
      token,
    );
    const pf = (pFilt.body.historial as Array<Json>) || [];
    if (pf.some((e) => e.tipo !== 'PERMISO') || Number(pFilt.body.page) !== 2) {
      fail('F16 filtros+paginación', 'filtro perdido');
    }
    pass('F16 filtros+paginación', `page2 PERMISO n=${pf.length}`);

    // --- FASE 18: vacío ---
    const vacio = await api(
      'GET',
      `/rrhh/colaboradores/${emptyId}/historial`,
      token,
    );
    if (
      vacio.status !== 200 ||
      ((vacio.body.historial as unknown[]) || []).length !== 0 ||
      Number(vacio.body.total) !== 0
    ) {
      fail('F18 vacío', `HTTP ${vacio.status}`);
    }
    pass('F18 vacío', `colaborador ${emptyId} sin eventos`);

    // --- FASE 19: 404 ---
    const notFound = await api(
      'GET',
      '/rrhh/colaboradores/999999/historial',
      token,
    );
    if (notFound.status !== 404) fail('F19 404', `HTTP ${notFound.status}`);
    pass('F19 404', 'colaborador inexistente');

    // --- FASE 20: auth ---
    const noAuth = await api(
      'GET',
      `/rrhh/colaboradores/${colaboradorId}/historial`,
    );
    if (noAuth.status !== 401) fail('F20 401', `HTTP ${noAuth.status}`);
    const fontToken = await login(FONTANERO);
    const forbid = await api(
      'GET',
      `/rrhh/colaboradores/${colaboradorId}/historial`,
      fontToken,
    );
    if (forbid.status !== 403) fail('F20 403', `HTTP ${forbid.status}`);
    pass('F20 auth', '200 admin / 401 / 403');

    // --- FASE 21 + 26: solo lectura + filtro sin resultados ---
    const before = await sqlSnapshots(ds, colaboradorId);
    for (let i = 0; i < 3; i++) {
      await api(
        'GET',
        `/rrhh/colaboradores/${colaboradorId}/historial?limit=50`,
        token,
      );
    }
    const after = await sqlSnapshots(ds, colaboradorId);
    if (
      JSON.stringify(before.counts) !== JSON.stringify(after.counts) ||
      JSON.stringify(before.permisos) !== JSON.stringify(after.permisos) ||
      JSON.stringify(before.vacaciones) !== JSON.stringify(after.vacaciones) ||
      JSON.stringify(before.incapacidades) !==
        JSON.stringify(after.incapacidades)
    ) {
      fail('F21 solo lectura', 'consulta modificó datos');
    }
    pass('F21 solo lectura', 'updatedAt/cantidades intactos');

    const noMatch = await api(
      'GET',
      `/rrhh/colaboradores/${colaboradorId}/historial?tipo=PERMISO&fechaDesde=2090-01-01&fechaHasta=2090-12-31`,
      token,
    );
    if (
      noMatch.status !== 200 ||
      Number(noMatch.body.total) !== 0 ||
      ((noMatch.body.historial as unknown[]) || []).length !== 0
    ) {
      fail('F26 sin resultados', `HTTP ${noMatch.status}`);
    }
    pass('F26 sin resultados', '200 + vacío');

    // --- FASE 22-25: SQL vs API, duplicados, pérdida ---
    const full = await api(
      'GET',
      `/rrhh/colaboradores/${colaboradorId}/historial?limit=100`,
      token,
    );
    const events = (full.body.historial as Array<Json>) || [];
    const keys = events.map((e) => `${e.tipo}:${e.id}`);
    const unique = new Set(keys);
    if (keys.length !== unique.size) {
      fail('F23 duplicados', `keys=${keys.length} unique=${unique.size}`);
    }
    if (Number(full.body.total) !== sqlTotal || events.length !== sqlTotal) {
      fail(
        'F24 pérdida',
        `API ${full.body.total}/${events.length} vs SQL ${sqlTotal}`,
      );
    }
    for (const p of after.permisos) {
      if (!unique.has(`PERMISO:${p.id}`)) fail('F24 pérdida', `permiso ${p.id}`);
    }
    for (const v of after.vacaciones) {
      if (!unique.has(`VACACION:${v.id}`)) {
        fail('F24 pérdida', `vacacion ${v.id}`);
      }
    }
    for (const i of after.incapacidades) {
      if (!unique.has(`INCAPACIDAD:${i.id}`)) {
        fail('F24 pérdida', `incapacidad ${i.id}`);
      }
    }
    const vacEvents = events.filter((e) => e.tipo === 'VACACION');
    if (
      !vacEvents.some((e) => e.tipoMovimiento === 'ACUMULADO') ||
      !vacEvents.some((e) => e.tipoMovimiento === 'DISFRUTADO')
    ) {
      fail('F25 vacaciones', 'acumulado/disfrutado colapsados');
    }
    pass(
      'F22-25 SQL/dup/pérdida/vac',
      `sql=${sqlTotal} api=${events.length} dup=0`,
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          colaboradorId,
          emptyId,
          sql: {
            permisos: Number(after.counts.permisos),
            vacaciones: Number(after.counts.vacaciones),
            incapacidades: Number(after.counts.incapacidades),
            total: sqlTotal,
          },
          apiTotal: Number(full.body.total),
          permisoId,
          acumId,
          disfrId,
          incapId,
          fases: results.length,
        },
        null,
        2,
      ),
    );
  } finally {
    await ds.destroy();
  }
}

void main().catch((err: unknown) => {
  console.error('[QA FAIL]', err instanceof Error ? err.message : err);
  process.exit(1);
});
