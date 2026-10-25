import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { EstadoSolicitud } from '../common/enums/estado-solicitud.enum';
import { PlazoArregloPago } from '../common/enums/plazo-arreglo-pago.enum';
import { HistorialSolicitud } from '../modules/solicitudes/entities/historial-solicitud.entity';
import { SolicitudArregloPago } from '../modules/solicitudes/entities/solicitud-arreglo-pago.entity';
import { SolicitudServicio } from '../modules/solicitudes/entities/solicitud-servicio.entity';
import { Solicitud } from '../modules/solicitudes/entities/solicitud.entity';
import {
  MENSAJE_SEGUIMIENTO_NO_ENCONTRADO,
  SolicitudSeguimientoNoEncontradaException,
} from '../modules/solicitudes/errors/solicitud.errors';
import { SolicitudesService } from '../modules/solicitudes/solicitudes.service';
import { Usuario } from '../modules/usuarios/entities/usuario.entity';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateHistorialSolicitudTable1724686220000 } from './migrations/1724686220000-CreateHistorialSolicitudTable';
import { AddObservacionesHistorialSolicitud1724686350000 } from './migrations/1724686350000-AddObservacionesHistorialSolicitud';

loadEnv();

describe('Seguimiento público Solicitud (SQL Server)', () => {
  jest.setTimeout(60_000);
  let dataSource: DataSource | null = null;
  let ready = false;

  beforeAll(async () => {
    try {
      const options = buildMigrationDataSourceOptions();
      if (options.type !== 'mssql') {
        return;
      }
      dataSource = new DataSource(options);
      await dataSource.initialize();

      const tables = await dataSource.query<{ total: number }[]>(`
        SELECT COUNT(*) AS total
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'dbo'
          AND TABLE_NAME IN ('Solicitud', 'SolicitudArregloPago', 'TipoSolicitud')
      `);
      if (Number(tables[0]?.total) < 3) {
        return;
      }

      const hist = await dataSource.query<{ total: number }[]>(`
        SELECT COUNT(*) AS total
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'HistorialSolicitud'
      `);
      if (Number(hist[0]?.total) === 0) {
        const qr = dataSource.createQueryRunner();
        await new CreateHistorialSolicitudTable1724686220000().up(qr);
        await new AddObservacionesHistorialSolicitud1724686350000().up(qr);
        await qr.release();
      }

      ready = true;
    } catch (error) {
      console.warn(
        '[AVISO QA] SQL Server no disponible para seguimiento público:',
        error instanceof Error ? error.message : error,
      );
    }
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('CASOS 1–4: combinación válida / inválida / privacidad', async () => {
    if (!ready || !dataSource) {
      console.warn('[AVISO QA] seguimiento público SQL Server omitido');
      return;
    }

    const tipo = await dataSource.query<{ id: number }[]>(`
      SELECT TOP 1 id FROM TipoSolicitud ORDER BY id
    `);
    if (!tipo[0]?.id) {
      console.warn('[AVISO QA] sin TipoSolicitud');
      return;
    }

    const usuario = await dataSource.getRepository(Usuario).findOne({
      where: {},
      order: { idUsuario: 'ASC' },
    });

    const codigo = `SOL-2026-${String(Date.now()).slice(-5)}`;
    const identificacionOk = '1-QA01-0001';
    const identificacionBad = '9-9999-9999';

    const solicitudRepo = dataSource.getRepository(Solicitud);
    const arregloRepo = dataSource.getRepository(SolicitudArregloPago);
    const historialRepo = dataSource.getRepository(HistorialSolicitud);

    const solicitud = await solicitudRepo.save(
      solicitudRepo.create({
        tipoSolicitudId: tipo[0].id,
        codigoSeguimiento: codigo,
        estado: EstadoSolicitud.PENDIENTE,
        fechaIngreso: new Date(),
      }),
    );

    await arregloRepo.save(
      arregloRepo.create({
        solicitudId: solicitud.id,
        nombre: 'Ciudadano QA',
        cedula: identificacionOk,
        vecinoDe: 'San Juan',
        telefono: '8888-0000',
        numeroCuentaServicio: 'QA-CUENTA-1',
        montoPrimaInicial: 1000,
        plazoSeleccionado: PlazoArregloPago.MESES_3,
      }),
    );

    await historialRepo.save(
      historialRepo.create({
        solicitudId: solicitud.id,
        estadoAnterior: null,
        estadoNuevo: EstadoSolicitud.PENDIENTE,
        observacionPublica: null,
        notaInterna: null,
        idUsuario: null,
      }),
    );

    await historialRepo.save(
      historialRepo.create({
        solicitudId: solicitud.id,
        estadoAnterior: EstadoSolicitud.PENDIENTE,
        estadoNuevo: EstadoSolicitud.EN_REVISION,
        observacionPublica: 'Observación pública QA',
        notaInterna: 'NOTA_INTERNA_CONFIDENCIAL_QA',
        idUsuario: usuario?.idUsuario ?? null,
      }),
    );

    await solicitudRepo.update(solicitud.id, {
      estado: EstadoSolicitud.EN_REVISION,
    });

    const service = new SolicitudesService(
      dataSource.getRepository(SolicitudServicio),
      solicitudRepo,
      arregloRepo,
      undefined,
      undefined,
      historialRepo,
    );

    // CASO 1 — combinación correcta
    const ok = await service.consultarSeguimientoPublico({
      codigo,
      identificacion: identificacionOk,
    });
    expect(ok.codigoSeguimiento).toBe(codigo);
    expect(ok.estado).toBe(EstadoSolicitud.EN_REVISION);
    expect(ok.historial.length).toBeGreaterThanOrEqual(2);
    expect(
      ok.historial.some(
        (e) => e.observacionPublica === 'Observación pública QA',
      ),
    ).toBe(true);
    const serialized = JSON.stringify(ok);
    expect(serialized).not.toContain('NOTA_INTERNA_CONFIDENCIAL_QA');
    expect(serialized).not.toContain('notaInterna');
    expect(serialized).not.toContain('idUsuario');
    if (usuario?.nombre) {
      expect(serialized).not.toContain(usuario.nombre);
    }
    expect(serialized).not.toContain(identificacionOk);

    // CASO 2 — identificación incorrecta
    await expect(
      service.consultarSeguimientoPublico({
        codigo,
        identificacion: identificacionBad,
      }),
    ).rejects.toThrow(SolicitudSeguimientoNoEncontradaException);

    // CASO 3 — código inexistente
    let msgA = '';
    let msgB = '';
    try {
      await service.consultarSeguimientoPublico({
        codigo: 'SOL-2099-99999',
        identificacion: identificacionOk,
      });
    } catch (e) {
      msgA = (e as Error).message;
    }
    try {
      await service.consultarSeguimientoPublico({
        codigo,
        identificacion: identificacionBad,
      });
    } catch (e) {
      msgB = (e as Error).message;
    }
    expect(msgA).toBe(MENSAJE_SEGUIMIENTO_NO_ENCONTRADO);
    expect(msgB).toBe(MENSAJE_SEGUIMIENTO_NO_ENCONTRADO);
    expect(msgA).toBe(msgB);

    // Limpieza
    await historialRepo.delete({ solicitudId: solicitud.id });
    await arregloRepo.delete({ solicitudId: solicitud.id });
    await solicitudRepo.delete({ id: solicitud.id });
  });
});
