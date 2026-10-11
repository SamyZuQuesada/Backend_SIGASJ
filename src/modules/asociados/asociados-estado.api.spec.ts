import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { AsociadosListado } from './asociados.service';
import { Asociado } from './entities/asociado.entity';
import {
  ASOCIADOS_URL as URL,
  crearAsociadosTestApp,
} from './testing/asociados.test-app';

describe('PATCH /api/v1/asociados/:id/estado (activación e inactivación)', () => {
  let app: INestApplication<App>;
  let asociadoRepository: Repository<Asociado>;
  let signAs: (role: Role) => string;
  let adminToken: string;

  const patchEstado = (
    id: number | string,
    body: unknown,
    token = adminToken,
  ) =>
    request(app.getHttpServer())
      .patch(`${URL}/${id}/estado`)
      .set('Authorization', `Bearer ${token}`)
      .send(body as object);

  const crearAsociado = (datos: Partial<Asociado> = {}) =>
    asociadoRepository.save(
      asociadoRepository.create({
        nombre: 'Juan',
        apellidos: 'Pérez Rodríguez',
        cedula: `1-${Math.floor(Math.random() * 1e8)}`,
        correoElectronico: 'juan@test.cr',
        activo: true,
        fechaRegistro: new Date('2026-01-15T08:00:00.000Z'),
        fechaInactivacion: null,
        motivoInactivacion: null,
        ...datos,
      }),
    );

  const recargar = async (id: number) =>
    (await asociadoRepository.findOneBy({ id })) as Asociado;

  beforeAll(async () => {
    ({ app, asociadoRepository, signAs } = await crearAsociadosTestApp());
    adminToken = signAs(Role.ADMINISTRADORA);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await asociadoRepository.clear();
  });

  describe('Permisos', () => {
    it('rechaza sin token (401)', async () => {
      const asociado = await crearAsociado();
      const res = await request(app.getHttpServer())
        .patch(`${URL}/${asociado.id}/estado`)
        .send({ activo: false, motivo: 'x' });
      expect(res.status).toBe(401);
      expect((await recargar(asociado.id)).activo).toBe(true);
    });

    it.each([Role.FONTANERO, Role.ABONADO, Role.AYUDANTE])(
      'rechaza al rol %s (403) sin cambiar el estado',
      async (role) => {
        const asociado = await crearAsociado();
        const res = await patchEstado(
          asociado.id,
          { activo: false, motivo: 'x' },
          signAs(role),
        );
        expect(res.status).toBe(403);
        expect((await recargar(asociado.id)).activo).toBe(true);
      },
    );

    it.each([Role.ADMINISTRADORA, Role.SECRETARIA])(
      'permite al rol %s cambiar el estado (200)',
      async (role) => {
        const asociado = await crearAsociado();
        const res = await patchEstado(
          asociado.id,
          { activo: false, motivo: 'Solicitud del asociado' },
          signAs(role),
        );
        expect(res.status).toBe(200);
      },
    );
  });

  describe('Inactivación (5.4.2 / 5.4.3)', () => {
    it('inactiva y registra fecha y motivo', async () => {
      const asociado = await crearAsociado();
      const antes = Date.now();
      const res = await patchEstado(asociado.id, {
        activo: false,
        motivo: '  Venta de la propiedad  ',
      });

      expect(res.status).toBe(200);
      const body = res.body as Asociado;
      expect(body).toMatchObject({
        id: asociado.id,
        activo: false,
        motivoInactivacion: 'Venta de la propiedad',
      });
      const fecha = new Date(body.fechaInactivacion as unknown as string);
      expect(fecha.getTime()).toBeGreaterThanOrEqual(antes - 1000);

      const persistido = await recargar(asociado.id);
      expect(persistido.activo).toBe(false);
      expect(persistido.fechaInactivacion).not.toBeNull();
      expect(persistido.motivoInactivacion).toBe('Venta de la propiedad');
    });

    it.each([
      ['sin motivo', { activo: false }],
      ['motivo vacío', { activo: false, motivo: '' }],
      ['motivo con solo espacios', { activo: false, motivo: '    ' }],
      ['motivo no textual', { activo: false, motivo: 123 }],
      [
        'motivo de más de 500 caracteres',
        { activo: false, motivo: 'a'.repeat(501) },
      ],
    ])('rechaza inactivar %s (400) sin cambiar nada', async (_caso, body) => {
      const asociado = await crearAsociado();
      const res = await patchEstado(asociado.id, body);
      expect(res.status).toBe(400);
      const persistido = await recargar(asociado.id);
      expect(persistido.activo).toBe(true);
      expect(persistido.fechaInactivacion).toBeNull();
      expect(persistido.motivoInactivacion).toBeNull();
    });

    it('acepta un motivo de exactamente 500 caracteres', async () => {
      const asociado = await crearAsociado();
      const res = await patchEstado(asociado.id, {
        activo: false,
        motivo: 'a'.repeat(500),
      });
      expect(res.status).toBe(200);
    });

    it('inactivar a quien ya está inactivo no sobrescribe fecha ni motivo', async () => {
      const fechaOriginal = new Date('2026-03-01T12:00:00.000Z');
      const asociado = await crearAsociado({
        activo: false,
        fechaInactivacion: fechaOriginal,
        motivoInactivacion: 'Motivo original',
      });

      const res = await patchEstado(asociado.id, {
        activo: false,
        motivo: 'Otro motivo',
      });

      expect(res.status).toBe(200);
      const persistido = await recargar(asociado.id);
      expect(persistido.motivoInactivacion).toBe('Motivo original');
      expect(persistido.fechaInactivacion?.toISOString()).toBe(
        fechaOriginal.toISOString(),
      );
    });
  });

  describe('Reactivación (5.4.2)', () => {
    it('reactiva y limpia fecha y motivo', async () => {
      const asociado = await crearAsociado({
        activo: false,
        fechaInactivacion: new Date('2026-03-01T12:00:00.000Z'),
        motivoInactivacion: 'Mudanza',
      });

      const res = await patchEstado(asociado.id, { activo: true });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        activo: true,
        fechaInactivacion: null,
        motivoInactivacion: null,
      });
      const persistido = await recargar(asociado.id);
      expect(persistido.activo).toBe(true);
      expect(persistido.fechaInactivacion).toBeNull();
      expect(persistido.motivoInactivacion).toBeNull();
    });

    it('ignora el motivo al reactivar', async () => {
      const asociado = await crearAsociado({
        activo: false,
        fechaInactivacion: new Date(),
        motivoInactivacion: 'Mudanza',
      });
      const res = await patchEstado(asociado.id, {
        activo: true,
        motivo: 'no aplica',
      });
      expect(res.status).toBe(200);
      expect((await recargar(asociado.id)).motivoInactivacion).toBeNull();
    });

    it('reactivar a quien ya está activo no cambia nada', async () => {
      const asociado = await crearAsociado();
      const res = await patchEstado(asociado.id, { activo: true });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ activo: true, fechaInactivacion: null });
    });

    it('permite inactivar de nuevo con un motivo nuevo tras reactivar', async () => {
      const asociado = await crearAsociado();
      await patchEstado(asociado.id, { activo: false, motivo: 'Primero' });
      await patchEstado(asociado.id, { activo: true });
      const res = await patchEstado(asociado.id, {
        activo: false,
        motivo: 'Segundo',
      });
      expect(res.status).toBe(200);
      expect((await recargar(asociado.id)).motivoInactivacion).toBe('Segundo');
    });
  });

  describe('Validación de la petición (5.4.1)', () => {
    it.each([
      ['sin activo', {}],
      ['activo como texto "false"', { activo: 'false', motivo: 'x' }],
      ['activo como número', { activo: 0, motivo: 'x' }],
      ['activo inválido', { activo: 'quizas' }],
      ['propiedades no permitidas', { activo: true, fechaInactivacion: null }],
    ])('rechaza %s (400)', async (_caso, body) => {
      const asociado = await crearAsociado();
      expect((await patchEstado(asociado.id, body)).status).toBe(400);
      expect((await recargar(asociado.id)).activo).toBe(true);
    });

    it('devuelve 404 si el asociado no existe', async () => {
      const res = await patchEstado(99999, { activo: false, motivo: 'x' });
      expect(res.status).toBe(404);
    });

    it.each(['abc', '1.5'])(
      'devuelve 400 si el id no es entero (%s)',
      async (id) => {
        expect((await patchEstado(id, { activo: true })).status).toBe(400);
      },
    );

    it('la edición general (PATCH /:id) no permite cambiar el estado', async () => {
      const asociado = await crearAsociado();
      const res = await request(app.getHttpServer())
        .patch(`${URL}/${asociado.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ activo: false });
      expect(res.status).toBe(400);
      expect((await recargar(asociado.id)).activo).toBe(true);
    });
  });

  describe('Integración con la consulta (5.4.5)', () => {
    it('el listado y el detalle reflejan el cambio de estado', async () => {
      const asociado = await crearAsociado({ cedula: '5-0000-0001' });
      await crearAsociado({ cedula: '5-0000-0002', nombre: 'Ana' });
      await patchEstado(asociado.id, {
        activo: false,
        motivo: 'Fallecimiento',
      });

      const inactivos = await request(app.getHttpServer())
        .get(`${URL}?activo=false`)
        .set('Authorization', `Bearer ${adminToken}`);
      const listado = inactivos.body as AsociadosListado;
      expect(listado.data.map((a) => a.cedula)).toEqual(['5-0000-0001']);

      const detalle = await request(app.getHttpServer())
        .get(`${URL}/${asociado.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detalle.body).toMatchObject({
        activo: false,
        motivoInactivacion: 'Fallecimiento',
      });
    });
  });
});
