import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { TipoEventoHistorialRrhh } from '../../common/enums/tipo-evento-historial-rrhh.enum';
import { TipoMovimientoVacaciones } from '../../common/enums/tipo-movimiento-vacaciones.enum';
import { HistorialColaboradorResponseDto } from './dto/historial-colaborador.dto';
import { Colaborador } from './entities/colaborador.entity';
import { Incapacidad } from './entities/incapacidad.entity';
import { MovimientoVacaciones } from './entities/movimiento-vacaciones.entity';
import { PermisoColaborador } from './entities/permiso-colaborador.entity';
import {
  COLABORADORES_URL,
  crearColaboradoresTestApp,
} from './testing/colaboradores.test-app';

describe('GET /api/v1/rrhh/colaboradores/:id/historial', () => {
  let app: INestApplication<App>;
  let colaboradorRepository: Repository<Colaborador>;
  let permisoRepository: Repository<PermisoColaborador>;
  let vacacionesRepository: Repository<MovimientoVacaciones>;
  let incapacidadRepository: Repository<Incapacidad>;
  let adminToken: string;
  let signAs: (role: Role) => string;

  const historialUrl = (id: number | string) =>
    `${COLABORADORES_URL}/${id}/historial`;

  const get = (
    id: number | string,
    tokenOrQuery: string | Record<string, string | number> = adminToken,
    maybeQuery?: Record<string, string | number>,
  ) => {
    const token = typeof tokenOrQuery === 'string' ? tokenOrQuery : adminToken;
    const query = typeof tokenOrQuery === 'object' ? tokenOrQuery : maybeQuery;
    const req = request(app.getHttpServer()).get(historialUrl(id));
    if (query) {
      void req.query(query);
    }
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  const crearColaborador = async (
    datos: Partial<Colaborador> = {},
  ): Promise<Colaborador> => {
    const n = String(Math.floor(1000 + Math.random() * 8999));
    const m = String(Math.floor(1000 + Math.random() * 8999));
    return colaboradorRepository.save(
      colaboradorRepository.create({
        nombre: 'Juan',
        apellidos: 'Pérez',
        cedula: `1-${n}-${m}`,
        correoElectronico: `juan.${n}${m}@asadasanjuan.cr`,
        cargo: 'Fontanero',
        activo: true,
        usuarioId: null,
        ...datos,
      }),
    );
  };

  beforeAll(async () => {
    const ctx = await crearColaboradoresTestApp();
    ({ app, colaboradorRepository, signAs } = ctx);
    adminToken = signAs(Role.ADMINISTRADORA);
    permisoRepository = app.get(getRepositoryToken(PermisoColaborador));
    vacacionesRepository = app.get(getRepositoryToken(MovimientoVacaciones));
    incapacidadRepository = app.get(getRepositoryToken(Incapacidad));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await incapacidadRepository.clear();
    await vacacionesRepository.clear();
    await permisoRepository.clear();
    await colaboradorRepository.clear();
  });

  describe('Autenticación y permisos', () => {
    it('rechaza sin token (401)', async () => {
      const colaborador = await crearColaborador();
      const res = await get(colaborador.id, '');
      expect(res.status).toBe(401);
    });

    it.each([Role.FONTANERO, Role.ABONADO, Role.AYUDANTE])(
      'rechaza al rol %s (403)',
      async (role) => {
        const colaborador = await crearColaborador();
        const res = await get(colaborador.id, signAs(role));
        expect(res.status).toBe(403);
      },
    );
  });

  describe('Validación', () => {
    it('rechaza id no numérico (400)', async () => {
      const res = await get('abc');
      expect(res.status).toBe(400);
    });

    it('colaborador inexistente (404)', async () => {
      const res = await get(99999);
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).toMatch(/colaborador/i);
    });
  });

  describe('Consulta', () => {
    it('colaborador sin eventos devuelve 200 y historial vacío', async () => {
      const colaborador = await crearColaborador();
      const res = await get(colaborador.id);
      expect(res.status).toBe(200);
      const body = res.body as HistorialColaboradorResponseDto;
      expect(body.colaborador).toMatchObject({
        id: colaborador.id,
        nombre: colaborador.nombre,
        apellidos: colaborador.apellidos,
      });
      expect(body.historial).toEqual([]);
      expect(body).toMatchObject({
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });
    });

    it('incluye permisos del colaborador', async () => {
      const colaborador = await crearColaborador();
      await permisoRepository.save(
        permisoRepository.create({
          colaboradorId: colaborador.id,
          fechaInicio: '2026-10-12',
          fechaFin: '2026-10-14',
          motivo: 'Cita médica',
          observaciones: null,
        }),
      );

      const body = (await get(colaborador.id).expect(200))
        .body as HistorialColaboradorResponseDto;
      expect(body.historial).toHaveLength(1);
      expect(body.historial[0]).toMatchObject({
        tipo: TipoEventoHistorialRrhh.PERMISO,
        fecha: '2026-10-12',
        fechaInicio: '2026-10-12',
        fechaFin: '2026-10-14',
        motivo: 'Cita médica',
      });
    });

    it('incluye movimientos de vacaciones del colaborador', async () => {
      const colaborador = await crearColaborador();
      await vacacionesRepository.save(
        vacacionesRepository.create({
          colaboradorId: colaborador.id,
          tipo: TipoMovimientoVacaciones.ACUMULADO,
          cantidadDias: 12,
          fecha: '2026-09-01',
          observaciones: 'Periodo 2026',
        }),
      );

      const body = (await get(colaborador.id).expect(200))
        .body as HistorialColaboradorResponseDto;
      expect(body.historial).toHaveLength(1);
      expect(body.historial[0]).toMatchObject({
        tipo: TipoEventoHistorialRrhh.VACACION,
        fecha: '2026-09-01',
        tipoMovimiento: TipoMovimientoVacaciones.ACUMULADO,
        cantidadDias: 12,
      });
    });

    it('incluye incapacidades del colaborador', async () => {
      const colaborador = await crearColaborador();
      await incapacidadRepository.save(
        incapacidadRepository.create({
          colaboradorId: colaborador.id,
          fechaInicio: '2026-10-17',
          fechaFin: '2026-10-20',
          observaciones: 'Documento entregado',
        }),
      );

      const body = (await get(colaborador.id).expect(200))
        .body as HistorialColaboradorResponseDto;
      expect(body.historial).toHaveLength(1);
      expect(body.historial[0]).toMatchObject({
        tipo: TipoEventoHistorialRrhh.INCAPACIDAD,
        fecha: '2026-10-17',
        fechaInicio: '2026-10-17',
        fechaFin: '2026-10-20',
        observaciones: 'Documento entregado',
      });
    });

    it('unifica los tres tipos, solo del colaborador solicitado y ordenados', async () => {
      const principal = await crearColaborador({
        nombre: 'Principal',
        cedula: '1-1111-1111',
        correoElectronico: 'principal@asadasanjuan.cr',
      });
      const otro = await crearColaborador({
        nombre: 'Otro',
        cedula: '1-2222-2222',
        correoElectronico: 'otro@asadasanjuan.cr',
      });

      await permisoRepository.save([
        permisoRepository.create({
          colaboradorId: principal.id,
          fechaInicio: '2026-10-10',
          fechaFin: '2026-10-11',
          motivo: 'Permiso principal',
          observaciones: null,
        }),
        permisoRepository.create({
          colaboradorId: otro.id,
          fechaInicio: '2026-12-01',
          fechaFin: '2026-12-02',
          motivo: 'Permiso ajeno',
          observaciones: null,
        }),
      ]);
      await vacacionesRepository.save([
        vacacionesRepository.create({
          colaboradorId: principal.id,
          tipo: TipoMovimientoVacaciones.DISFRUTADO,
          cantidadDias: 3,
          fecha: '2026-10-20',
          observaciones: null,
        }),
        vacacionesRepository.create({
          colaboradorId: otro.id,
          tipo: TipoMovimientoVacaciones.ACUMULADO,
          cantidadDias: 99,
          fecha: '2026-01-01',
          observaciones: null,
        }),
      ]);
      await incapacidadRepository.save([
        incapacidadRepository.create({
          colaboradorId: principal.id,
          fechaInicio: '2026-10-15',
          fechaFin: '2026-10-16',
          observaciones: 'Incapacidad principal',
        }),
        incapacidadRepository.create({
          colaboradorId: otro.id,
          fechaInicio: '2026-11-01',
          fechaFin: '2026-11-02',
          observaciones: 'Incapacidad ajena',
        }),
      ]);

      const body = (await get(principal.id).expect(200))
        .body as HistorialColaboradorResponseDto;

      expect(body.historial).toHaveLength(3);
      expect(body.historial.map((e) => e.tipo)).toEqual([
        TipoEventoHistorialRrhh.VACACION,
        TipoEventoHistorialRrhh.INCAPACIDAD,
        TipoEventoHistorialRrhh.PERMISO,
      ]);
      expect(body.historial.map((e) => e.fecha)).toEqual([
        '2026-10-20',
        '2026-10-15',
        '2026-10-10',
      ]);
      expect(JSON.stringify(body.historial)).not.toMatch(/ajeno|Otro|99/);
    });

    it('no modifica registros al consultar (solo lectura)', async () => {
      const colaborador = await crearColaborador();
      await permisoRepository.save(
        permisoRepository.create({
          colaboradorId: colaborador.id,
          fechaInicio: '2026-10-01',
          fechaFin: '2026-10-02',
          motivo: 'Lectura',
          observaciones: null,
        }),
      );
      await vacacionesRepository.save(
        vacacionesRepository.create({
          colaboradorId: colaborador.id,
          tipo: TipoMovimientoVacaciones.ACUMULADO,
          cantidadDias: 5,
          fecha: '2026-10-01',
          observaciones: null,
        }),
      );
      await incapacidadRepository.save(
        incapacidadRepository.create({
          colaboradorId: colaborador.id,
          fechaInicio: '2026-10-01',
          fechaFin: '2026-10-03',
          observaciones: null,
        }),
      );

      const before = {
        permisos: await permisoRepository.count(),
        vacaciones: await vacacionesRepository.count(),
        incapacidades: await incapacidadRepository.count(),
      };

      await get(colaborador.id).expect(200);
      await get(colaborador.id).expect(200);

      expect(await permisoRepository.count()).toBe(before.permisos);
      expect(await vacacionesRepository.count()).toBe(before.vacaciones);
      expect(await incapacidadRepository.count()).toBe(before.incapacidades);
    });
  });

  describe('Filtros y paginación', () => {
    const sembrarMixto = async (colaboradorId: number) => {
      await permisoRepository.save([
        permisoRepository.create({
          colaboradorId,
          fechaInicio: '2026-01-10',
          fechaFin: '2026-01-11',
          motivo: 'Permiso enero',
          observaciones: null,
        }),
        permisoRepository.create({
          colaboradorId,
          fechaInicio: '2026-06-10',
          fechaFin: '2026-06-11',
          motivo: 'Permiso junio',
          observaciones: null,
        }),
      ]);
      await vacacionesRepository.save([
        vacacionesRepository.create({
          colaboradorId,
          tipo: TipoMovimientoVacaciones.ACUMULADO,
          cantidadDias: 5,
          fecha: '2026-03-01',
          observaciones: null,
        }),
        vacacionesRepository.create({
          colaboradorId,
          tipo: TipoMovimientoVacaciones.DISFRUTADO,
          cantidadDias: 2,
          fecha: '2026-08-01',
          observaciones: null,
        }),
      ]);
      await incapacidadRepository.save([
        incapacidadRepository.create({
          colaboradorId,
          fechaInicio: '2026-02-01',
          fechaFin: '2026-02-05',
          observaciones: 'Inc febrero',
        }),
        incapacidadRepository.create({
          colaboradorId,
          fechaInicio: '2026-07-01',
          fechaFin: '2026-07-03',
          observaciones: 'Inc julio',
        }),
        incapacidadRepository.create({
          colaboradorId,
          fechaInicio: '2026-12-01',
          fechaFin: '2026-12-02',
          observaciones: 'Inc diciembre',
        }),
      ]);
    };

    it('filtra solo PERMISO', async () => {
      const colaborador = await crearColaborador();
      await sembrarMixto(colaborador.id);
      const body = (
        await get(colaborador.id, { tipo: 'PERMISO', limit: 50 }).expect(200)
      ).body as HistorialColaboradorResponseDto;
      expect(body.total).toBe(2);
      expect(
        body.historial.every((e) => e.tipo === TipoEventoHistorialRrhh.PERMISO),
      ).toBe(true);
    });

    it('filtra solo VACACION', async () => {
      const colaborador = await crearColaborador();
      await sembrarMixto(colaborador.id);
      const body = (
        await get(colaborador.id, { tipo: 'VACACION', limit: 50 }).expect(200)
      ).body as HistorialColaboradorResponseDto;
      expect(body.total).toBe(2);
      expect(
        body.historial.every(
          (e) => e.tipo === TipoEventoHistorialRrhh.VACACION,
        ),
      ).toBe(true);
      const movimientos = body.historial.map((e) => e.tipoMovimiento).sort();
      expect(movimientos).toEqual([
        TipoMovimientoVacaciones.ACUMULADO,
        TipoMovimientoVacaciones.DISFRUTADO,
      ]);
      expect(body.historial[0].id).not.toBe(body.historial[1].id);
    });

    it('no duplica ni pierde eventos frente a los orígenes', async () => {
      const colaborador = await crearColaborador();
      await sembrarMixto(colaborador.id);
      const body = (await get(colaborador.id, { limit: 100 }).expect(200))
        .body as HistorialColaboradorResponseDto;
      const keys = body.historial.map((e) => `${e.tipo}:${e.id}`);
      expect(new Set(keys).size).toBe(keys.length);
      expect(body.total).toBe(7);
      expect(body.historial).toHaveLength(7);
      expect(
        body.historial.filter(
          (e) => e.tipo === TipoEventoHistorialRrhh.PERMISO,
        ),
      ).toHaveLength(2);
      expect(
        body.historial.filter(
          (e) => e.tipo === TipoEventoHistorialRrhh.VACACION,
        ),
      ).toHaveLength(2);
      expect(
        body.historial.filter(
          (e) => e.tipo === TipoEventoHistorialRrhh.INCAPACIDAD,
        ),
      ).toHaveLength(3);
    });

    it('filtra solo INCAPACIDAD', async () => {
      const colaborador = await crearColaborador();
      await sembrarMixto(colaborador.id);
      const body = (
        await get(colaborador.id, { tipo: 'INCAPACIDAD', limit: 50 }).expect(
          200,
        )
      ).body as HistorialColaboradorResponseDto;
      expect(body.total).toBe(3);
      expect(
        body.historial.every(
          (e) => e.tipo === TipoEventoHistorialRrhh.INCAPACIDAD,
        ),
      ).toBe(true);
    });

    it('filtra por rango de fechas sobre la fecha cronológica', async () => {
      const colaborador = await crearColaborador();
      await sembrarMixto(colaborador.id);
      const body = (
        await get(colaborador.id, {
          fechaDesde: '2026-03-01',
          fechaHasta: '2026-07-31',
          limit: 50,
        }).expect(200)
      ).body as HistorialColaboradorResponseDto;
      expect(body.historial.map((e) => e.fecha).sort()).toEqual([
        '2026-03-01',
        '2026-06-10',
        '2026-07-01',
      ]);
      expect(body.total).toBe(3);
    });

    it('combina tipo + rango de fechas', async () => {
      const colaborador = await crearColaborador();
      await sembrarMixto(colaborador.id);
      const body = (
        await get(colaborador.id, {
          tipo: 'INCAPACIDAD',
          fechaDesde: '2026-01-01',
          fechaHasta: '2026-06-30',
          limit: 50,
        }).expect(200)
      ).body as HistorialColaboradorResponseDto;
      expect(body.total).toBe(1);
      expect(body.historial[0]).toMatchObject({
        tipo: TipoEventoHistorialRrhh.INCAPACIDAD,
        fecha: '2026-02-01',
      });
    });

    it('pagina respetando orden descendente y metadata filtrada', async () => {
      const colaborador = await crearColaborador();
      await sembrarMixto(colaborador.id);
      const page1 = (
        await get(colaborador.id, { page: 1, limit: 3 }).expect(200)
      ).body as HistorialColaboradorResponseDto;
      const page2 = (
        await get(colaborador.id, { page: 2, limit: 3 }).expect(200)
      ).body as HistorialColaboradorResponseDto;

      expect(page1.total).toBe(7);
      expect(page1.totalPages).toBe(3);
      expect(page1.historial).toHaveLength(3);
      expect(page2.historial).toHaveLength(3);
      expect(page1.historial.map((e) => `${e.tipo}:${e.id}`)).not.toEqual(
        page2.historial.map((e) => `${e.tipo}:${e.id}`),
      );
      expect(page1.historial[0].fecha >= page1.historial[2].fecha).toBe(true);
      expect(
        page1.historial[page1.historial.length - 1].fecha >=
          page2.historial[0].fecha,
      ).toBe(true);
    });

    it('conserva filtros en page=2', async () => {
      const colaborador = await crearColaborador();
      await sembrarMixto(colaborador.id);
      const page2 = (
        await get(colaborador.id, {
          tipo: 'INCAPACIDAD',
          fechaDesde: '2026-01-01',
          fechaHasta: '2026-12-31',
          page: 2,
          limit: 2,
        }).expect(200)
      ).body as HistorialColaboradorResponseDto;
      expect(page2.total).toBe(3);
      expect(page2.totalPages).toBe(2);
      expect(page2.historial).toHaveLength(1);
      expect(page2.historial[0].tipo).toBe(TipoEventoHistorialRrhh.INCAPACIDAD);
    });

    it('filtros sin coincidencias: 200 + vacío', async () => {
      const colaborador = await crearColaborador();
      await sembrarMixto(colaborador.id);
      const body = (
        await get(colaborador.id, {
          tipo: 'PERMISO',
          fechaDesde: '2090-01-01',
          fechaHasta: '2090-12-31',
        }).expect(200)
      ).body as HistorialColaboradorResponseDto;
      expect(body.historial).toEqual([]);
      expect(body.total).toBe(0);
      expect(body.totalPages).toBe(0);
    });

    it('rechaza tipo inválido y rango inválido (400)', async () => {
      const colaborador = await crearColaborador();
      expect((await get(colaborador.id, { tipo: 'VACACIONES' })).status).toBe(
        400,
      );
      expect(
        (
          await get(colaborador.id, {
            fechaDesde: '2026-12-31',
            fechaHasta: '2026-01-01',
          })
        ).status,
      ).toBe(400);
      expect(
        (await get(colaborador.id, { fechaDesde: '31-01-2026' })).status,
      ).toBe(400);
      expect((await get(colaborador.id, { page: 0 })).status).toBe(400);
      expect((await get(colaborador.id, { limit: 0 })).status).toBe(400);
    });
  });
});
