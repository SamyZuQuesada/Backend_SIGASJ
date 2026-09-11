import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { EstadoAveria } from '../common/enums/estado-averia.enum';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

const LIVE_URL = 'http://localhost:3000/api/v1/public/averias';

type LiveResponse = {
  message?: string;
  data?: {
    codigoSeguimiento?: string;
    fechaReporte?: string;
    estado?: string;
  };
};

type AveriaRow = {
  codigoSeguimiento: string;
  fechaReporte: Date;
  nombreReportante: string;
  identificacionReportante: string | null;
  correoReportante: string | null;
  telefonoReportante: string;
  ubicacion: string;
  sectorComunidad: string;
  descripcion: string;
  estado: string;
  idAbonado: number | null;
  tipoAveria: string | null;
  prioridad: string | null;
  idFontaneroAsignado: number | null;
  fechaAsignacion: Date | null;
  fechaInicioAtencion: Date | null;
  fechaResolucion: Date | null;
  observacionesAtencion: string | null;
};

describe('E2E vivo POST /api/v1/public/averias → SQL Server', () => {
  let dataSource: DataSource | null = null;
  const createdCodes: string[] = [];

  beforeAll(async () => {
    try {
      const options = buildMigrationDataSourceOptions();
      if (options.type === 'mssql') {
        dataSource = new DataSource(options);
        await dataSource.initialize();
        await dataSource.query(
          `DELETE FROM Averia WHERE nombreReportante LIKE @0`,
          ['Prueba Avería E2E%'],
        );
      }
    } catch {
      dataSource = null;
    }
  }, 15_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      for (const codigo of createdCodes) {
        await dataSource.query(
          `DELETE FROM Averia WHERE codigoSeguimiento = @0`,
          [codigo],
        );
      }
      await dataSource.destroy();
    }
  });

  const postLive = async (body: Record<string, unknown>) => {
    try {
      return await fetch(LIVE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      pending(
        `Nest HTTP no disponible en ${LIVE_URL}: ${error instanceof Error ? error.message : error}`,
      );
      throw error;
    }
  };

  it('registra sin JWT, persiste en SQL Server y deja campos administrativos en null', async () => {
    if (!dataSource?.isInitialized) {
      pending('SQL Server no está disponible para E2E vivo');
      return;
    }

    const suffix = `${Date.now()}`;
    const payload = {
      nombreReportante: `Prueba Avería E2E ${suffix}`,
      identificacionReportante: '1-2345-6789',
      telefonoReportante: '88888888',
      correoReportante: 'prueba.averia.e2e@example.com',
      ubicacion: '200 metros al norte de la escuela',
      sectorComunidad: 'Sector Prueba',
      descripcion: 'Reporte generado durante validación E2E.',
    };

    const response = await postLive(payload);
    expect(response.status).toBe(201);
    expect(response.headers.get('authorization')).toBeNull();

    const body = (await response.json()) as LiveResponse;
    const codigo = body.data?.codigoSeguimiento;
    expect(body.message).toBe('Avería registrada correctamente.');
    expect(codigo).toMatch(/^AV-\d{4}-\d{4}$/);
    expect(body.data?.estado).toBe('Recibida');
    expect(typeof body.data?.fechaReporte).toBe('string');
    createdCodes.push(codigo as string);

    const rows = await dataSource.query<AveriaRow[]>(
      `SELECT codigoSeguimiento, fechaReporte, nombreReportante,
              identificacionReportante, correoReportante, telefonoReportante,
              ubicacion, sectorComunidad, descripcion, estado, idAbonado,
              tipoAveria, prioridad, idFontaneroAsignado, fechaAsignacion,
              fechaInicioAtencion, fechaResolucion, observacionesAtencion
       FROM Averia WHERE codigoSeguimiento = @0`,
      [codigo],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.nombreReportante).toBe(payload.nombreReportante);
    expect(rows[0]?.identificacionReportante).toBe('1-2345-6789');
    expect(rows[0]?.correoReportante).toBe('prueba.averia.e2e@example.com');
    expect(rows[0]?.telefonoReportante).toBe('88888888');
    expect(rows[0]?.ubicacion).toBe(payload.ubicacion);
    expect(rows[0]?.sectorComunidad).toBe('Sector Prueba');
    expect(rows[0]?.descripcion).toBe(payload.descripcion);
    expect(rows[0]?.estado).toBe(EstadoAveria.RECIBIDA);
    expect(rows[0]?.idAbonado).toBeNull();
    expect(rows[0]?.tipoAveria).toBeNull();
    expect(rows[0]?.prioridad).toBeNull();
    expect(rows[0]?.idFontaneroAsignado).toBeNull();
    expect(rows[0]?.fechaAsignacion).toBeNull();
    expect(rows[0]?.fechaInicioAtencion).toBeNull();
    expect(rows[0]?.fechaResolucion).toBeNull();
    expect(rows[0]?.observacionesAtencion).toBeNull();
  });
});
