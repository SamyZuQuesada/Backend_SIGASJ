import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { Colaborador } from './entities/colaborador.entity';
import { Incapacidad } from './entities/incapacidad.entity';
import {
  INCAPACIDADES_URL as URL,
  crearIncapacidadesTestApp,
} from './testing/incapacidades.test-app';

describe('POST/PATCH /api/v1/rrhh/incapacidades', () => {
  let app: INestApplication<App>;
  let incapacidadRepository: Repository<Incapacidad>;
  let adminToken: string;
  let signAs: (role: Role) => string;
  let crearColaborador: (extra?: Partial<Colaborador>) => Promise<Colaborador>;
  let colaborador: Colaborador;

  const body = (extra: Record<string, unknown> = {}) => ({
    colaboradorId: colaborador.id,
    fechaInicio: '2026-10-12',
    fechaFin: '2026-10-20',
    ...extra,
  });

  const post = (data: Record<string, unknown>, token = adminToken) =>
    request(app.getHttpServer())
      .post(URL)
      .set('Authorization', `Bearer ${token}`)
      .send(data);

  const patch = (
    id: number,
    data: Record<string, unknown>,
    token = adminToken,
  ) =>
    request(app.getHttpServer())
      .patch(`${URL}/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(data);

  beforeAll(async () => {
    const ctx = await crearIncapacidadesTestApp();
    ({ app, incapacidadRepository, signAs, crearColaborador } = ctx);
    adminToken = signAs(Role.ADMINISTRADORA);
    colaborador = await crearColaborador({ cedula: '1-2345-0678' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await incapacidadRepository.clear();
  });

  describe('Autenticación y autorización', () => {
    it('rechaza sin token (401)', async () => {
      const res = await request(app.getHttpServer()).post(URL).send(body());
      expect(res.status).toBe(401);
    });

    it.each([Role.FONTANERO, Role.ABONADO, Role.AYUDANTE])(
      'rechaza al rol %s (403)',
      async (role) => {
        const res = await post(body(), signAs(role));
        expect(res.status).toBe(403);
        expect(await incapacidadRepository.count()).toBe(0);
      },
    );
  });

  describe('Registro válido', () => {
    it('registra una incapacidad asociada al colaborador', async () => {
      const res = await post(
        body({
          observaciones: '  Documento entregado a administración  ',
        }),
      );

      expect(res.status).toBe(201);
      const creada = res.body as Incapacidad & {
        colaborador: Pick<Colaborador, 'id' | 'cedula'>;
      };
      expect(creada).toMatchObject({
        colaboradorId: colaborador.id,
        fechaInicio: '2026-10-12',
        fechaFin: '2026-10-20',
        observaciones: 'Documento entregado a administración',
      });
      expect(creada.colaborador).toMatchObject({
        id: colaborador.id,
        cedula: '1-2345-0678',
      });
      expect(creada.id).toBeGreaterThan(0);
      expect(creada.createdAt).toBeTruthy();
      expect(creada.updatedAt).toBeTruthy();

      const guardada = await incapacidadRepository.findOneBy({
        id: creada.id,
      });
      expect(guardada?.createdAt).toBeInstanceOf(Date);
      expect(guardada?.updatedAt).toBeInstanceOf(Date);
    });

    it('acepta un periodo de un solo día y observaciones omitidas', async () => {
      const res = await post(
        body({ fechaInicio: '2026-11-01', fechaFin: '2026-11-01' }),
      );
      expect(res.status).toBe(201);
      expect((res.body as Incapacidad).observaciones).toBeNull();
      expect((res.body as Incapacidad).fechaInicio).toBe('2026-11-01');
      expect((res.body as Incapacidad).fechaFin).toBe('2026-11-01');
    });
  });

  describe('Datos inválidos en creación', () => {
    it.each(['colaboradorId', 'fechaInicio', 'fechaFin'])(
      'rechaza si falta %s (400)',
      async (campo) => {
        const data = body();
        delete data[campo];
        const res = await post(data);
        expect(res.status).toBe(400);
      },
    );

    it('rechaza fechaInicio con formato inválido (400)', async () => {
      const res = await post(body({ fechaInicio: '12/10/2026' }));
      expect(res.status).toBe(400);
    });

    it('rechaza fechaFin con formato inválido (400)', async () => {
      const res = await post(body({ fechaFin: '20-10-2026' }));
      expect(res.status).toBe(400);
    });

    it('rechaza fechas de calendario inexistentes (400)', async () => {
      const res = await post(body({ fechaInicio: '2026-02-31' }));
      expect(res.status).toBe(400);
    });

    it('rechaza si la fecha final es anterior a la inicial (400)', async () => {
      const res = await post(
        body({ fechaInicio: '2026-10-15', fechaFin: '2026-10-10' }),
      );
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/fecha final/i);
      expect(await incapacidadRepository.count()).toBe(0);
    });

    it('rechaza un colaborador inexistente (404)', async () => {
      const res = await post(body({ colaboradorId: 99999 }));
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).toMatch(/colaborador/i);
      expect(await incapacidadRepository.count()).toBe(0);
    });
  });

  describe('Actualización', () => {
    it('actualiza observaciones', async () => {
      const creado = await post(body());
      const id = (creado.body as Incapacidad).id;

      const res = await patch(id, {
        observaciones: 'Incapacidad registrada.',
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        observaciones: 'Incapacidad registrada.',
        fechaInicio: '2026-10-12',
        fechaFin: '2026-10-20',
      });
    });

    it('actualiza fechaInicio y fechaFin con periodo válido', async () => {
      const creado = await post(body());
      const id = (creado.body as Incapacidad).id;

      const res = await patch(id, {
        fechaInicio: '2026-10-10',
        fechaFin: '2026-10-25',
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        fechaInicio: '2026-10-10',
        fechaFin: '2026-10-25',
      });
    });

    it('rechaza PATCH que deja fechaFin anterior a fechaInicio (400) y no persiste', async () => {
      const creado = await post(body());
      const id = (creado.body as Incapacidad).id;

      const res = await patch(id, { fechaInicio: '2026-10-25' });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/fecha final/i);

      const enDb = await incapacidadRepository.findOneBy({ id });
      expect(enDb?.fechaInicio).toBe('2026-10-12');
      expect(enDb?.fechaFin).toBe('2026-10-20');
    });

    it('rechaza cuerpo vacío (400)', async () => {
      const creado = await post(body());
      const res = await patch((creado.body as Incapacidad).id, {});
      expect(res.status).toBe(400);
    });

    it('rechaza incapacidad inexistente (404)', async () => {
      const res = await patch(4040, { observaciones: 'X' });
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).toMatch(/incapacidad/i);
    });

    it('rechaza reasignar a un colaborador inexistente (404)', async () => {
      const creado = await post(body());
      const res = await patch((creado.body as Incapacidad).id, {
        colaboradorId: 88888,
      });
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).toMatch(/colaborador/i);

      const enDb = await incapacidadRepository.findOneBy({
        id: (creado.body as Incapacidad).id,
      });
      expect(enDb?.colaboradorId).toBe(colaborador.id);
    });

    it.each([Role.FONTANERO])(
      'rechaza actualización al rol %s (403)',
      async (role) => {
        const creado = await post(body());
        const res = await patch(
          (creado.body as Incapacidad).id,
          { observaciones: 'Otro' },
          signAs(role),
        );
        expect(res.status).toBe(403);
      },
    );
  });
});
