import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { EstadoAveria } from '../common/enums/estado-averia.enum';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { AveriasService } from '../modules/averias/averias.service';
import { Averia } from '../modules/averias/entities/averia.entity';

loadEnv();

type AveriaRow = {
  codigoSeguimiento: string;
  fechaReporte: Date;
  nombreReportante: string;
  telefonoReportante: string;
  identificacionReportante: string | null;
  correoReportante: string | null;
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

const AVERIA_SELECT = `
  SELECT codigoSeguimiento, fechaReporte, nombreReportante, telefonoReportante,
         identificacionReportante, correoReportante, ubicacion,
         sectorComunidad, descripcion, estado, idAbonado, tipoAveria,
         prioridad, idFontaneroAsignado, fechaAsignacion,
         fechaInicioAtencion, fechaResolucion, observacionesAtencion
  FROM Averia WHERE codigoSeguimiento = @0
`;

describe('Registro público de Averia en SQL Server', () => {
  let dataSource: DataSource | null = null;
  let isConnected = false;
  const createdCodes: string[] = [];

  beforeAll(async () => {
    try {
      const options = buildMigrationDataSourceOptions();
      if (options.type === 'mssql') {
        dataSource = new DataSource(options);
        await dataSource.initialize();
        const tables = await dataSource.query<{ TABLE_NAME: string }[]>(`
          SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Averia'
        `);
        isConnected = tables.length > 0;
      }
    } catch (error) {
      isConnected = false;
      console.warn(
        '[AVISO QA] SQL Server no está disponible para registro público de averías:',
        error instanceof Error ? error.message : error,
      );
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

  const requireSqlServer = (): DataSource => {
    if (!isConnected || !dataSource) {
      pending('SQL Server no está disponible: persistencia real no ejecutada');
      throw new Error('SQL Server no disponible');
    }
    return dataSource;
  };

  it('persiste un reporte público mínimo y deja campos administrativos en null', async () => {
    const db = requireSqlServer();
    const service = new AveriasService(db.getRepository(Averia));
    const suffix = `${Date.now()}`;
    const nombre = `TEST_TEMP_Publica_${suffix}`;
    const before = Date.now();
    const result = await service.createPublicReport({
      nombreReportante: nombre,
      telefonoReportante: '88888888',
      ubicacion: 'Dirección de prueba QA pública',
      sectorComunidad: 'Sector Prueba',
      descripcion: 'Reporte generado durante validación E2E.',
    });

    createdCodes.push(result.data.codigoSeguimiento);

    expect(result.message).toBe('Avería registrada correctamente.');
    expect(result.data.estado).toBe('Recibida');
    expect(result.data.codigoSeguimiento).toMatch(/^AV-\d{4}-\d{4}$/);

    const rows = await db.query<AveriaRow[]>(AVERIA_SELECT, [
      result.data.codigoSeguimiento,
    ]);

    expect(rows).toHaveLength(1);
    const persisted = rows[0];
    expect(persisted).toBeDefined();
    expect(persisted?.nombreReportante).toBe(nombre);
    expect(persisted?.telefonoReportante).toBe('88888888');
    expect(persisted?.sectorComunidad).toBe('Sector Prueba');
    expect(persisted?.descripcion).toBe(
      'Reporte generado durante validación E2E.',
    );
    expect(persisted?.estado).toBe(EstadoAveria.RECIBIDA);
    expect(persisted?.identificacionReportante).toBeNull();
    expect(persisted?.correoReportante).toBeNull();
    expect(persisted?.idAbonado).toBeNull();
    expect(persisted?.tipoAveria).toBeNull();
    expect(persisted?.prioridad).toBeNull();
    expect(persisted?.idFontaneroAsignado).toBeNull();
    expect(persisted?.fechaAsignacion).toBeNull();
    expect(persisted?.fechaInicioAtencion).toBeNull();
    expect(persisted?.fechaResolucion).toBeNull();
    expect(persisted?.observacionesAtencion).toBeNull();
    expect(
      new Date(persisted?.fechaReporte ?? 0).getTime(),
    ).toBeGreaterThanOrEqual(before - 5000);
  });

  it('persiste identificación y correo opcionales y genera códigos únicos', async () => {
    const db = requireSqlServer();
    const service = new AveriasService(db.getRepository(Averia));
    const suffix = `${Date.now()}`;

    const first = await service.createPublicReport({
      nombreReportante: `TEST_TEMP_UnicoA_${suffix}`,
      identificacionReportante: '1-2345-6789',
      telefonoReportante: '88888888',
      correoReportante: 'prueba.averia.e2e@example.com',
      ubicacion: '200 m norte de la escuela',
      sectorComunidad: 'Sector Prueba',
      descripcion: 'Reporte generado durante validación E2E.',
    });
    const second = await service.createPublicReport({
      nombreReportante: `TEST_TEMP_UnicoB_${suffix}`,
      telefonoReportante: '88888888',
      ubicacion: '200 m norte de la escuela',
      sectorComunidad: 'Sector Prueba',
      descripcion: 'Reporte generado durante validación E2E.',
    });
    const third = await service.createPublicReport({
      nombreReportante: `TEST_TEMP_UnicoC_${suffix}`,
      telefonoReportante: '88888888',
      ubicacion: '200 m norte de la escuela',
      sectorComunidad: 'Sector Prueba',
      descripcion: 'Reporte generado durante validación E2E.',
    });

    createdCodes.push(
      first.data.codigoSeguimiento,
      second.data.codigoSeguimiento,
      third.data.codigoSeguimiento,
    );

    expect(
      new Set([
        first.data.codigoSeguimiento,
        second.data.codigoSeguimiento,
        third.data.codigoSeguimiento,
      ]).size,
    ).toBe(3);

    const [row] = await db.query<AveriaRow[]>(AVERIA_SELECT, [
      first.data.codigoSeguimiento,
    ]);
    expect(row?.identificacionReportante).toBe('1-2345-6789');
    expect(row?.correoReportante).toBe('prueba.averia.e2e@example.com');
    expect(row?.idAbonado).toBeNull();
  });
});
