import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { EstadoAveria } from '../common/enums/estado-averia.enum';
import { AveriasService } from '../modules/averias/averias.service';
import { Averia } from '../modules/averias/entities/averia.entity';
import { Usuario } from '../modules/usuarios/entities/usuario.entity';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

describe('Listado administrativo de Averia en SQL Server', () => {
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
        '[AVISO QA] SQL Server no está disponible para listado admin de averías:',
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

  it('filtra, pagina y ordena en SQL Server incluyendo nulls y el día final', async () => {
    if (!isConnected || !dataSource) {
      console.warn(
        '[AVISO QA] SQL Server no está disponible: listado admin BLOQUEADO / NO EJECUTADO',
      );
      return;
    }
    const ds = dataSource;
    const averiaRepo = ds.getRepository(Averia);
    const usuarioRepo = ds.getRepository(Usuario);
    const service = new AveriasService(averiaRepo);

    const fontanero = await usuarioRepo.save(usuarioRepo.create({}));
    createdUsuarioId = fontanero.idUsuario;

    const seeds: Array<Partial<Averia> & { codigoSeguimiento: string }> = [
      {
        codigoSeguimiento: 'AV-QA-ADM-0001',
        fechaReporte: new Date('2026-09-12T22:15:00.000Z'),
        nombreReportante: 'María QA',
        telefonoReportante: '8888-0001',
        ubicacion: 'Escuela QA',
        sectorComunidad: 'San Juan',
        descripcion: 'Fuga QA sin clasificar',
        estado: EstadoAveria.RECIBIDA,
        tipoAveria: null,
        prioridad: null,
        idFontaneroAsignado: null,
      },
      {
        codigoSeguimiento: 'AV-QA-ADM-0002',
        fechaReporte: new Date('2026-09-12T08:00:00.000Z'),
        nombreReportante: 'Juan QA',
        telefonoReportante: '8888-0002',
        ubicacion: 'Tanque QA',
        sectorComunidad: 'San Juan',
        descripcion: 'Fuga QA clasificada',
        estado: EstadoAveria.RECIBIDA,
        tipoAveria: 'TUBERIA',
        prioridad: 'ALTA',
        idFontaneroAsignado: fontanero.idUsuario,
      },
      {
        codigoSeguimiento: 'AV-QA-ADM-0003',
        fechaReporte: new Date('2026-08-01T08:00:00.000Z'),
        nombreReportante: 'Fuera de rango QA',
        telefonoReportante: '8888-0003',
        ubicacion: 'Otra',
        sectorComunidad: 'San Juan',
        descripcion: 'No debe entrar al rango',
        estado: EstadoAveria.RECIBIDA,
        tipoAveria: 'TUBERIA',
        prioridad: 'ALTA',
        idFontaneroAsignado: fontanero.idUsuario,
      },
    ];

    for (const seed of seeds) {
      await averiaRepo.save(averiaRepo.create(seed));
      createdCodes.push(seed.codigoSeguimiento);
    }

    const listado = await service.findAllAdmin({
      page: 1,
      limit: 20,
      fechaDesde: '2026-09-01',
      fechaHasta: '2026-09-12',
    });

    const codes = listado.data.map((item) => item.codigoSeguimiento);
    expect(codes).toEqual(
      expect.arrayContaining(['AV-QA-ADM-0001', 'AV-QA-ADM-0002']),
    );
    expect(codes).not.toContain('AV-QA-ADM-0003');
    expect(listado.total).toBeGreaterThanOrEqual(2);
    expect(listado.page).toBe(1);
    expect(listado.limit).toBe(20);
    expect(listado.totalPages).toBe(
      Math.ceil(listado.total / listado.limit) || 0,
    );

    const unclassified = listado.data.find(
      (item) => item.codigoSeguimiento === 'AV-QA-ADM-0001',
    );
    expect(unclassified?.prioridad).toBeNull();
    expect(unclassified?.tipoAveria).toBeNull();
    expect(unclassified?.fontanero).toBeNull();

    const assigned = listado.data.find(
      (item) => item.codigoSeguimiento === 'AV-QA-ADM-0002',
    );
    expect(assigned?.prioridad).toBe('ALTA');
    expect(assigned?.fontanero).toEqual({ id: fontanero.idUsuario });

    const byCode = await service.findAllAdmin({
      page: 1,
      limit: 20,
      search: 'AV-QA-ADM-0001',
    });
    expect(
      byCode.data.some((item) => item.codigoSeguimiento === 'AV-QA-ADM-0001'),
    ).toBe(true);

    const sinAsignar = await service.findAllAdmin({
      page: 1,
      limit: 20,
      search: 'AV-QA-ADM-0001',
      prioridad: 'SIN_ASIGNAR',
    });
    expect(sinAsignar.data).toHaveLength(1);
    expect(sinAsignar.data[0].prioridad).toBeNull();

    const byName = await service.findAllAdmin({
      page: 1,
      limit: 20,
      search: 'María QA',
    });
    expect(
      byName.data.some((item) => item.nombreReportante === 'María QA'),
    ).toBe(true);

    const paged = await service.findAllAdmin({
      page: 1,
      limit: 1,
      search: 'AV-QA-ADM-',
    });
    expect(paged.data).toHaveLength(1);
    expect(paged.total).toBeGreaterThanOrEqual(3);
    expect(paged.total).not.toBe(paged.data.length);
    expect(paged.limit).toBe(1);
  });
});
