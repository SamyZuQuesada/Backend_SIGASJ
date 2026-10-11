import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { TipoMovimientoVacaciones } from '../../common/enums/tipo-movimiento-vacaciones.enum';
import { Colaborador } from './entities/colaborador.entity';
import { MovimientoVacaciones } from './entities/movimiento-vacaciones.entity';
import { crearPermisosTestApp } from './testing/permisos-colaborador.test-app';
import {
  BalanceVacaciones,
  MovimientosVacacionesListado,
} from './vacaciones.service';

const BASE = '/api/v1/rrhh/vacaciones';
const MOVIMIENTOS_URL = `${BASE}/movimientos`;
const balanceUrl = (id: number | string) =>
  `${BASE}/colaboradores/${id}/balance`;
const { ACUMULADO, DISFRUTADO } = TipoMovimientoVacaciones;

type ErrorResponse = { statusCode: number; message: string | string[] };

describe('GET /api/v1/rrhh/vacaciones (balance e historial)', () => {
  let app: INestApplication<App>;
  let movimientoRepository: Repository<MovimientoVacaciones>;
  let signAs: (role: Role) => string;
  let adminToken: string;
  let carlos: Colaborador;
  let ana: Colaborador;
  let sinMovimientos: Colaborador;

  const get = (path: string, token = adminToken) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  const listar = async (query = '') => {
    const res = await get(`${MOVIMIENTOS_URL}${query}`);
    expect(res.status).toBe(200);
    return res.body as MovimientosVacacionesListado;
  };

  const balance = async (id: number) => {
    const res = await get(balanceUrl(id));
    expect(res.status).toBe(200);
    return res.body as BalanceVacaciones;
  };

  beforeAll(async () => {
    const ctx = await crearPermisosTestApp();
    ({ app, signAs } = ctx);
    movimientoRepository = app.get<Repository<MovimientoVacaciones>>(
      getRepositoryToken(MovimientoVacaciones),
    );
    adminToken = signAs(Role.ADMINISTRADORA);

    carlos = await ctx.crearColaborador({
      nombre: 'Carlos',
      apellidos: 'Pérez Mora',
      cedula: '1-7777-0001',
    });
    ana = await ctx.crearColaborador({
      nombre: 'Ana',
      apellidos: 'Solís Vega',
      cedula: '2-7777-0002',
      cargo: 'Administradora',
    });
    sinMovimientos = await ctx.crearColaborador({ cedula: '3-7777-0003' });

    // Carlos: 15 + 5 acumulados, 3 + 5 disfrutados => 20 / 8 / 12 (ejemplo del ticket)
    // Ana: 10 acumulados, 2 disfrutados => 10 / 2 / 8
    const semilla: Array<Partial<MovimientoVacaciones>> = [
      {
        colaboradorId: carlos.id,
        tipo: ACUMULADO,
        cantidadDias: 15,
        fecha: '2025-01-01',
      },
      {
        colaboradorId: carlos.id,
        tipo: DISFRUTADO,
        cantidadDias: 3,
        fecha: '2025-04-14',
      },
      {
        colaboradorId: carlos.id,
        tipo: ACUMULADO,
        cantidadDias: 5,
        fecha: '2026-01-01',
      },
      {
        colaboradorId: carlos.id,
        tipo: DISFRUTADO,
        cantidadDias: 5,
        fecha: '2026-07-06',
      },
      {
        colaboradorId: ana.id,
        tipo: ACUMULADO,
        cantidadDias: 10,
        fecha: '2026-01-01',
      },
      {
        colaboradorId: ana.id,
        tipo: DISFRUTADO,
        cantidadDias: 2,
        fecha: '2026-03-10',
      },
    ];
    for (const datos of semilla) {
      await movimientoRepository.save(movimientoRepository.create(datos));
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Autenticación y permisos', () => {
    it('rechaza el balance sin token (401)', async () => {
      const res = await request(app.getHttpServer()).get(balanceUrl(carlos.id));
      expect(res.status).toBe(401);
    });

    it('rechaza el historial sin token (401)', async () => {
      const res = await request(app.getHttpServer()).get(MOVIMIENTOS_URL);
      expect(res.status).toBe(401);
    });

    it.each([Role.SECRETARIA, Role.FONTANERO, Role.ABONADO, Role.AYUDANTE])(
      'rechaza al rol %s en ambos endpoints (403)',
      async (role) => {
        const token = signAs(role);
        expect((await get(balanceUrl(carlos.id), token)).status).toBe(403);
        expect((await get(MOVIMIENTOS_URL, token)).status).toBe(403);
      },
    );
  });

  describe('Balance por colaborador', () => {
    it('calcula acumulados, disfrutados y disponibles (20 / 8 / 12)', async () => {
      const res = await balance(carlos.id);
      expect(res).toEqual({
        colaboradorId: carlos.id,
        totalMovimientos: 4,
        diasAcumulados: 20,
        diasDisfrutados: 8,
        diasDisponibles: 12,
        colaborador: {
          id: carlos.id,
          nombre: 'Carlos',
          apellidos: 'Pérez Mora',
          cedula: '1-7777-0001',
          cargo: 'Fontanero',
          activo: true,
        },
      });
    });

    it('no mezcla el balance entre colaboradores', async () => {
      const res = await balance(ana.id);
      expect(res).toMatchObject({
        colaboradorId: ana.id,
        totalMovimientos: 2,
        diasAcumulados: 10,
        diasDisfrutados: 2,
        diasDisponibles: 8,
      });
    });

    it('devuelve ceros para un colaborador sin movimientos', async () => {
      const res = await balance(sinMovimientos.id);
      expect(res).toMatchObject({
        totalMovimientos: 0,
        diasAcumulados: 0,
        diasDisfrutados: 0,
        diasDisponibles: 0,
      });
    });

    it('los resultados coinciden con los movimientos almacenados', async () => {
      const guardados = await movimientoRepository.findBy({
        colaboradorId: carlos.id,
      });
      const suma = (tipo: TipoMovimientoVacaciones) =>
        guardados
          .filter((m) => m.tipo === tipo)
          .reduce((acc, m) => acc + m.cantidadDias, 0);

      const res = await balance(carlos.id);
      expect(res.diasAcumulados).toBe(suma(ACUMULADO));
      expect(res.diasDisfrutados).toBe(suma(DISFRUTADO));
      expect(res.diasDisponibles).toBe(suma(ACUMULADO) - suma(DISFRUTADO));
      expect(res.totalMovimientos).toBe(guardados.length);
    });

    it('se actualiza al registrar un nuevo movimiento', async () => {
      const antes = await balance(ana.id);
      const post = await request(app.getHttpServer())
        .post(MOVIMIENTOS_URL)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          colaboradorId: ana.id,
          tipo: DISFRUTADO,
          cantidadDias: 1,
          fecha: '2026-09-01',
        });
      expect(post.status).toBe(201);

      const despues = await balance(ana.id);
      expect(despues.diasDisfrutados).toBe(antes.diasDisfrutados + 1);
      expect(despues.diasDisponibles).toBe(antes.diasDisponibles - 1);
      expect(despues.totalMovimientos).toBe(antes.totalMovimientos + 1);

      // Se revierte para no afectar al resto de la suite.
      await movimientoRepository.delete({
        id: (post.body as MovimientoVacaciones).id,
      });
    });

    it('responde 404 si el colaborador no existe', async () => {
      const res = await get(balanceUrl(99999));
      expect(res.status).toBe(404);
      expect((res.body as ErrorResponse).message).toMatch(/no existe/i);
    });

    it('responde 400 si el id no es numérico', async () => {
      const res = await get(balanceUrl('abc'));
      expect(res.status).toBe(400);
    });
  });

  describe('Historial de movimientos', () => {
    it('lista todos los movimientos ordenados por fecha descendente', async () => {
      const res = await listar();
      expect(res.total).toBe(6);
      expect(res.page).toBe(1);
      expect(res.limit).toBe(10);
      expect(res.totalPages).toBe(1);
      expect(res.data.map((m) => m.fecha)).toEqual([
        '2026-07-06',
        '2026-03-10',
        '2026-01-01',
        '2026-01-01',
        '2025-04-14',
        '2025-01-01',
      ]);
    });

    it('incluye los datos del colaborador en cada movimiento', async () => {
      const res = await listar(`?colaboradorId=${ana.id}&limit=1`);
      expect(res.data[0].colaborador).toMatchObject({
        id: ana.id,
        nombre: 'Ana',
        cedula: '2-7777-0002',
      });
    });

    it('filtra por colaborador', async () => {
      const res = await listar(`?colaboradorId=${carlos.id}`);
      expect(res.total).toBe(4);
      expect(res.data.every((m) => m.colaboradorId === carlos.id)).toBe(true);
    });

    it('devuelve vacío para un colaborador sin movimientos', async () => {
      const res = await listar(`?colaboradorId=${sinMovimientos.id}`);
      expect(res.total).toBe(0);
      expect(res.data).toEqual([]);
      expect(res.totalPages).toBe(0);
    });

    it('filtra por tipo', async () => {
      const acumulados = await listar('?tipo=ACUMULADO');
      expect(acumulados.total).toBe(3);
      expect(acumulados.data.every((m) => m.tipo === ACUMULADO)).toBe(true);

      const disfrutados = await listar('?tipo=disfrutado');
      expect(disfrutados.total).toBe(3);
      expect(disfrutados.data.every((m) => m.tipo === DISFRUTADO)).toBe(true);
    });

    it('filtra por fecha de inicio (inclusiva)', async () => {
      const res = await listar('?fechaInicio=2026-01-01');
      expect(res.total).toBe(4);
      expect(res.data.every((m) => m.fecha >= '2026-01-01')).toBe(true);
    });

    it('filtra por fecha de fin (inclusiva)', async () => {
      const res = await listar('?fechaFin=2025-04-14');
      expect(res.total).toBe(2);
      expect(res.data.map((m) => m.fecha)).toEqual([
        '2025-04-14',
        '2025-01-01',
      ]);
    });

    it('filtra por rango de fechas y colaborador combinados', async () => {
      const res = await listar(
        `?colaboradorId=${carlos.id}&fechaInicio=2025-02-01&fechaFin=2026-01-31`,
      );
      expect(res.total).toBe(2);
      expect(res.data.map((m) => m.fecha)).toEqual([
        '2026-01-01',
        '2025-04-14',
      ]);
    });

    it('la suma del historial filtrado coincide con el balance', async () => {
      const historial = await listar(`?colaboradorId=${carlos.id}&limit=100`);
      const suma = (tipo: TipoMovimientoVacaciones) =>
        historial.data
          .filter((m) => m.tipo === tipo)
          .reduce((acc, m) => acc + m.cantidadDias, 0);
      const res = await balance(carlos.id);

      expect(res.diasAcumulados).toBe(suma(ACUMULADO));
      expect(res.diasDisfrutados).toBe(suma(DISFRUTADO));
      expect(res.totalMovimientos).toBe(historial.total);
    });

    describe('Paginación', () => {
      it('respeta limit y page', async () => {
        const p1 = await listar('?limit=4&page=1');
        expect(p1.data).toHaveLength(4);
        expect(p1.total).toBe(6);
        expect(p1.totalPages).toBe(2);

        const p2 = await listar('?limit=4&page=2');
        expect(p2.data).toHaveLength(2);
        expect(p2.page).toBe(2);

        const ids = [...p1.data, ...p2.data].map((m) => m.id);
        expect(new Set(ids).size).toBe(6);
      });

      it('devuelve una página vacía más allá del total', async () => {
        const res = await listar('?limit=4&page=3');
        expect(res.data).toEqual([]);
        expect(res.total).toBe(6);
      });

      it.each(['?page=0', '?limit=0', '?limit=101', '?page=abc'])(
        'rechaza paginación inválida %s (400)',
        async (query) => {
          const res = await get(`${MOVIMIENTOS_URL}${query}`);
          expect(res.status).toBe(400);
        },
      );
    });

    describe('Parámetros inválidos', () => {
      it.each([
        '?colaboradorId=0',
        '?colaboradorId=abc',
        '?tipo=PENDIENTE',
        '?fechaInicio=01/01/2026',
        '?fechaFin=2026-02-30',
        '?fechaInicio=2026-12-31&fechaFin=2026-01-01',
        '?saldo=1',
      ])('rechaza %s (400)', async (query) => {
        const res = await get(`${MOVIMIENTOS_URL}${query}`);
        expect(res.status).toBe(400);
      });
    });
  });
});
