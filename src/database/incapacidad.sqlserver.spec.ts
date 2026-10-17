import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { Colaborador } from '../modules/recursos-humanos/entities/colaborador.entity';
import { Incapacidad } from '../modules/recursos-humanos/entities/incapacidad.entity';
import { MovimientoVacaciones } from '../modules/recursos-humanos/entities/movimiento-vacaciones.entity';
import { PermisoColaborador } from '../modules/recursos-humanos/entities/permiso-colaborador.entity';
import { Rol } from '../modules/usuarios/entities/rol.entity';
import { Usuario } from '../modules/usuarios/entities/usuario.entity';
import { buildMigrationDataSourceOptions } from './data-source.options';

loadEnv();

/**
 * QA 6.4.2 / 6.4.3 — Compatibilidad entidad Incapacidad ↔ SQL Server.
 * Inserta y actualiza vía TypeORM. Si SQL Server no está disponible,
 * las pruebas se marcan pendientes.
 */
describe('SQL Server — Incapacidad (persistencia TypeORM)', () => {
  jest.setTimeout(60_000);

  let dataSource: DataSource | null = null;
  let disponible = false;
  let motivo = '';

  const requiere = (): DataSource => {
    if (!disponible || !dataSource) {
      pending(`SQL Server no está disponible: ${motivo}`);
      throw new Error('SQL Server no disponible');
    }
    return dataSource;
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
      disponible = true;
    } catch (error) {
      disponible = false;
      motivo = error instanceof Error ? error.message : String(error);
      console.warn('[AVISO QA] SQL Server no está disponible:', motivo);
    }
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('confirma que no hay migraciones pendientes', async () => {
    const db = requiere();
    const pending = await db.showMigrations();
    expect(pending).toBe(false);
  });

  it('persiste una incapacidad con TypeORM y limpia el colaborador de prueba', async () => {
    const db = requiere();
    const colaboradorRepo = db.getRepository(Colaborador);
    const incapacidadRepo = db.getRepository(Incapacidad);
    const marca = `QA642-ORM-${Date.now()}`;
    const cedula = `8-${String(Date.now()).slice(-8, -4)}-${String(Date.now()).slice(-4)}`;

    const colaborador = await colaboradorRepo.save(
      colaboradorRepo.create({
        nombre: 'Luis',
        apellidos: marca,
        cedula,
        correoElectronico: `incapacidad.orm.${Date.now()}@asadasanjuan.cr`,
        cargo: 'Fontanero',
        activo: true,
        usuarioId: null,
      }),
    );

    try {
      const guardada = await incapacidadRepo.save(
        incapacidadRepo.create({
          colaboradorId: colaborador.id,
          fechaInicio: '2026-10-12',
          fechaFin: '2026-10-20',
          observaciones: 'Incapacidad registrada.',
        }),
      );

      expect(guardada.id).toBeGreaterThan(0);
      expect(guardada.colaboradorId).toBe(colaborador.id);
      expect(guardada.fechaInicio).toBe('2026-10-12');
      expect(guardada.fechaFin).toBe('2026-10-20');
      expect(guardada.observaciones).toBe('Incapacidad registrada.');
      expect(guardada.createdAt).toBeInstanceOf(Date);
      expect(guardada.updatedAt).toBeInstanceOf(Date);

      const segunda = await incapacidadRepo.save(
        incapacidadRepo.create({
          colaboradorId: colaborador.id,
          fechaInicio: '2026-12-01',
          fechaFin: '2026-12-05',
          observaciones: null,
        }),
      );
      expect(segunda.observaciones).toBeNull();

      const delColaborador = await incapacidadRepo.find({
        where: { colaboradorId: colaborador.id },
      });
      expect(delColaborador).toHaveLength(2);

      const updatedAtAntes = guardada.updatedAt.getTime();
      await new Promise((resolve) => setTimeout(resolve, 30));
      guardada.fechaFin = '2026-10-22';
      guardada.observaciones = 'Documento entregado a administración';
      const actualizada = await incapacidadRepo.save(guardada);

      expect(actualizada.fechaInicio).toBe('2026-10-12');
      expect(actualizada.fechaFin).toBe('2026-10-22');
      expect(actualizada.observaciones).toBe(
        'Documento entregado a administración',
      );
      expect(actualizada.updatedAt.getTime()).toBeGreaterThanOrEqual(
        updatedAtAntes,
      );

      const raw = await db.query<
        Array<{
          colaboradorId: number;
          fechaInicio: Date | string;
          fechaFin: Date | string;
          observaciones: string | null;
        }>
      >(
        `
        SELECT colaboradorId, fechaInicio, fechaFin, observaciones
        FROM Incapacidad
        WHERE id = @0
      `,
        [actualizada.id],
      );
      expect(Number(raw[0]?.colaboradorId)).toBe(colaborador.id);
      expect(raw[0]?.observaciones).toBe(
        'Documento entregado a administración',
      );

      await expect(
        incapacidadRepo.save(
          incapacidadRepo.create({
            colaboradorId: 9_999_999,
            fechaInicio: '2026-10-12',
            fechaFin: '2026-10-20',
            observaciones: null,
          }),
        ),
      ).rejects.toBeDefined();
    } finally {
      await incapacidadRepo.delete({ colaboradorId: colaborador.id });
      await colaboradorRepo.delete({ id: colaborador.id });
    }
  });
});
