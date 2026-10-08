import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { Colaborador } from './entities/colaborador.entity';
import {
  COLABORADORES_URL as URL,
  ColaboradoresTestApp,
  crearColaboradoresTestApp,
} from './testing/colaboradores.test-app';

describe('PATCH /api/v1/rrhh/colaboradores/:id y /:id/estado', () => {
  let ctx: ColaboradoresTestApp;
  let app: INestApplication<App>;
  let repo: Repository<Colaborador>;
  let adminToken: string;
  let colaborador: Colaborador;

  const patch = (path: string, data: unknown, token = adminToken) =>
    request(app.getHttpServer())
      .patch(path)
      .set('Authorization', `Bearer ${token}`)
      .send(data as object);

  const colaboradorDe = (res: request.Response) => res.body as Colaborador;

  const crearColaborador = (datos: Partial<Colaborador> = {}) =>
    repo.save(
      repo.create({
        nombre: 'Carlos',
        apellidos: 'Pérez Mora',
        cedula: '1-1234-0567',
        correoElectronico: 'carlos@test.cr',
        cargo: 'Fontanero',
        activo: true,
        ...datos,
      }),
    );

  beforeAll(async () => {
    ctx = await crearColaboradoresTestApp();
    app = ctx.app;
    repo = ctx.colaboradorRepository;
    adminToken = ctx.signAs(Role.ADMINISTRADORA);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await repo.clear();
    colaborador = await crearColaborador();
  });

  describe('Permisos', () => {
    it('rechaza sin token (401)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${URL}/${colaborador.id}/estado`)
        .send({ activo: false });
      expect(res.status).toBe(401);
    });

    it.each([Role.SECRETARIA, Role.FONTANERO, Role.ABONADO, Role.AYUDANTE])(
      'rechaza al rol %s (403) y no modifica nada',
      async (role) => {
        const token = ctx.signAs(role);
        expect(
          (await patch(`${URL}/${colaborador.id}`, { cargo: 'X' }, token))
            .status,
        ).toBe(403);
        expect(
          (
            await patch(
              `${URL}/${colaborador.id}/estado`,
              { activo: false },
              token,
            )
          ).status,
        ).toBe(403);

        const enBd = await repo.findOneByOrFail({ id: colaborador.id });
        expect(enBd.cargo).toBe('Fontanero');
        expect(enBd.activo).toBe(true);
      },
    );
  });

  describe('Actualizar información', () => {
    it('actualiza solo los campos enviados', async () => {
      const res = await patch(`${URL}/${colaborador.id}`, {
        cargo: '  Encargado de bodega ',
        correoElectronico: 'Carlos.Nuevo@TEST.cr',
      });

      expect(res.status).toBe(200);
      expect(colaboradorDe(res)).toMatchObject({
        id: colaborador.id,
        nombre: 'Carlos',
        apellidos: 'Pérez Mora',
        cedula: '1-1234-0567',
        cargo: 'Encargado de bodega',
        correoElectronico: 'carlos.nuevo@test.cr',
        activo: true,
      });

      const enBd = await repo.findOneByOrFail({ id: colaborador.id });
      expect(enBd.cargo).toBe('Encargado de bodega');
      expect(enBd.updatedAt.getTime()).toBeGreaterThanOrEqual(
        colaborador.updatedAt.getTime(),
      );
    });

    it('normaliza la cédula al actualizar', async () => {
      const res = await patch(`${URL}/${colaborador.id}`, {
        cedula: '209990888',
      });
      expect(res.status).toBe(200);
      expect(colaboradorDe(res).cedula).toBe('2-0999-0888');
    });

    it('permite reenviar su propia cédula', async () => {
      const res = await patch(`${URL}/${colaborador.id}`, {
        cedula: '112340567',
        nombre: 'Carlos Andrés',
      });
      expect(res.status).toBe(200);
      expect(colaboradorDe(res).nombre).toBe('Carlos Andrés');
    });

    it('rechaza una cédula de otro colaborador (409)', async () => {
      await crearColaborador({ cedula: '2-0456-0789' });
      const res = await patch(`${URL}/${colaborador.id}`, {
        cedula: '2-0456-0789',
      });
      expect(res.status).toBe(409);
    });

    it('vincula y desvincula una cuenta de usuario', async () => {
      const usuario = await ctx.crearUsuario('carlos@asadasanjuan.cr');

      const vincular = await patch(`${URL}/${colaborador.id}`, {
        usuarioId: usuario.idUsuario,
      });
      expect(vincular.status).toBe(200);
      expect(colaboradorDe(vincular).usuarioId).toBe(usuario.idUsuario);
      expect(colaboradorDe(vincular).usuario?.idUsuario).toBe(
        usuario.idUsuario,
      );

      const reenviar = await patch(`${URL}/${colaborador.id}`, {
        usuarioId: String(usuario.idUsuario),
      });
      expect(reenviar.status).toBe(200);

      const desvincular = await patch(`${URL}/${colaborador.id}`, {
        usuarioId: null,
      });
      expect(desvincular.status).toBe(200);
      expect(colaboradorDe(desvincular).usuarioId).toBeNull();
      expect(colaboradorDe(desvincular).usuario).toBeNull();
    });

    it('rechaza una cuenta ya asignada a otro colaborador (409)', async () => {
      const usuario = await ctx.crearUsuario('otro@asadasanjuan.cr');
      await crearColaborador({
        cedula: '2-0456-0789',
        usuarioId: usuario.idUsuario,
      });

      const res = await patch(`${URL}/${colaborador.id}`, {
        usuarioId: usuario.idUsuario,
      });
      expect(res.status).toBe(409);
    });

    it('rechaza un usuario inexistente (400)', async () => {
      const res = await patch(`${URL}/${colaborador.id}`, {
        usuarioId: 99999,
      });
      expect(res.status).toBe(400);
    });

    it.each([
      [{}, 'cuerpo vacío'],
      [{ nombre: '   ' }, 'nombre vacío'],
      [{ correoElectronico: 'malo' }, 'correo inválido'],
      [{ cedula: '0-1234-5678' }, 'cédula inválida'],
      [{ activo: false }, 'activo (va por /estado)'],
      [{ id: 50 }, 'campo no permitido'],
    ])('rechaza %j: %s (400)', async (data) => {
      const res = await patch(`${URL}/${colaborador.id}`, data);
      expect(res.status).toBe(400);
    });

    it('devuelve 404 si no existe', async () => {
      const res = await patch(`${URL}/99999`, { cargo: 'X' });
      expect(res.status).toBe(404);
    });
  });

  describe('Activar / inactivar', () => {
    it('inactiva y reactiva sin eliminar el registro', async () => {
      const inactivar = await patch(`${URL}/${colaborador.id}/estado`, {
        activo: false,
      });
      expect(inactivar.status).toBe(200);
      expect(colaboradorDe(inactivar).activo).toBe(false);
      expect((await repo.findOneByOrFail({ id: colaborador.id })).activo).toBe(
        false,
      );

      const reactivar = await patch(`${URL}/${colaborador.id}/estado`, {
        activo: true,
      });
      expect(reactivar.status).toBe(200);
      expect(colaboradorDe(reactivar).activo).toBe(true);
      expect(await repo.count()).toBe(1);
    });

    it('conserva datos y cuenta de usuario al inactivar', async () => {
      const usuario = await ctx.crearUsuario('conserva@asadasanjuan.cr');
      await repo.update(colaborador.id, { usuarioId: usuario.idUsuario });

      const res = await patch(`${URL}/${colaborador.id}/estado`, {
        activo: false,
      });

      expect(colaboradorDe(res)).toMatchObject({
        nombre: 'Carlos',
        cedula: '1-1234-0567',
        cargo: 'Fontanero',
        usuarioId: usuario.idUsuario,
        activo: false,
      });
    });

    it('es idempotente si ya tiene ese estado', async () => {
      const res = await patch(`${URL}/${colaborador.id}/estado`, {
        activo: true,
      });
      expect(res.status).toBe(200);
      expect(colaboradorDe(res).activo).toBe(true);
    });

    it.each([{}, { activo: 'false' }, { activo: 1 }, { activo: null }])(
      'rechaza %j (400)',
      async (data) => {
        const res = await patch(`${URL}/${colaborador.id}/estado`, data);
        expect(res.status).toBe(400);
        expect(
          (await repo.findOneByOrFail({ id: colaborador.id })).activo,
        ).toBe(true);
      },
    );

    it('devuelve 404 si no existe', async () => {
      const res = await patch(`${URL}/99999/estado`, { activo: false });
      expect(res.status).toBe(404);
    });
  });

  it('no expone eliminación física (DELETE no existe)', async () => {
    const res = await request(app.getHttpServer())
      .delete(`${URL}/${colaborador.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
    expect(await repo.count()).toBe(1);
  });
});
