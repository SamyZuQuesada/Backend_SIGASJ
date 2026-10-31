/**
 * Smoke test contra la API desplegada (Render).
 *
 * Variables (no versionar secretos):
 *   API_BASE_URL          default https://sigasj-api.onrender.com
 *   SMOKE_ADMIN_EMAIL     cuenta sintética rol ADMINISTRADORA
 *   SMOKE_ADMIN_PASSWORD
 *   SMOKE_FONTANERO_EMAIL cuenta sintética rol FONTANERO (para 403)
 *   SMOKE_FONTANERO_PASSWORD
 *   SMOKE_TIMEOUT_MS      default 25000
 *
 * No imprime JWT/passwords. Exit 0 = todo PASS; 1 = FAIL; 2 = BLOCKED (API no responde).
 */
'use strict';

const base = (process.env.API_BASE_URL || 'https://sigasj-api.onrender.com').replace(
  /\/$/,
  '',
);
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 25000);
const prefix = '/api/v1';

const results = [];

function redact(value) {
  if (value == null) return value;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer ***')
    .replace(/"accessToken"\s*:\s*"[^"]+"/gi, '"accessToken":"***"')
    .replace(/"password"\s*:\s*"[^"]+"/gi, '"password":"***"')
    .replace(/"passwordHash"\s*:\s*"[^"]+"/gi, '"passwordHash":"***"');
}

async function req(method, path, { token, body, expectStatus } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let status = 0;
  let json = null;
  let requestId = null;
  let error = null;

  try {
    const res = await fetch(`${base}${prefix}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    status = res.status;
    requestId = res.headers.get('x-request-id');
    const text = await res.text();
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text.slice(0, 200) };
    }
  } catch (err) {
    error = err.name === 'AbortError' ? 'TIMEOUT' : err.message;
  } finally {
    clearTimeout(timer);
  }

  const ok =
    !error &&
    (expectStatus === undefined ||
      status === expectStatus ||
      (Array.isArray(expectStatus) && expectStatus.includes(status)));

  return { ok, status, json, requestId, error };
}

function record(id, title, outcome, detail = {}) {
  const row = {
    id,
    title,
    result: outcome,
    ...detail,
  };
  results.push(row);
  const mark =
    outcome === 'PASS' ? 'PASS' : outcome === 'BLOCKED' ? 'BLOCKED' : 'FAIL';
  console.log(`[${mark}] ${id} ${title}`);
  if (detail.http != null) console.log(`  http=${detail.http}`);
  if (detail.requestId) console.log(`  requestId=${detail.requestId}`);
  if (detail.note) console.log(`  note=${detail.note}`);
  if (detail.error) console.log(`  error=${redact(detail.error)}`);
}

async function main() {
  console.log(`[SIGASJ] Smoke Render base=${base} prefix=${prefix}`);
  console.log(`[SIGASJ] startedAt=${new Date().toISOString()}`);

  // 1 Health
  const health = await req('GET', '/health', { expectStatus: 200 });
  if (health.error === 'TIMEOUT' || health.error) {
    record('S1', 'GET /health', 'BLOCKED', {
      http: health.status || null,
      error: health.error,
      note: 'Backend Render no responde (deploy Failed / SQL bootstrap).',
    });
    console.log(
      JSON.stringify(
        { summary: 'BLOCKED', base, results },
        null,
        2,
      ),
    );
    process.exit(2);
  }
  const healthBodyOk =
    health.json &&
    health.json.status === 'ok' &&
    !JSON.stringify(health.json).match(/password|jwt|secret|sql|host/i);
  record('S1', 'GET /health', health.ok && healthBodyOk ? 'PASS' : 'FAIL', {
    http: health.status,
    requestId: health.requestId,
    note: redact(health.json),
  });

  // 2 Público
  const pub = await req('GET', '/public/comunicados', { expectStatus: 200 });
  record('S2', 'GET /public/comunicados', pub.ok ? 'PASS' : 'FAIL', {
    http: pub.status,
    requestId: pub.requestId,
    error: pub.error,
  });

  const adminEmail = process.env.SMOKE_ADMIN_EMAIL;
  const adminPassword = process.env.SMOKE_ADMIN_PASSWORD;
  const fontEmail = process.env.SMOKE_FONTANERO_EMAIL;
  const fontPassword = process.env.SMOKE_FONTANERO_PASSWORD;

  if (!adminEmail || !adminPassword) {
    record('S3', 'POST /auth/login (válido)', 'BLOCKED', {
      note: 'Faltan SMOKE_ADMIN_EMAIL / SMOKE_ADMIN_PASSWORD en el entorno.',
    });
    finish();
    return;
  }

  // 3 Login válido
  const loginOk = await req('POST', '/auth/login', {
    body: { email: adminEmail, password: adminPassword },
    expectStatus: 200,
  });
  const token =
    loginOk.json && typeof loginOk.json.accessToken === 'string'
      ? loginOk.json.accessToken
      : null;
  const loginSafe =
    loginOk.json &&
    !('password' in loginOk.json) &&
    !('passwordHash' in loginOk.json) &&
    !(loginOk.json.user && 'passwordHash' in loginOk.json.user);
  record(
    'S3',
    'POST /auth/login (válido)',
    loginOk.ok && token && loginSafe ? 'PASS' : 'FAIL',
    {
      http: loginOk.status,
      requestId: loginOk.requestId,
      note: token
        ? `role=${loginOk.json?.user?.role || '?'} token=REDACTED`
        : redact(loginOk.json || loginOk.error),
    },
  );

  // 4 Login inválido
  const loginBad = await req('POST', '/auth/login', {
    body: { email: adminEmail, password: 'WrongPass-Smoke-NotReal-999' },
    expectStatus: 401,
  });
  record('S4', 'POST /auth/login (inválido)', loginBad.ok ? 'PASS' : 'FAIL', {
    http: loginBad.status,
    requestId: loginBad.requestId,
  });

  if (!token) {
    record('S5', 'GET /usuarios (token válido)', 'BLOCKED', {
      note: 'Sin accessToken tras login.',
    });
    finish();
    return;
  }

  // 5 Protegido + token (SQL)
  const users = await req('GET', '/usuarios', {
    token,
    expectStatus: 200,
  });
  record(
    'S5',
    'GET /usuarios (ADMIN + SQL)',
    users.ok ? 'PASS' : 'FAIL',
    {
      http: users.status,
      requestId: users.requestId,
      note: 'Lectura TypeORM → Railway (si DB configurada).',
      error: users.error,
    },
  );

  // 6 Sin token
  const noTok = await req('GET', '/usuarios', { expectStatus: 401 });
  record('S6', 'GET /usuarios sin token', noTok.ok ? 'PASS' : 'FAIL', {
    http: noTok.status,
    requestId: noTok.requestId,
  });

  // 7 Token inválido
  const badTok = await req('GET', '/usuarios', {
    token: 'invalid-token',
    expectStatus: 401,
  });
  record('S7', 'GET /usuarios token inválido', badTok.ok ? 'PASS' : 'FAIL', {
    http: badTok.status,
    requestId: badTok.requestId,
  });

  // 8 Rol incorrecto → 403 (admin/proyectos solo ADMINISTRADORA)
  if (!fontEmail || !fontPassword) {
    record('S8', 'GET /admin/proyectos como FONTANERO', 'BLOCKED', {
      note: 'Faltan SMOKE_FONTANERO_EMAIL / SMOKE_FONTANERO_PASSWORD.',
    });
  } else {
    const loginFont = await req('POST', '/auth/login', {
      body: { email: fontEmail, password: fontPassword },
      expectStatus: 200,
    });
    const fontToken = loginFont.json?.accessToken;
    if (!fontToken) {
      record('S8', 'GET /admin/proyectos como FONTANERO', 'FAIL', {
        http: loginFont.status,
        note: 'Login fontanero falló.',
      });
    } else {
      const forbidden = await req('GET', '/admin/proyectos', {
        token: fontToken,
        expectStatus: 403,
      });
      record(
        'S8',
        'GET /admin/proyectos como FONTANERO',
        forbidden.ok ? 'PASS' : 'FAIL',
        {
          http: forbidden.status,
          requestId: forbidden.requestId,
        },
      );
    }
  }

  // 9 Rol correcto (mismo admin ya autenticado)
  const adminProyectos = await req('GET', '/admin/proyectos', {
    token,
    expectStatus: 200,
  });
  record(
    'S9',
    'GET /admin/proyectos como ADMINISTRADORA',
    adminProyectos.ok ? 'PASS' : 'FAIL',
    {
      http: adminProyectos.status,
      requestId: adminProyectos.requestId,
      error: adminProyectos.error,
    },
  );

  finish();
}

function finish() {
  const counts = results.reduce(
    (acc, r) => {
      acc[r.result] = (acc[r.result] || 0) + 1;
      return acc;
    },
    {},
  );
  console.log(`[SIGASJ] summary=${JSON.stringify(counts)}`);
  console.log(JSON.stringify({ base, prefix, results }, null, 2));
  if (counts.FAIL) process.exit(1);
  if (counts.BLOCKED && !counts.PASS) process.exit(2);
  if (counts.BLOCKED) process.exit(2);
  process.exit(0);
}

main().catch((err) => {
  console.error('[SIGASJ] Smoke crash:', redact(String(err)));
  process.exit(1);
});
