import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { EstadoSolicitud } from '../common/enums/estado-solicitud.enum';
import { Role } from '../common/enums/role.enum';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { HistorialSolicitud } from '../modules/solicitudes/entities/historial-solicitud.entity';
import { SolicitudServicio } from '../modules/solicitudes/entities/solicitud-servicio.entity';
import { Solicitud } from '../modules/solicitudes/entities/solicitud.entity';
import { SolicitudesService } from '../modules/solicitudes/solicitudes.service';
import { Usuario } from '../modules/usuarios/entities/usuario.entity';
import { buildMigrationDataSourceOptions } from './data-source.options';
import { CreateHistorialSolicitudTable1724686220000 } from './migrations/1724686220000-CreateHistorialSolicitudTable';
import { AddObservacionesHistorialSolicitud1724686350000 } from './migrations/1724686350000-AddObservacionesHistorialSolicitud';

loadEnv();

describe('Cambio de estado Solicitud + HistorialSolicitud (SQL Server)', () => {
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
          AND TABLE_NAME IN ('Solicitud', 'Usuario', 'TipoSolicitud')
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
        '[AVISO QA] SQL Server no disponible para cambio de estado:',
        error instanceof Error ? error.message : error,
      );
    }
  }, 30_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('cambia estado, crea historial y respeta JWT', async () => {
    if (!ready || !dataSource) {
      console.warn('[AVISO QA] cambio de estado SQL Server omitido');
      return;
    }

    const tipo = await dataSource.query<{ id: number }[]>(`
      SELECT TOP 1 id FROM TipoSolicitud ORDER BY id
    `);
    const usuario = await dataSource.getRepository(Usuario).findOne({
      where: {},
      order: { idUsuario: 'ASC' },
    });
    if (!tipo[0]?.id || !usuario) {
      console.warn('[AVISO QA] faltan TipoSolicitud/Usuario');
      return;
    }

    const solicitudRepo = dataSource.getRepository(Solicitud);
    const historialRepo = dataSource.getRepository(HistorialSolicitud);
    const stamp = Date.now();
    const solicitud = await solicitudRepo.save(
      solicitudRepo.create({
        tipoSolicitudId: tipo[0].id,
        codigoSeguimiento: `SOL-CE-${stamp}`,
        estado: EstadoSolicitud.PENDIENTE,
        fechaIngreso: new Date(),
      }),
    );

    const service = new SolicitudesService(
      dataSource.getRepository(SolicitudServicio),
      solicitudRepo,
    );

    const userA: AuthenticatedUser = {
      userId: String(usuario.idUsuario),
      idUsuario: usuario.idUsuario,
      email: 'a@asada.cr',
      role: Role.ADMINISTRADORA,
    };

    const cambio1 = await service.actualizarEstado(
      solicitud.id,
      {
        estadoNuevo: EstadoSolicitud.EN_REVISION,
        observacionPublica: 'Mensaje público de prueba.',
        notaInterna: 'Nota interna de prueba.',
      },
      userA,
    );

    expect(cambio1.estadoAnterior).toBe(EstadoSolicitud.PENDIENTE);
    expect(cambio1.estadoNuevo).toBe(EstadoSolicitud.EN_REVISION);
    expect(cambio1.idUsuario).toBe(usuario.idUsuario);
    expect(cambio1.observacionPublica).toBe('Mensaje público de prueba.');
    expect(cambio1.notaInterna).toBe('Nota interna de prueba.');

    const persistida = await solicitudRepo.findOneByOrFail({
      id: solicitud.id,
    });
    expect(persistida.estado).toBe(EstadoSolicitud.EN_REVISION);

    await service.actualizarEstado(
      solicitud.id,
      { estadoNuevo: EstadoSolicitud.APROBADA },
      {
        userId: String(usuario.idUsuario),
        idUsuario: usuario.idUsuario,
        email: 'b@asada.cr',
        role: Role.SECRETARIA,
      },
    );

    const eventos = await historialRepo.find({
      where: { solicitudId: solicitud.id },
      order: { fecha: 'ASC', id: 'ASC' },
    });
    expect(eventos).toHaveLength(2);
    expect(eventos[0].estadoAnterior).toBe(EstadoSolicitud.PENDIENTE);
    expect(eventos[0].estadoNuevo).toBe(EstadoSolicitud.EN_REVISION);
    expect(eventos[1].estadoAnterior).toBe(EstadoSolicitud.EN_REVISION);
    expect(eventos[1].estadoNuevo).toBe(EstadoSolicitud.APROBADA);
    expect(eventos[0].fecha.getTime()).toBeLessThanOrEqual(
      eventos[1].fecha.getTime(),
    );

    await expect(
      service.actualizarEstado(
        solicitud.id,
        { estadoNuevo: EstadoSolicitud.APROBADA },
        userA,
      ),
    ).rejects.toThrow(/ya se encuentra/);

    await historialRepo.delete({ solicitudId: solicitud.id });
    await solicitudRepo.delete({ id: solicitud.id });
  });
});
