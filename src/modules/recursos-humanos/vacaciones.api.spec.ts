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
import { VacacionesService } from './vacaciones.service';

const URL = '/api/v1/rrhh/vacaciones/movimientos';
const { ACUMULADO, DISFRUTADO } = TipoMovimientoVacaciones;

type MovimientoResponse = Omit<MovimientoVacaciones, 'createdAt'> & {
  createdAt: string;
};
type ErrorResponse = { statusCode: number; message: string | string[] };

const movimientoDe = (res: request.Response): MovimientoResponse =>
  res.body as MovimientoResponse;
const errorDe = (res: request.Response): ErrorResponse =>
  res.body as ErrorResponse;

describe('POST /api/v1/rrhh/vacaciones/movimientos', () => {
  let app: INestApplication<App>;
  let movimientoRepository: Repository<MovimientoVacaciones>;
  let vacacionesService: VacacionesService;
  let adminToken: string;
  let signAs: (role: Role) => string;
  let crearColaborador: (extra?: Partial<Colaborador>) => Promise<Colaborador>;
  let colaborador: Colaborador;

  const body = (extra: Record<string, unknown> = {}) => ({
    colaboradorId: colaborador.id,
    tipo: ACUMULADO,
    cantidadDias: 12,
    fecha: '2026-01-01',
    ...extra,
  });

  const post = (data: Record<string, unknown>, token = adminToken) =>
    request(app.getHttpServer())
      .post(URL)
      .set('Authorization', `Bearer ${token}`)
      .send(data);

  const saldoDe = async (id = colaborador.id) =>
    (await vacacionesService.calcularSaldo(id)).diasDisponibles;

  beforeAll(async () => {
    const ctx = await crearPermisosTestApp();
    ({ app, signAs, crearColaborador } = ctx);
    movimientoRepository = app.get<Repository<MovimientoVacaciones>>(
      getRepositoryToken(MovimientoVacaciones),
    );
    vacacionesService = app.get(VacacionesService);
    adminToken = signAs(Role.ADMINISTRADORA);
    colaborador = await crearColaborador({ cedula: '1-5555-0001' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await movimientoRepository.clear();
  });

  describe('Permisos administrativos', () => {
    it('rechaza sin token (401)', async () => {
      const res = await request(app.getHttpServer()).post(URL).send(body());
      expect(res.status).toBe(401);
      expect(await movimientoRepository.count()).toBe(0);
    });

    it('rechaza token inválido (401)', async () => {
      const res = await post(body(), 'token-invalido');
      expect(res.status).toBe(401);
    });

    it.each([Role.SECRETARIA, Role.FONTANERO, Role.ABONADO, Role.AYUDANTE])(
      'rechaza al rol %s (403)',
      async (role) => {
        const res = await post(body(), signAs(role));
        expect(res.status).toBe(403);
        expect(await movimientoRepository.count()).toBe(0);
      },
    );
  });

  describe('Registro de acumulados', () => {
    it('registra días acumulados y los asocia al colaborador', async () => {
      const res = await post(body({ observaciones: '  Periodo 2025-2026  ' }));

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        colaboradorId: colaborador.id,
        tipo: ACUMULADO,
        cantidadDias: 12,
        fecha: '2026-01-01',
        observaciones: 'Periodo 2025-2026',
      });
      const creado = movimientoDe(res);
      expect(creado.colaborador).toMatchObject({
        id: colaborador.id,
        cedula: '1-5555-0001',
      });
      expect(creado.id).toEqual(expect.any(Number));
      expect(creado.createdAt).toBeDefined();
      expect(await saldoDe()).toBe(12);
    });

    it('acepta observaciones omitidas y el tipo en minúsculas', async () => {
      const res = await post(body({ tipo: 'acumulado', cantidadDias: 1 }));
      expect(res.status).toBe(201);
      expect(movimientoDe(res).tipo).toBe(ACUMULADO);
      expect(movimientoDe(res).observaciones).toBeNull();
    });
  });

  describe('Registro de disfrutados', () => {
    it('registra días disfrutados cuando hay saldo', async () => {
      await post(body({ cantidadDias: 10 }));

      const res = await post(
        body({
          tipo: DISFRUTADO,
          cantidadDias: 3,
          fecha: '2026-03-10',
          observaciones: 'Semana Santa',
        }),
      );

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        colaboradorId: colaborador.id,
        tipo: DISFRUTADO,
        cantidadDias: 3,
        fecha: '2026-03-10',
        observaciones: 'Semana Santa',
      });
      expect(await saldoDe()).toBe(7);
      expect(await movimientoRepository.count()).toBe(2);
    });
  });

  describe('El saldo nunca queda negativo', () => {
    it('rechaza disfrutar sin saldo (400)', async () => {
      const res = await post(body({ tipo: DISFRUTADO, cantidadDias: 1 }));
      expect(res.status).toBe(400);
      expect(errorDe(res).message).toMatch(/saldo suficiente/i);
      expect(await movimientoRepository.count()).toBe(0);
      expect(await saldoDe()).toBe(0);
    });

    it('rechaza disfrutar más días que el saldo (400) y conserva el saldo', async () => {
      await post(body({ cantidadDias: 5 }));

      const res = await post(body({ tipo: DISFRUTADO, cantidadDias: 6 }));
      expect(res.status).toBe(400);
      expect(errorDe(res).message).toMatch(/dispone de 5/i);
      expect(await saldoDe()).toBe(5);
      expect(await movimientoRepository.count()).toBe(1);
    });

    it('permite agotar el saldo exacto y luego bloquea el siguiente disfrute', async () => {
      await post(body({ cantidadDias: 5 }));

      const agotar = await post(body({ tipo: DISFRUTADO, cantidadDias: 5 }));
      expect(agotar.status).toBe(201);
      expect(await saldoDe()).toBe(0);

      const extra = await post(body({ tipo: DISFRUTADO, cantidadDias: 1 }));
      expect(extra.status).toBe(400);
      expect(await saldoDe()).toBe(0);
    });

    it('no usa el saldo de otro colaborador', async () => {
      const otro = await crearColaborador({ cedula: '1-5555-0002' });
      await post(body({ colaboradorId: otro.id, cantidadDias: 10 }));

      const res = await post(body({ tipo: DISFRUTADO, cantidadDias: 1 }));
      expect(res.status).toBe(400);
      expect(await saldoDe(otro.id)).toBe(10);
      expect(await saldoDe()).toBe(0);
    });
  });

  describe('Valores inválidos', () => {
    it.each(['colaboradorId', 'tipo', 'cantidadDias', 'fecha'])(
      'rechaza si falta %s (400)',
      async (campo) => {
        const data = body();
        delete data[campo];
        const res = await post(data);
        expect(res.status).toBe(400);
        expect(await movimientoRepository.count()).toBe(0);
      },
    );

    it.each(['PENDIENTE', 'ENTRADA', '', 1])(
      'rechaza tipo fuera del catálogo (%p) (400)',
      async (tipo) => {
        const res = await post(body({ tipo }));
        expect(res.status).toBe(400);
        expect(JSON.stringify(res.body)).toMatch(/ACUMULADO o DISFRUTADO/);
      },
    );

    it.each([0, -3, 1.5, '1.5', 'cinco', null])(
      'rechaza cantidadDias inválida (%p) (400)',
      async (cantidadDias) => {
        const res = await post(body({ cantidadDias }));
        expect(res.status).toBe(400);
        expect(await movimientoRepository.count()).toBe(0);
      },
    );

    it('convierte cantidadDias numérica enviada como texto ("5" -> 5)', async () => {
      // El ValidationPipe global usa enableImplicitConversion.
      const res = await post(body({ cantidadDias: '5' }));
      expect(res.status).toBe(201);
      expect(movimientoDe(res).cantidadDias).toBe(5);
    });

    it.each(['01/01/2026', '2026-1-1', '2026-02-30', '2026-13-01', 20260101])(
      'rechaza fecha inválida (%p) (400)',
      async (fecha) => {
        const res = await post(body({ fecha }));
        expect(res.status).toBe(400);
        expect(await movimientoRepository.count()).toBe(0);
      },
    );

    it('rechaza observaciones de más de 500 caracteres (400)', async () => {
      const res = await post(body({ observaciones: 'x'.repeat(501) }));
      expect(res.status).toBe(400);
    });

    it('rechaza campos no permitidos (400)', async () => {
      const res = await post(body({ saldo: 99 }));
      expect(res.status).toBe(400);
    });

    it('rechaza un colaborador inexistente (400)', async () => {
      const res = await post(body({ colaboradorId: 99999 }));
      expect(res.status).toBe(400);
      expect(errorDe(res).message).toMatch(/no existe/i);
      expect(await movimientoRepository.count()).toBe(0);
    });

    it('rechaza colaboradorId no entero (400)', async () => {
      const res = await post(body({ colaboradorId: 'abc' }));
      expect(res.status).toBe(400);
    });
  });

  describe('Manejo de errores', () => {
    it('devuelve el formato estándar { statusCode, message }', async () => {
      const res = await post(body({ tipo: DISFRUTADO, cantidadDias: 1 }));
      expect(res.status).toBe(400);
      expect(errorDe(res)).toEqual({
        statusCode: 400,
        message: expect.any(String) as string,
      });
    });

    it('los mensajes de validación son legibles (array de mensajes)', async () => {
      const res = await post(body({ cantidadDias: 0, tipo: 'OTRO' }));
      expect(res.status).toBe(400);
      const { message } = errorDe(res);
      expect(Array.isArray(message)).toBe(true);
      expect(message).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/mayor a cero/i),
          expect.stringMatching(/ACUMULADO o DISFRUTADO/),
        ]),
      );
    });
  });
});
