import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { aFechaIso } from '../modules/recursos-humanos/fecha-permiso';
import { Colaborador } from '../modules/recursos-humanos/entities/colaborador.entity';
import { Incapacidad } from '../modules/recursos-humanos/entities/incapacidad.entity';
import { MovimientoVacaciones } from '../modules/recursos-humanos/entities/movimiento-vacaciones.entity';
import { PermisoColaborador } from '../modules/recursos-humanos/entities/permiso-colaborador.entity';
import { IncapacidadesService } from '../modules/recursos-humanos/incapacidades.service';
import { Rol } from '../modules/usuarios/entities/rol.entity';
import { Usuario } from '../modules/usuarios/entities/usuario.entity';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

/**
 * QA 6.4.4 — Listado/filtros/paginación/detalle contra SQL Server real
 * vía el mismo service productivo (TypeORM QueryBuilder).
 */
describe('SQL Server — consulta de incapacidades (service real)', () => {
  jest.setTimeout(60_000);

  let dataSource: DataSource | null = null;
  let service: IncapacidadesService | null = null;
  let disponible = false;
  let motivo = '';
  let colaboradorId = 0;
  let incapacidadId = 0;

  const requiere = () => {
    if (!disponible || !dataSource || !service) {
      pending(`SQL Server no está disponible: ${motivo}`);
      throw new Error('SQL Server no disponible');
    }
    return { db: dataSource, service };
  };

  beforeAll(async () => {
    try {
      const options = buildMigrationDataSourceOptions();
      if (options.type !== 'mssql') {
        motivo = `DB_TYPE=${options.type}`;
        return;
      }
      dataSource = new DataSource({
        ...options,
        entities: [
          Rol,
          Usuario,
          Colaborador,
          PermisoColaborador,
          MovimientoVacaciones,
          Incapacidad,
        ],
        synchronize: false,
        migrationsRun: false,
      });
      await dataSource.initialize();
      service = new IncapacidadesService(
        dataSource.getRepository(Incapacidad),
        dataSource.getRepository(Colaborador),
      );

      const marca = `QA644-${Date.now()}`;
      const cedula = `7-${String(Date.now()).slice(-8, -4)}-${String(Date.now()).slice(-4)}`;
      const colaborador = await dataSource.getRepository(Colaborador).save(
        dataSource.getRepository(Colaborador).create({
          nombre: 'Maya',
          apellidos: marca,
          cedula,
          correoElectronico: `incapacidad.consulta.${Date.now()}@asadasanjuan.cr`,
          cargo: 'Fontanero',
          activo: true,
          usuarioId: null,
        }),
      );
      colaboradorId = colaborador.id;

      const primera = await dataSource.getRepository(Incapacidad).save(
        dataSource.getRepository(Incapacidad).create({
          colaboradorId,
          fechaInicio: '2026-10-12',
          fechaFin: '2026-10-14',
          observaciones: 'Incapacidad registrada.',
        }),
      );
      incapacidadId = primera.id;

      await dataSource.getRepository(Incapacidad).save(
        dataSource.getRepository(Incapacidad).create({
          colaboradorId,
          fechaInicio: '2026-11-01',
          fechaFin: '2026-11-03',
          observaciones: null,
        }),
      );

      disponible = true;
    } catch (error) {
      disponible = false;
      motivo = error instanceof Error ? error.message : String(error);
      console.warn('[AVISO QA] SQL Server no está disponible:', motivo);
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized && colaboradorId > 0) {
      await dataSource.getRepository(Incapacidad).delete({ colaboradorId });
      await dataSource.getRepository(Colaborador).delete({ id: colaboradorId });
      await dataSource.destroy();
    }
  });

  it('lista filtrando por colaborador y compara con SQL directo', async () => {
    const { db, service: svc } = requiere();
    const listado = await svc.findAll({
      colaboradorId,
      page: 1,
      limit: 10,
    });

    expect(listado.total).toBe(2);
    expect(listado.data).toHaveLength(2);
    expect(listado.data.map((i) => i.fechaInicio)).toEqual([
      '2026-11-01',
      '2026-10-12',
    ]);

    const raw = await db.query<
      Array<{ id: number; fechaInicio: Date | string }>
    >(
      `
      SELECT id, fechaInicio
      FROM Incapacidad
      WHERE colaboradorId = @0
      ORDER BY fechaInicio DESC, id DESC
    `,
      [colaboradorId],
    );
    expect(raw).toHaveLength(2);
    expect(aFechaIso(raw[0].fechaInicio)).toBe(listado.data[0].fechaInicio);
    expect(Number(raw[0].id)).toBe(listado.data[0].id);
  });

  it('filtra por rango de fechas (traslape) y pagina', async () => {
    const { service: svc } = requiere();
    const rango = await svc.findAll({
      colaboradorId,
      fechaInicio: '2026-10-13',
      fechaFin: '2026-10-20',
      page: 1,
      limit: 10,
    });
    expect(rango.total).toBe(1);
    expect(rango.data[0].fechaInicio).toBe('2026-10-12');

    const pagina1 = await svc.findAll({
      colaboradorId,
      page: 1,
      limit: 1,
    });
    const pagina2 = await svc.findAll({
      colaboradorId,
      page: 2,
      limit: 1,
    });
    expect(pagina1.total).toBe(2);
    expect(pagina1.totalPages).toBe(2);
    expect(pagina1.data).toHaveLength(1);
    expect(pagina2.data).toHaveLength(1);
    expect(pagina1.data[0].id).not.toBe(pagina2.data[0].id);
  });

  it('consulta detalle y lista vacía sin errores', async () => {
    const { service: svc } = requiere();
    const detalle = await svc.findOne(incapacidadId);
    expect(detalle.colaboradorId).toBe(colaboradorId);
    expect(detalle.fechaInicio).toBe('2026-10-12');
    expect(detalle.observaciones).toBe('Incapacidad registrada.');
    expect(detalle.colaborador).toBeDefined();

    const vacio = await svc.findAll({
      colaboradorId,
      fechaInicio: '2028-01-01',
      fechaFin: '2028-01-31',
      page: 1,
      limit: 10,
    });
    expect(vacio.total).toBe(0);
    expect(vacio.data).toEqual([]);
    expect(vacio.totalPages).toBe(0);
  });
});
