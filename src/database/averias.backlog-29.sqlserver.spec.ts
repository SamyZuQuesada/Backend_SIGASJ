import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { Averia } from '../modules/averias/entities/averia.entity';
import {
  AveriasService,
  buildAveriasReporteResumen,
} from '../modules/averias/averias.service';
import { Usuario } from '../modules/usuarios/entities/usuario.entity';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

type ConteoEstado = { estado: string | null; cantidad: number | string };

describe('Backlog 2.9 contra SQL Server', () => {
  jest.setTimeout(30_000);
  let dataSource: DataSource | null = null;
  let isConnected = false;

  beforeAll(async () => {
    try {
      const options = buildMigrationDataSourceOptions();
      if (options.type !== 'mssql') {
        return;
      }
      dataSource = new DataSource(options);
      await dataSource.initialize();
      const tables = await dataSource.query<{ TABLE_NAME: string }[]>(`
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME IN ('Averia', 'HistorialAveria')
      `);
      isConnected = tables.length === 2;
      if (!isConnected) {
        console.warn(
          '[AVISO QA] SQL Server conectó, pero falta Averia o HistorialAveria.',
        );
      }
    } catch (error) {
      isConnected = false;
      console.warn(
        '[AVISO QA] SQL Server no está disponible para el backlog 2.9:',
        error instanceof Error ? error.message : error,
      );
    }
  }, 15_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('compara el resumen con los conteos almacenados y revisa la relación del historial', async () => {
    if (!isConnected || !dataSource) {
      console.warn(
        '[AVISO QA] SQL Server no está disponible: contraste 2.9 NO EJECUTADO',
      );
      return;
    }

    const service = new AveriasService(
      dataSource.getRepository(Averia),
      dataSource.getRepository(Usuario),
    );
    const resumen = await service.reporteResumenAdmin({});
    const crudo = await dataSource.query<ConteoEstado[]>(`
      SELECT estado, COUNT(id) AS cantidad
      FROM Averia
      GROUP BY estado
    `);
    const esperado = buildAveriasReporteResumen(crudo, {
      fechaDesde: null,
      fechaHasta: null,
    });
    expect(resumen.total).toBe(esperado.total);
    expect(resumen.porEstado.RECIBIDA).toBe(esperado.porEstado.RECIBIDA);
    expect(resumen.porEstado.ASIGNADA).toBe(esperado.porEstado.ASIGNADA);
    expect(resumen.porEstado.PENDIENTE).toBe(esperado.porEstado.PENDIENTE);
    expect(resumen.porEstado.EN_ATENCION).toBe(esperado.porEstado.EN_ATENCION);
    expect(resumen.porEstado.RESUELTA).toBe(esperado.porEstado.RESUELTA);
    expect(resumen.otros).toBe(esperado.otros);

    const vacio = await service.reporteResumenAdmin({
      fechaDesde: '2099-01-01',
      fechaHasta: '2099-01-02',
    });
    expect(vacio.total).toBe(0);

    const relaciones = await dataSource.query<
      { nombre: string; accion: string; referenciada: string }[]
    >(`
      SELECT fk.name AS nombre,
             fk.delete_referential_action_desc AS accion,
             OBJECT_NAME(fk.referenced_object_id) AS referenciada
      FROM sys.foreign_keys fk
      WHERE OBJECT_NAME(fk.parent_object_id) = 'HistorialAveria'
    `);
    const porNombre = Object.fromEntries(
      relaciones.map((fila) => [fila.nombre, fila]),
    );
    expect(porNombre.FK_HistorialAveria_Averia).toMatchObject({
      referenciada: 'Averia',
      accion: 'NO_ACTION',
    });
    expect(porNombre.FK_HistorialAveria_Usuario).toMatchObject({
      referenciada: 'Usuario',
      accion: 'SET_NULL',
    });

    const resueltas = await dataSource.query<
      { resueltas: number; conHistorial: number; eventos: number }[]
    >(`
      SELECT COUNT(*) AS resueltas,
             SUM(CASE WHEN eventos > 0 THEN 1 ELSE 0 END) AS conHistorial,
             SUM(eventos) AS eventos
      FROM (
        SELECT a.id, COUNT(h.id) AS eventos
        FROM Averia a
        LEFT JOIN HistorialAveria h ON h.idAveria = a.id
        WHERE a.estado = 'RESUELTA'
        GROUP BY a.id
      ) resumen
    `);
    const fila = resueltas[0];
    expect(Number(fila?.resueltas ?? 0)).toBeGreaterThanOrEqual(0);
    expect(Number(fila?.conHistorial ?? 0)).toBeLessThanOrEqual(
      Number(fila?.resueltas ?? 0),
    );
    console.info(
      `[QA 2.9 SQL Server] total=${resumen.total} recibidas=${resumen.porEstado.RECIBIDA} asignadas=${resumen.porEstado.ASIGNADA} pendientes=${resumen.porEstado.PENDIENTE} enAtencion=${resumen.porEstado.EN_ATENCION} resueltas=${resumen.porEstado.RESUELTA} enRevision=${resumen.porEstado.EN_REVISION} canceladas=${resumen.porEstado.CANCELADA} otros=${resumen.otros} resueltasConHistorial=${fila?.conHistorial ?? 0}/${fila?.resueltas ?? 0} eventosEnResueltas=${fila?.eventos ?? 0}`,
    );
  });
});
