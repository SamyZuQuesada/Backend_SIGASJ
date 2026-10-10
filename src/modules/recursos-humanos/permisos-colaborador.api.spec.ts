import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { Colaborador } from './entities/colaborador.entity';
import { PermisoColaborador } from './entities/permiso-colaborador.entity';
import {
  PERMISOS_URL as URL,
  crearPermisosTestApp,
} from './testing/permisos-colaborador.test-app';

describe('POST/PATCH /api/v1/rrhh/permisos', () => {
  let app: INestApplication<App>;
  let permisoRepository: Repository<PermisoColaborador>;
  let adminToken: string;
  let signAs: (role: Role) => string;
  let crearColaborador: (extra?: Partial<Colaborador>) => Promise<Colaborador>;
  let colaborador: Colaborador;

  const body = (extra: Record<string, unknown> = {}) => ({
    colaboradorId: colaborador.id,
    fechaInicio: '2026-10-12',
    fechaFin: '2026-10-14',
    motivo: 'Cita médica',
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
    const ctx = await crearPermisosTestApp();
    ({ app, permisoRepository, signAs, crearColaborador } = ctx);
    adminToken = signAs(Role.ADMINISTRADORA);
    colaborador = await crearColaborador({ cedula: '1-1234-0567' });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await permisoRepository.clear();
  });

  describe('Autenticación y permisos', () => {
    it('rechaza sin token (401)', async () => {
      const res = await request(app.getHttpServer()).post(URL).send(body());
      expect(res.status).toBe(401);
    });

    it.each([Role.SECRETARIA, Role.FONTANERO, Role.ABONADO, Role.AYUDANTE])(
      'rechaza al rol %s (403)',
      async (role) => {
        const res = await post(body(), signAs(role));
        expect(res.status).toBe(403);
        expect(await permisoRepository.count()).toBe(0);
      },
    );
  });

  describe('Registro válido', () => {
    it('registra un permiso y lo asocia al colaborador', async () => {
      const res = await post(
        body({
          motivo: '  Cita médica ',
          observaciones: '  Cobertura del ayudante  ',
        }),
      );

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        colaboradorId: colaborador.id,
        fechaInicio: '2026-10-12',
        fechaFin: '2026-10-14',
        motivo: 'Cita médica',
        observaciones: 'Cobertura del ayudante',
      });
      expect(res.body.colaborador).toMatchObject({
        id: colaborador.id,
        cedula: '1-1234-0567',
      });

      const guardado = await permisoRepository.findOneBy({
        id: (res.body as PermisoColaborador).id,
      });
      expect(guardado?.createdAt).toBeInstanceOf(Date);
      expect(guardado?.updatedAt).toBeInstanceOf(Date);
    });

    it('acepta un permiso de un solo día y observaciones omitidas', async () => {
      const res = await post(
        body({ fechaInicio: '2026-11-01', fechaFin: '2026-11-01' }),
      );
      expect(res.status).toBe(201);
      expect((res.body as PermisoColaborador).observaciones).toBeNull();
    });
  });

  describe('Datos inválidos', () => {
    it.each(['colaboradorId', 'fechaInicio', 'fechaFin', 'motivo'])(
      'rechaza si falta %s (400)',
      async (campo) => {
        const data = body();
        delete data[campo];
        const res = await post(data);
        expect(res.status).toBe(400);
      },
    );

    it('rechaza fechas con formato inválido (400)', async () => {
      const res = await post(body({ fechaInicio: '12/10/2026' }));
      expect(res.status).toBe(400);
    });

    it('rechaza fechas de calendario inexistentes (400)', async () => {
      const res = await post(body({ fechaInicio: '2026-02-31' }));
      expect(res.status).toBe(400);
    });

    it('rechaza si la fecha de fin es anterior al inicio (400)', async () => {
      const res = await post(
        body({ fechaInicio: '2026-10-14', fechaFin: '2026-10-12' }),
      );
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/fin/i);
    });

    it('rechaza un colaborador inexistente (400)', async () => {
      const res = await post(body({ colaboradorId: 99999 }));
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/no existe/i);
      expect(await permisoRepository.count()).toBe(0);
    });
  });

  describe('Actualización', () => {
    it('actualiza motivo y fechas', async () => {
      const creado = await post(body());
      const id = (creado.body as PermisoColaborador).id;

      const res = await patch(id, {
        motivo: 'Vacaciones',
        fechaFin: '2026-10-16',
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        motivo: 'Vacaciones',
        fechaInicio: '2026-10-12',
        fechaFin: '2026-10-16',
      });
    });

    it('rechaza cuerpo vacío (400)', async () => {
      const creado = await post(body());
      const res = await patch((creado.body as PermisoColaborador).id, {});
      expect(res.status).toBe(400);
    });

    it('rechaza permiso inexistente (404)', async () => {
      const res = await patch(4040, { motivo: 'Vacaciones' });
      expect(res.status).toBe(404);
    });

    it('rechaza reasignar a un colaborador inexistente (400)', async () => {
      const creado = await post(body());
      const res = await patch((creado.body as PermisoColaborador).id, {
        colaboradorId: 88888,
      });
      expect(res.status).toBe(400);
    });

    it.each([Role.SECRETARIA, Role.FONTANERO])(
      'rechaza actualización al rol %s (403)',
      async (role) => {
        const creado = await post(body());
        const res = await patch(
          (creado.body as PermisoColaborador).id,
          { motivo: 'Otro' },
          signAs(role),
        );
        expect(res.status).toBe(403);
      },
    );
  });
});
