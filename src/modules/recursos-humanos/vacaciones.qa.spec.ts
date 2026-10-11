import { BadRequestException, INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role, ROLES_SISTEMA } from '../../common/enums/role.enum';
import { TipoMovimientoVacaciones } from '../../common/enums/tipo-movimiento-vacaciones.enum';
import { Colaborador } from './entities/colaborador.entity';
import { MovimientoVacaciones } from './entities/movimiento-vacaciones.entity';
import { SIGNO_MOVIMIENTO_VACACIONES } from './saldo-vacaciones';
import { crearPermisosTestApp } from './testing/permisos-colaborador.test-app';
import {
  BalanceVacaciones,
  MovimientosVacacionesListado,
  VacacionesService,
} from './vacaciones.service';

/**
 * QA 6.3 — Vacaciones: recorrido completo del checklist de pruebas.
 *
 * A diferencia de las suites por endpoint, aquí un mismo colaborador (Juan)
 * atraviesa todo el flujo en orden: acumular → disfrutar → confirmar saldo →
 * intentar sobregirar → valores inválidos → historial → filtros → permisos →
 * trazabilidad. Los pasos comparten estado a propósito: cada uno verifica
 * que el anterior dejó la base exactamente como debía.
 */

const BASE = '/api/v1/rrhh/vacaciones';
const MOVIMIENTOS_URL = `${BASE}/movimientos`;
const balanceUrl = (id: number | string) =>
  `${BASE}/colaboradores/${id}/balance`;
const { ACUMULADO, DISFRUTADO } = TipoMovimientoVacaciones;

type ErrorResponse = { statusCode: number; message: string | string[] };
type MovimientoResponse = Omit<MovimientoVacaciones, 'createdAt'> & {
  createdAt: string;
};

const errorDe = (res: request.Response): ErrorResponse =>
  res.body as ErrorResponse;
const movimientoDe = (res: request.Response): MovimientoResponse =>
  res.body as MovimientoResponse;
const mensajeDe = (res: request.Response): string => {
  const { message } = errorDe(res);
  return Array.isArray(message) ? message.join(' | ') : message;
};

const ROLES_SIN_ACCESO = ROLES_SISTEMA.filter(
  (role) => role !== Role.ADMINISTRADORA,
);

describe('QA Vacaciones — checklist completo (6.3)', () => {
  let app: INestApplication<App>;
  let movimientoRepository: Repository<MovimientoVacaciones>;
  let colaboradorRepository: Repository<Colaborador>;
  let vacacionesService: VacacionesService;
  let signAs: (role: Role) => string;
  let crearColaborador: (extra?: Partial<Colaborador>) => Promise<Colaborador>;
  let adminToken: string;

  let juan: Colaborador;
  let maria: Colaborador;
  /** Ids de los movimientos de Juan, en el orden en que se registraron. */
  const idsJuan: number[] = [];

  const post = (data: Record<string, unknown>, token = adminToken) =>
    request(app.getHttpServer())
      .post(MOVIMIENTOS_URL)
      .set('Authorization', `Bearer ${token}`)
      .send(data);

  const get = (path: string, token = adminToken) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  const balance = async (id: number): Promise<BalanceVacaciones> => {
    const res = await get(balanceUrl(id));
    expect(res.status).toBe(200);
    return res.body as BalanceVacaciones;
  };

  const listar = async (query = ''): Promise<MovimientosVacacionesListado> => {
    const res = await get(`${MOVIMIENTOS_URL}${query}`);
    expect(res.status).toBe(200);
    return res.body as MovimientosVacacionesListado;
  };

  const movimientoJuan = (extra: Record<string, unknown>) => ({
    colaboradorId: juan.id,
    tipo: ACUMULADO,
    cantidadDias: 1,
    fecha: '2026-01-01',
    ...extra,
  });

  /** Saldo calculado "a mano" desde las filas guardadas, sin pasar por el servicio. */
  const saldoDesdeFilas = async (colaboradorId: number) => {
    const filas = await movimientoRepository.findBy({ colaboradorId });
    const suma = (tipo: TipoMovimientoVacaciones) =>
      filas
        .filter((m) => m.tipo === tipo)
        .reduce((acc, m) => acc + m.cantidadDias, 0);
    return {
      total: filas.length,
      acumulados: suma(ACUMULADO),
      disfrutados: suma(DISFRUTADO),
      disponibles: suma(ACUMULADO) - suma(DISFRUTADO),
    };
  };

  beforeAll(async () => {
    const ctx = await crearPermisosTestApp();
    ({ app, signAs, crearColaborador } = ctx);
    movimientoRepository = app.get<Repository<MovimientoVacaciones>>(
      getRepositoryToken(MovimientoVacaciones),
    );
    colaboradorRepository = ctx.colaboradorRepository;
    vacacionesService = app.get(VacacionesService);
    adminToken = signAs(Role.ADMINISTRADORA);

    juan = await crearColaborador({
      nombre: 'Juan',
      apellidos: 'Pérez',
      cedula: '1-6300-0001',
    });
    maria = await crearColaborador({
      nombre: 'María',
      apellidos: 'Rojas',
      cedula: '1-6300-0002',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Registrar días acumulados', () => {
    it('parte de un saldo en cero sin movimientos', async () => {
      expect(await balance(juan.id)).toMatchObject({
        totalMovimientos: 0,
        diasAcumulados: 0,
        diasDisfrutados: 0,
        diasDisponibles: 0,
      });
    });

    it('registra 15 días acumulados (periodo 2025)', async () => {
      const res = await post(
        movimientoJuan({
          cantidadDias: 15,
          fecha: '2025-01-01',
          observaciones: 'Periodo 2025',
        }),
      );
      expect(res.status).toBe(201);
      const creado = movimientoDe(res);
      expect(creado).toMatchObject({
        colaboradorId: juan.id,
        tipo: ACUMULADO,
        cantidadDias: 15,
        fecha: '2025-01-01',
        observaciones: 'Periodo 2025',
      });
      idsJuan.push(creado.id);

      expect(await balance(juan.id)).toMatchObject({
        totalMovimientos: 1,
        diasAcumulados: 15,
        diasDisfrutados: 0,
        diasDisponibles: 15,
      });
    });

    it('registra 5 días acumulados más (periodo 2026) y el saldo suma 20', async () => {
      const res = await post(
        movimientoJuan({
          cantidadDias: 5,
          fecha: '2026-01-01',
          observaciones: 'Periodo 2026',
        }),
      );
      expect(res.status).toBe(201);
      idsJuan.push(movimientoDe(res).id);

      expect(await balance(juan.id)).toMatchObject({
        totalMovimientos: 2,
        diasAcumulados: 20,
        diasDisfrutados: 0,
        diasDisponibles: 20,
      });
    });
  });

  describe('2. Registrar días disfrutados', () => {
    it('registra 3 días disfrutados (Semana Santa 2025)', async () => {
      const res = await post(
        movimientoJuan({
          tipo: DISFRUTADO,
          cantidadDias: 3,
          fecha: '2025-04-14',
          observaciones: 'Semana Santa',
        }),
      );
      expect(res.status).toBe(201);
      expect(movimientoDe(res)).toMatchObject({
        tipo: DISFRUTADO,
        cantidadDias: 3,
        fecha: '2025-04-14',
      });
      idsJuan.push(movimientoDe(res).id);

      expect(await balance(juan.id)).toMatchObject({
        diasAcumulados: 20,
        diasDisfrutados: 3,
        diasDisponibles: 17,
      });
    });

    it('registra 5 días disfrutados más (julio 2026)', async () => {
      const res = await post(
        movimientoJuan({
          tipo: DISFRUTADO,
          cantidadDias: 5,
          fecha: '2026-07-06',
        }),
      );
      expect(res.status).toBe(201);
      idsJuan.push(movimientoDe(res).id);
    });
  });

  describe('3. Confirmar saldo', () => {
    it('el balance del API es Acumulados 20 / Disfrutados 8 / Disponibles 12', async () => {
      const res = await balance(juan.id);
      expect(res).toEqual({
        colaboradorId: juan.id,
        totalMovimientos: 4,
        diasAcumulados: 20,
        diasDisfrutados: 8,
        diasDisponibles: 12,
        colaborador: {
          id: juan.id,
          nombre: 'Juan',
          apellidos: 'Pérez',
          cedula: '1-6300-0001',
          cargo: 'Fontanero',
          activo: true,
        },
      });
    });

    it('coincide con la suma manual de las filas almacenadas', async () => {
      const filas = await saldoDesdeFilas(juan.id);
      const res = await balance(juan.id);
      expect(filas).toEqual({
        total: 4,
        acumulados: 20,
        disfrutados: 8,
        disponibles: 12,
      });
      expect(res.totalMovimientos).toBe(filas.total);
      expect(res.diasAcumulados).toBe(filas.acumulados);
      expect(res.diasDisfrutados).toBe(filas.disfrutados);
      expect(res.diasDisponibles).toBe(filas.disponibles);
    });

    it('coincide con el saldo que usa el servicio al validar un disfrute', async () => {
      const saldo = await vacacionesService.calcularSaldo(juan.id);
      expect(saldo).toEqual({
        colaboradorId: juan.id,
        totalMovimientos: 4,
        diasAcumulados: 20,
        diasDisfrutados: 8,
        diasDisponibles: 12,
      });
    });

    it('disponibles = acumulados - disfrutados, y ningún campo es negativo', async () => {
      const res = await balance(juan.id);
      expect(res.diasDisponibles).toBe(
        res.diasAcumulados - res.diasDisfrutados,
      );
      expect(res.diasAcumulados).toBeGreaterThanOrEqual(0);
      expect(res.diasDisfrutados).toBeGreaterThanOrEqual(0);
      expect(res.diasDisponibles).toBeGreaterThanOrEqual(0);
    });
  });

  describe('4. Intentar disfrutar más días de los disponibles', () => {
    it('rechaza 13 días cuando solo hay 12 disponibles (400) y explica el saldo', async () => {
      const res = await post(
        movimientoJuan({ tipo: DISFRUTADO, cantidadDias: 13 }),
      );
      expect(res.status).toBe(400);
      expect(mensajeDe(res)).toMatch(/saldo suficiente/i);
      expect(mensajeDe(res)).toMatch(/dispone de 12/);
      expect(mensajeDe(res)).toMatch(/disfrutar 13/);
    });

    it('rechaza una cantidad muy superior al saldo (400)', async () => {
      const res = await post(
        movimientoJuan({ tipo: DISFRUTADO, cantidadDias: 1000 }),
      );
      expect(res.status).toBe(400);
    });

    it('el rechazo no deja rastro: mismo saldo y mismos 4 movimientos', async () => {
      expect(await balance(juan.id)).toMatchObject({
        totalMovimientos: 4,
        diasDisponibles: 12,
      });
      expect(await saldoDesdeFilas(juan.id)).toMatchObject({
        total: 4,
        disponibles: 12,
      });
    });

    it('permite agotar el saldo exacto (María: 7 acumulados, 7 disfrutados)', async () => {
      expect(
        (
          await post({
            colaboradorId: maria.id,
            tipo: ACUMULADO,
            cantidadDias: 7,
            fecha: '2026-01-01',
          })
        ).status,
      ).toBe(201);

      const agotar = await post({
        colaboradorId: maria.id,
        tipo: DISFRUTADO,
        cantidadDias: 7,
        fecha: '2026-02-01',
      });
      expect(agotar.status).toBe(201);
      expect(await balance(maria.id)).toMatchObject({
        diasAcumulados: 7,
        diasDisfrutados: 7,
        diasDisponibles: 0,
      });
    });

    it('con saldo cero rechaza disfrutar incluso 1 día (400)', async () => {
      const res = await post({
        colaboradorId: maria.id,
        tipo: DISFRUTADO,
        cantidadDias: 1,
        fecha: '2026-02-02',
      });
      expect(res.status).toBe(400);
      expect(mensajeDe(res)).toMatch(/dispone de 0/);
      expect((await balance(maria.id)).diasDisponibles).toBe(0);
    });

    it('un disfrute no puede apoyarse en el saldo de otro colaborador', async () => {
      // Juan tiene 12 disponibles; María 0. Disfrutar a nombre de María falla.
      const res = await post({
        colaboradorId: maria.id,
        tipo: DISFRUTADO,
        cantidadDias: 5,
        fecha: '2026-02-03',
      });
      expect(res.status).toBe(400);
      expect((await balance(juan.id)).diasDisponibles).toBe(12);
      expect((await balance(maria.id)).diasDisponibles).toBe(0);
    });

    it('la validación de saldo también actúa al llamar directo al servicio', async () => {
      await expect(
        vacacionesService.registrarMovimiento({
          colaboradorId: maria.id,
          tipo: DISFRUTADO,
          cantidadDias: 1,
          fecha: '2026-02-04',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('5. Probar cantidad negativa', () => {
    it.each([-1, -5, -100, '-3'])(
      'rechaza cantidadDias = %p como ACUMULADO (400)',
      async (cantidadDias) => {
        const res = await post(movimientoJuan({ cantidadDias }));
        expect(res.status).toBe(400);
        expect(mensajeDe(res)).toMatch(/mayor a cero/i);
      },
    );

    it.each([-1, -5, '-3'])(
      'rechaza cantidadDias = %p como DISFRUTADO (400)',
      async (cantidadDias) => {
        const res = await post(
          movimientoJuan({ tipo: DISFRUTADO, cantidadDias }),
        );
        expect(res.status).toBe(400);
        expect(mensajeDe(res)).toMatch(/mayor a cero/i);
      },
    );

    it('un negativo no "devuelve" días: el saldo no cambia', async () => {
      // Si -5 disfrutados se aceptara, los disponibles subirían a 17.
      await post(movimientoJuan({ tipo: DISFRUTADO, cantidadDias: -5 }));
      expect(await balance(juan.id)).toMatchObject({
        totalMovimientos: 4,
        diasDisponibles: 12,
      });
    });

    it('el servicio rechaza negativos aunque se salte el DTO', async () => {
      await expect(
        vacacionesService.registrarMovimiento({
          colaboradorId: juan.id,
          tipo: ACUMULADO,
          cantidadDias: -1,
          fecha: '2026-01-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('la entidad rechaza negativos aunque se salte el servicio', async () => {
      await expect(
        movimientoRepository.save(
          movimientoRepository.create({
            colaboradorId: juan.id,
            tipo: ACUMULADO,
            cantidadDias: -1,
            fecha: '2026-01-01',
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect((await saldoDesdeFilas(juan.id)).total).toBe(4);
    });
  });

  describe('6. Probar cero', () => {
    it.each([0, '0', -0])(
      'rechaza cantidadDias = %p (400)',
      async (cantidadDias) => {
        const res = await post(movimientoJuan({ cantidadDias }));
        expect(res.status).toBe(400);
        expect(mensajeDe(res)).toMatch(/mayor a cero/i);
      },
    );

    it('rechaza cero también como DISFRUTADO (no cuenta como "movimiento vacío")', async () => {
      const res = await post(
        movimientoJuan({ tipo: DISFRUTADO, cantidadDias: 0 }),
      );
      expect(res.status).toBe(400);
      expect(await balance(juan.id)).toMatchObject({ totalMovimientos: 4 });
    });

    it.each([0.5, 1.5, '2.5'])(
      'rechaza fracciones de día (%p) (400)',
      async (cantidadDias) => {
        const res = await post(movimientoJuan({ cantidadDias }));
        expect(res.status).toBe(400);
      },
    );

    it('el servicio y la entidad rechazan cero aunque se salte el DTO', async () => {
      await expect(
        vacacionesService.registrarMovimiento({
          colaboradorId: juan.id,
          tipo: ACUMULADO,
          cantidadDias: 0,
          fecha: '2026-01-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        movimientoRepository.save(
          movimientoRepository.create({
            colaboradorId: juan.id,
            tipo: DISFRUTADO,
            cantidadDias: 0,
            fecha: '2026-01-01',
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect((await saldoDesdeFilas(juan.id)).total).toBe(4);
    });
  });

  describe('7. Consultar historial', () => {
    it('devuelve los 4 movimientos de Juan del más reciente al más antiguo', async () => {
      const res = await listar(`?colaboradorId=${juan.id}`);
      expect(res.total).toBe(4);
      expect(res.page).toBe(1);
      expect(res.totalPages).toBe(1);
      expect(res.data.map((m) => [m.fecha, m.tipo, m.cantidadDias])).toEqual([
        ['2026-07-06', DISFRUTADO, 5],
        ['2026-01-01', ACUMULADO, 5],
        ['2025-04-14', DISFRUTADO, 3],
        ['2025-01-01', ACUMULADO, 15],
      ]);
    });

    it('cada fila trae lo necesario para la pantalla: Fecha | Tipo | Días (+/-) | Observaciones', async () => {
      const res = await listar(`?colaboradorId=${juan.id}`);
      for (const m of res.data) {
        expect(m.id).toEqual(expect.any(Number));
        expect(m.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect([ACUMULADO, DISFRUTADO]).toContain(m.tipo);
        expect(m.cantidadDias).toBeGreaterThan(0);
        expect(m.createdAt).toBeDefined();
        expect(m.colaborador).toMatchObject({ id: juan.id, nombre: 'Juan' });
      }
      const conObs = res.data.find((m) => m.fecha === '2025-01-01');
      const sinObs = res.data.find((m) => m.fecha === '2026-07-06');
      expect(conObs?.observaciones).toBe('Periodo 2025');
      expect(sinObs?.observaciones).toBeNull();
    });

    it('la suma con signo del historial reproduce los 12 días disponibles', async () => {
      const res = await listar(`?colaboradorId=${juan.id}&limit=100`);
      const conSigno = res.data.reduce(
        (acc, m) => acc + SIGNO_MOVIMIENTO_VACACIONES[m.tipo] * m.cantidadDias,
        0,
      );
      expect(conSigno).toBe(12);
      expect(conSigno).toBe((await balance(juan.id)).diasDisponibles);
    });

    it('se pagina sin perder ni repetir movimientos', async () => {
      const p1 = await listar(`?colaboradorId=${juan.id}&limit=3&page=1`);
      const p2 = await listar(`?colaboradorId=${juan.id}&limit=3&page=2`);
      expect(p1.data).toHaveLength(3);
      expect(p1.totalPages).toBe(2);
      expect(p2.data).toHaveLength(1);
      const ids = [...p1.data, ...p2.data].map((m) => m.id);
      expect(new Set(ids).size).toBe(4);
      expect(ids.sort()).toEqual([...idsJuan].sort());
    });

    it('el historial global incluye a todos los colaboradores (Juan 4 + María 2)', async () => {
      const res = await listar('?limit=100');
      expect(res.total).toBe(6);
      const porColaborador = res.data.reduce<Record<number, number>>(
        (acc, m) => ({
          ...acc,
          [m.colaboradorId]: (acc[m.colaboradorId] ?? 0) + 1,
        }),
        {},
      );
      expect(porColaborador[juan.id]).toBe(4);
      expect(porColaborador[maria.id]).toBe(2);
    });
  });

  describe('8. Filtrar movimientos', () => {
    it('por colaborador: no mezcla a Juan con María', async () => {
      const deJuan = await listar(`?colaboradorId=${juan.id}`);
      const deMaria = await listar(`?colaboradorId=${maria.id}`);
      expect(deJuan.data.every((m) => m.colaboradorId === juan.id)).toBe(true);
      expect(deMaria.data.every((m) => m.colaboradorId === maria.id)).toBe(
        true,
      );
      expect(deJuan.total + deMaria.total).toBe(6);
    });

    it('por tipo ACUMULADO (acepta mayúsculas y minúsculas)', async () => {
      const upper = await listar(`?colaboradorId=${juan.id}&tipo=ACUMULADO`);
      const lower = await listar(`?colaboradorId=${juan.id}&tipo=acumulado`);
      expect(upper.total).toBe(2);
      expect(upper.data.map((m) => m.cantidadDias)).toEqual([5, 15]);
      expect(lower.total).toBe(2);
    });

    it('por tipo DISFRUTADO', async () => {
      const res = await listar(`?colaboradorId=${juan.id}&tipo=DISFRUTADO`);
      expect(res.total).toBe(2);
      expect(res.data.map((m) => m.cantidadDias)).toEqual([5, 3]);
    });

    it('por fecha de inicio (inclusiva)', async () => {
      const res = await listar(
        `?colaboradorId=${juan.id}&fechaInicio=2026-01-01`,
      );
      expect(res.data.map((m) => m.fecha)).toEqual([
        '2026-07-06',
        '2026-01-01',
      ]);
    });

    it('por fecha de fin (inclusiva)', async () => {
      const res = await listar(`?colaboradorId=${juan.id}&fechaFin=2025-04-14`);
      expect(res.data.map((m) => m.fecha)).toEqual([
        '2025-04-14',
        '2025-01-01',
      ]);
    });

    it('por rango de fechas: solo el año 2025', async () => {
      const res = await listar(
        `?colaboradorId=${juan.id}&fechaInicio=2025-01-01&fechaFin=2025-12-31`,
      );
      expect(res.total).toBe(2);
      expect(res.data.map((m) => m.fecha)).toEqual([
        '2025-04-14',
        '2025-01-01',
      ]);
    });

    it('combinando colaborador + tipo + rango', async () => {
      const res = await listar(
        `?colaboradorId=${juan.id}&tipo=DISFRUTADO&fechaInicio=2026-01-01&fechaFin=2026-12-31`,
      );
      expect(res.total).toBe(1);
      expect(res.data[0]).toMatchObject({
        tipo: DISFRUTADO,
        cantidadDias: 5,
        fecha: '2026-07-06',
      });
    });

    it('un filtro sin coincidencias devuelve vacío, no error', async () => {
      const res = await listar(
        `?colaboradorId=${juan.id}&fechaInicio=2030-01-01`,
      );
      expect(res.total).toBe(0);
      expect(res.data).toEqual([]);
      expect(res.totalPages).toBe(0);
    });

    it('el saldo filtrado por tipo coincide con el balance', async () => {
      const acumulados = await listar(
        `?colaboradorId=${juan.id}&tipo=ACUMULADO&limit=100`,
      );
      const disfrutados = await listar(
        `?colaboradorId=${juan.id}&tipo=DISFRUTADO&limit=100`,
      );
      const suma = (l: MovimientosVacacionesListado) =>
        l.data.reduce((acc, m) => acc + m.cantidadDias, 0);
      const res = await balance(juan.id);
      expect(suma(acumulados)).toBe(res.diasAcumulados);
      expect(suma(disfrutados)).toBe(res.diasDisfrutados);
    });

    it.each([
      '?tipo=PENDIENTE',
      '?colaboradorId=abc',
      '?fechaInicio=2026-02-30',
      '?fechaInicio=2026-12-31&fechaFin=2026-01-01',
    ])('rechaza filtros inválidos %s (400)', async (query) => {
      const res = await get(`${MOVIMIENTOS_URL}${query}`);
      expect(res.status).toBe(400);
    });
  });

  describe('9. Probar permisos', () => {
    const endpoints = (): Array<() => request.Test> => [
      () => post(movimientoJuan({}), 'token-invalido'),
      () => get(MOVIMIENTOS_URL, 'token-invalido'),
      () => get(balanceUrl(juan.id), 'token-invalido'),
    ];

    it('sin token: 401 en los tres endpoints', async () => {
      const server = app.getHttpServer();
      expect(
        (await request(server).post(MOVIMIENTOS_URL).send(movimientoJuan({})))
          .status,
      ).toBe(401);
      expect((await request(server).get(MOVIMIENTOS_URL)).status).toBe(401);
      expect((await request(server).get(balanceUrl(juan.id))).status).toBe(401);
    });

    it('token inválido: 401 en los tres endpoints', async () => {
      for (const llamar of endpoints()) {
        expect((await llamar()).status).toBe(401);
      }
    });

    it.each(ROLES_SIN_ACCESO)(
      'rol %s: 403 en los tres endpoints',
      async (role) => {
        const token = signAs(role);
        expect((await post(movimientoJuan({}), token)).status).toBe(403);
        expect((await get(MOVIMIENTOS_URL, token)).status).toBe(403);
        expect((await get(balanceUrl(juan.id), token)).status).toBe(403);
      },
    );

    it('un rol sin acceso no logra registrar ni alterar el saldo', async () => {
      const antes = await saldoDesdeFilas(juan.id);
      for (const role of ROLES_SIN_ACCESO) {
        await post(
          movimientoJuan({ cantidadDias: 50, fecha: '2026-09-01' }),
          signAs(role),
        );
      }
      expect(await saldoDesdeFilas(juan.id)).toEqual(antes);
      expect((await balance(juan.id)).diasDisponibles).toBe(12);
    });

    it('la Administradora sí accede a los tres endpoints', async () => {
      expect((await get(MOVIMIENTOS_URL)).status).toBe(200);
      expect((await get(balanceUrl(juan.id))).status).toBe(200);
      const res = await post({
        colaboradorId: maria.id,
        tipo: ACUMULADO,
        cantidadDias: 1,
        fecha: '2026-09-01',
      });
      expect(res.status).toBe(201);
      // Se revierte para no alterar el resto del escenario.
      await movimientoRepository.delete({ id: movimientoDe(res).id });
    });
  });

  describe('10. Trazabilidad', () => {
    it('el saldo no se guarda en ninguna columna: siempre se deriva del historial', () => {
      const columnas = colaboradorRepository.metadata.columns.map((c) =>
        c.propertyName.toLowerCase(),
      );
      expect(columnas.some((c) => /saldo|dias|vacacion/.test(c))).toBe(false);
    });

    it('cada movimiento conserva quién, qué, cuánto, cuándo y por qué', async () => {
      const filas = await movimientoRepository.find({
        where: { colaboradorId: juan.id },
        order: { id: 'ASC' },
      });
      expect(filas.map((m) => m.id)).toEqual(idsJuan);
      expect(
        filas.map((m) => ({
          tipo: m.tipo,
          cantidadDias: m.cantidadDias,
          fecha: m.fecha,
          observaciones: m.observaciones,
        })),
      ).toEqual([
        {
          tipo: ACUMULADO,
          cantidadDias: 15,
          fecha: '2025-01-01',
          observaciones: 'Periodo 2025',
        },
        {
          tipo: ACUMULADO,
          cantidadDias: 5,
          fecha: '2026-01-01',
          observaciones: 'Periodo 2026',
        },
        {
          tipo: DISFRUTADO,
          cantidadDias: 3,
          fecha: '2025-04-14',
          observaciones: 'Semana Santa',
        },
        {
          tipo: DISFRUTADO,
          cantidadDias: 5,
          fecha: '2026-07-06',
          observaciones: null,
        },
      ]);
      for (const m of filas) {
        expect(m.createdAt).toBeInstanceOf(Date);
      }
    });

    it('los movimientos son inmutables por API: no existe PUT/PATCH/DELETE', async () => {
      const id = idsJuan[0];
      const server = app.getHttpServer();
      const auth = `Bearer ${adminToken}`;
      expect(
        (
          await request(server)
            .put(`${MOVIMIENTOS_URL}/${id}`)
            .set('Authorization', auth)
            .send({ cantidadDias: 99 })
        ).status,
      ).toBe(404);
      expect(
        (
          await request(server)
            .patch(`${MOVIMIENTOS_URL}/${id}`)
            .set('Authorization', auth)
            .send({ cantidadDias: 99 })
        ).status,
      ).toBe(404);
      expect(
        (
          await request(server)
            .delete(`${MOVIMIENTOS_URL}/${id}`)
            .set('Authorization', auth)
        ).status,
      ).toBe(404);
      expect(await saldoDesdeFilas(juan.id)).toMatchObject({
        total: 4,
        disponibles: 12,
      });
    });

    it('una corrección se hace con un nuevo movimiento, no editando el anterior', async () => {
      // Se registraron 5 disfrutados en julio, pero fueron 4: se compensa con +1.
      const res = await post(
        movimientoJuan({
          cantidadDias: 1,
          fecha: '2026-07-07',
          observaciones: 'Ajuste: julio fueron 4 días, no 5',
        }),
      );
      expect(res.status).toBe(201);
      const b = await balance(juan.id);
      expect(b).toMatchObject({
        totalMovimientos: 5,
        diasAcumulados: 21,
        diasDisfrutados: 8,
        diasDisponibles: 13,
      });
      // El movimiento original sigue intacto en el historial.
      const original = await movimientoRepository.findOneBy({ id: idsJuan[3] });
      expect(original).toMatchObject({ tipo: DISFRUTADO, cantidadDias: 5 });
    });

    it('historial y balance se mantienen consistentes tras todo el recorrido', async () => {
      for (const colaborador of [juan, maria]) {
        const filas = await saldoDesdeFilas(colaborador.id);
        const b = await balance(colaborador.id);
        const historial = await listar(
          `?colaboradorId=${colaborador.id}&limit=100`,
        );
        expect(b.totalMovimientos).toBe(filas.total);
        expect(historial.total).toBe(filas.total);
        expect(b.diasAcumulados).toBe(filas.acumulados);
        expect(b.diasDisfrutados).toBe(filas.disfrutados);
        expect(b.diasDisponibles).toBe(filas.disponibles);
        expect(b.diasDisponibles).toBeGreaterThanOrEqual(0);
      }
    });

    it('ningún movimiento almacenado tiene cantidad <= 0 ni tipo fuera del catálogo', async () => {
      const todas = await movimientoRepository.find();
      expect(todas.length).toBeGreaterThan(0);
      expect(todas.every((m) => m.cantidadDias > 0)).toBe(true);
      expect(todas.every((m) => [ACUMULADO, DISFRUTADO].includes(m.tipo))).toBe(
        true,
      );
    });
  });
});
