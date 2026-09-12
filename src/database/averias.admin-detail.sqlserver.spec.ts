import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { EstadoAveria } from '../common/enums/estado-averia.enum';
import {
  AVERIA_ADMIN_NOT_FOUND,
  AveriasService,
  buildFindOneAdminQuery,
} from '../modules/averias/averias.service';
import { Averia } from '../modules/averias/entities/averia.entity';
import { Usuario } from '../modules/usuarios/entities/usuario.entity';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

describe('Detalle administrativo de Averia en SQL Server', () => {
  jest.setTimeout(30_000);
  let dataSource: DataSource | null = null;
  let isConnected = false;
  const createdCodes: string[] = [];
  let createdUsuarioId: number | null = null;

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
        '[AVISO QA] SQL Server no está disponible para detalle admin de averías:',
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
      if (createdUsuarioId != null) {
        await dataSource.query(`DELETE FROM Usuario WHERE idUsuario = @0`, [
          createdUsuarioId,
        ]);
      }
      await dataSource.destroy();
    }
  });

  it('consulta el detalle real, incluyendo nulls y Fontanero, por PK', async () => {
    if (!isConnected || !dataSource) {
      console.warn(
        '[AVISO QA] SQL Server no está disponible: detalle admin BLOQUEADO / NO EJECUTADO',
      );
      return;
    }

    const ds = dataSource;
    const averiaRepo = ds.getRepository(Averia);
    const usuarioRepo = ds.getRepository(Usuario);
    const service = new AveriasService(averiaRepo);

    const fontanero = await usuarioRepo.save(usuarioRepo.create({}));
    createdUsuarioId = fontanero.idUsuario;

    const received = await averiaRepo.save(
      averiaRepo.create({
        codigoSeguimiento: 'AV-QA-DET-0001',
        fechaReporte: new Date('2026-09-12T22:15:00.000Z'),
        nombreReportante: 'María QA Detalle',
        identificacionReportante: null,
        telefonoReportante: '8888-1001',
        correoReportante: null,
        idAbonado: null,
        ubicacion: 'Escuela QA detalle',
        sectorComunidad: 'San Juan',
        descripcion: 'Fuga QA recién recibida sin clasificar',
        estado: EstadoAveria.RECIBIDA,
        tipoAveria: null,
        prioridad: null,
        idFontaneroAsignado: null,
        fechaAsignacion: null,
        fechaInicioAtencion: null,
        fechaResolucion: null,
        observacionesAtencion: null,
      }),
    );
    createdCodes.push('AV-QA-DET-0001');

    const assigned = await averiaRepo.save(
      averiaRepo.create({
        codigoSeguimiento: 'AV-QA-DET-0002',
        fechaReporte: new Date('2026-09-12T08:00:00.000Z'),
        nombreReportante: 'Juan QA Detalle',
        identificacionReportante: '1-2345-6789',
        telefonoReportante: '8888-1002',
        correoReportante: 'juan.qa@example.com',
        idAbonado: 21,
        ubicacion: 'Tanque QA detalle',
        sectorComunidad: 'San Juan',
        descripcion: 'Fuga QA clasificada con Fontanero',
        estado: EstadoAveria.RECIBIDA,
        tipoAveria: 'TUBERIA',
        prioridad: 'ALTA',
        idFontaneroAsignado: fontanero.idUsuario,
        fechaAsignacion: new Date('2026-09-13T08:15:00.000Z'),
        fechaInicioAtencion: new Date('2026-09-13T09:00:00.000Z'),
        fechaResolucion: new Date('2026-09-13T15:00:00.000Z'),
        observacionesAtencion: 'Cierre QA de detalle',
      }),
    );
    createdCodes.push('AV-QA-DET-0002');

    const sql = buildFindOneAdminQuery(averiaRepo, received.id).getQuery();
    expect(sql.toUpperCase()).toContain('LEFT JOIN');
    expect(sql.toUpperCase()).not.toContain('INNER JOIN');
    expect(sql).toMatch(/averia[".]+id/i);

    const freshlyReceived = await service.findOneAdmin(received.id);
    expect(freshlyReceived.codigoSeguimiento).toBe('AV-QA-DET-0001');
    expect(freshlyReceived.identificacionReportante).toBeNull();
    expect(freshlyReceived.correoReportante).toBeNull();
    expect(freshlyReceived.abonado).toBeNull();
    expect(freshlyReceived.fontanero).toBeNull();
    expect(freshlyReceived.tipoAveria).toBeNull();
    expect(freshlyReceived.prioridad).toBeNull();
    expect(freshlyReceived.fechaAsignacion).toBeNull();
    expect(freshlyReceived.observacionesAtencion).toBeNull();

    const persisted = await ds.query<
      Array<{
        codigoSeguimiento: string;
        identificacionReportante: string | null;
        correoReportante: string | null;
        idAbonado: number | null;
        descripcion: string;
        observacionesAtencion: string | null;
      }>
    >(
      `SELECT codigoSeguimiento, identificacionReportante, correoReportante,
              idAbonado, descripcion, observacionesAtencion
       FROM Averia WHERE id = @0`,
      [assigned.id],
    );

    const complete = await service.findOneAdmin(assigned.id);
    expect(complete.codigoSeguimiento).toBe(persisted[0]?.codigoSeguimiento);
    expect(complete.identificacionReportante).toBe(
      persisted[0]?.identificacionReportante,
    );
    expect(complete.correoReportante).toBe(persisted[0]?.correoReportante);
    expect(complete.abonado).toEqual({ id: persisted[0]?.idAbonado });
    expect(complete.descripcion).toBe(persisted[0]?.descripcion);
    expect(complete.observacionesAtencion).toBe(
      persisted[0]?.observacionesAtencion,
    );
    expect(complete.fontanero).toEqual({ id: fontanero.idUsuario });
    expect(complete.tipoAveria).toBe('TUBERIA');
    expect(complete.prioridad).toBe('ALTA');

    await expect(service.findOneAdmin(2_147_000_000)).rejects.toMatchObject({
      message: AVERIA_ADMIN_NOT_FOUND,
    });
  });
});
