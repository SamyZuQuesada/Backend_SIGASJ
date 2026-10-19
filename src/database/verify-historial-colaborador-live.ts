/**
 * Verificación live 6.5.4: API historial vs SQL Server + solo lectura.
 * Uso: npx ts-node -r dotenv/config src/database/verify-historial-colaborador-live.ts
 */
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

const API = process.env.API_BASE_URL?.trim() || 'http://localhost:3000/api/v1';
const EMAIL = process.env.QA_ADMIN_EMAIL?.trim() || 'admin@asadasanjuan.cr';
const PASSWORD = process.env.QA_ADMIN_PASSWORD?.trim() || 'Password123!';
const COLABORADOR_ID = Number(process.env.QA_COLABORADOR_ID || 2071);

type EventoApi = {
  id: number;
  tipo: 'PERMISO' | 'VACACION' | 'INCAPACIDAD';
  fecha: string;
  descripcion: string;
};

type HistorialApi = {
  colaborador: { id: number; nombre: string; apellidos: string };
  historial: EventoApi[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

async function login(): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Login falló: HTTP ${res.status}`);
  }
  const body = (await res.json()) as {
    accessToken?: string;
    access_token?: string;
    token?: string;
  };
  const token = body.accessToken ?? body.access_token ?? body.token;
  if (!token) throw new Error('Login sin token');
  return token;
}

async function getHistorial(
  token: string,
  query: Record<string, string | number> = {},
): Promise<{ status: number; body: HistorialApi | null }> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => params.set(k, String(v)));
  const qs = params.toString();
  const url = `${API}/rrhh/colaboradores/${COLABORADOR_ID}/historial${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return { status: res.status, body: null };
  }
  return { status: res.status, body: (await res.json()) as HistorialApi };
}

async function main(): Promise<void> {
  const token = await login();
  const ds = new DataSource(buildMigrationDataSourceOptions());
  await ds.initialize();

  try {
    const stampsAntes = await ds.query(
      `
      SELECT
        (SELECT COUNT(*) FROM PermisoColaborador WHERE colaboradorId = @0) AS permisos,
        (SELECT COUNT(*) FROM MovimientoVacaciones WHERE colaboradorId = @0) AS vacaciones,
        (SELECT COUNT(*) FROM Incapacidad WHERE colaboradorId = @0) AS incapacidades,
        (SELECT MAX(CONVERT(varchar(33), updatedAt, 126)) FROM PermisoColaborador WHERE colaboradorId = @0) AS maxPermisoUpdated,
        (SELECT MAX(CONVERT(varchar(33), updatedAt, 126)) FROM Incapacidad WHERE colaboradorId = @0) AS maxIncapUpdated,
        (SELECT MAX(CONVERT(varchar(33), updatedAt, 126)) FROM Colaborador WHERE id = @0) AS colaboradorUpdated
      `,
      [COLABORADOR_ID],
    );

    const sqlPermisos = await ds.query(
      `SELECT id, fechaInicio, fechaFin, motivo FROM PermisoColaborador WHERE colaboradorId = @0`,
      [COLABORADOR_ID],
    );
    const sqlVacaciones = await ds.query(
      `SELECT id, tipo, cantidadDias, fecha, observaciones FROM MovimientoVacaciones WHERE colaboradorId = @0`,
      [COLABORADOR_ID],
    );
    const sqlIncapacidades = await ds.query(
      `SELECT id, fechaInicio, fechaFin, observaciones FROM Incapacidad WHERE colaboradorId = @0`,
      [COLABORADOR_ID],
    );

    const esperado =
      sqlPermisos.length + sqlVacaciones.length + sqlIncapacidades.length;

    const { status, body } = await getHistorial(token, {
      page: 1,
      limit: 100,
    });
    if (status !== 200 || !body) {
      throw new Error(`Historial HTTP ${status}`);
    }

    const tipos = new Set(body.historial.map((e) => e.tipo));
    const idsPermisoApi = new Set(
      body.historial.filter((e) => e.tipo === 'PERMISO').map((e) => e.id),
    );
    const idsVacApi = new Set(
      body.historial.filter((e) => e.tipo === 'VACACION').map((e) => e.id),
    );
    const idsIncApi = new Set(
      body.historial.filter((e) => e.tipo === 'INCAPACIDAD').map((e) => e.id),
    );

    for (const row of sqlPermisos) {
      if (!idsPermisoApi.has(Number(row.id))) {
        throw new Error(`Permiso SQL ${row.id} ausente en API`);
      }
    }
    for (const row of sqlVacaciones) {
      if (!idsVacApi.has(Number(row.id))) {
        throw new Error(`Vacación SQL ${row.id} ausente en API`);
      }
    }
    for (const row of sqlIncapacidades) {
      if (!idsIncApi.has(Number(row.id))) {
        throw new Error(`Incapacidad SQL ${row.id} ausente en API`);
      }
    }

    if (body.total !== esperado) {
      throw new Error(`total API ${body.total} != SQL ${esperado}`);
    }

    const filtrado = await getHistorial(token, {
      tipo: 'INCAPACIDAD',
      fechaDesde: '2026-01-01',
      fechaHasta: '2026-12-31',
      page: 1,
      limit: 10,
    });
    if (filtrado.status !== 200 || !filtrado.body) {
      throw new Error(`Filtro HTTP ${filtrado.status}`);
    }
    if (filtrado.body.historial.some((e) => e.tipo !== 'INCAPACIDAD')) {
      throw new Error('Filtro tipo no respetado');
    }

    const page1 = await getHistorial(token, { page: 1, limit: 2 });
    const page2 = await getHistorial(token, { page: 2, limit: 2 });
    if (!page1.body || !page2.body) throw new Error('Paginación falló');
    const overlap = page1.body.historial.filter((a) =>
      page2.body!.historial.some((b) => b.tipo === a.tipo && b.id === a.id),
    );
    if (page2.body.historial.length > 0 && overlap.length > 0) {
      throw new Error('Páginas con eventos repetidos');
    }

    const stampsDespues = await ds.query(
      `
      SELECT
        (SELECT COUNT(*) FROM PermisoColaborador WHERE colaboradorId = @0) AS permisos,
        (SELECT COUNT(*) FROM MovimientoVacaciones WHERE colaboradorId = @0) AS vacaciones,
        (SELECT COUNT(*) FROM Incapacidad WHERE colaboradorId = @0) AS incapacidades,
        (SELECT MAX(CONVERT(varchar(33), updatedAt, 126)) FROM PermisoColaborador WHERE colaboradorId = @0) AS maxPermisoUpdated,
        (SELECT MAX(CONVERT(varchar(33), updatedAt, 126)) FROM Incapacidad WHERE colaboradorId = @0) AS maxIncapUpdated,
        (SELECT MAX(CONVERT(varchar(33), updatedAt, 126)) FROM Colaborador WHERE id = @0) AS colaboradorUpdated
      `,
      [COLABORADOR_ID],
    );

    const a = stampsAntes[0];
    const b = stampsDespues[0];
    if (
      Number(a.permisos) !== Number(b.permisos) ||
      Number(a.vacaciones) !== Number(b.vacaciones) ||
      Number(a.incapacidades) !== Number(b.incapacidades) ||
      String(a.maxPermisoUpdated) !== String(b.maxPermisoUpdated) ||
      String(a.maxIncapUpdated) !== String(b.maxIncapUpdated) ||
      String(a.colaboradorUpdated) !== String(b.colaboradorUpdated)
    ) {
      throw new Error(
        'Consultar historial modificó registros (solo lectura falló)',
      );
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          colaboradorId: COLABORADOR_ID,
          colaborador: `${body.colaborador.nombre} ${body.colaborador.apellidos}`,
          total: body.total,
          tipos: [...tipos],
          filtroIncapacidad: filtrado.body.total,
          page1: page1.body.historial.length,
          page2: page2.body.historial.length,
          soloLectura: true,
          updatedAtSinCambio: true,
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
  console.error('[FAIL]', err instanceof Error ? err.message : err);
  process.exit(1);
});
