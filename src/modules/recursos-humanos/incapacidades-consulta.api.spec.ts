import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { Colaborador } from './entities/colaborador.entity';
import { Incapacidad } from './entities/incapacidad.entity';
import { IncapacidadesListado } from './incapacidades.service';
import {
  INCAPACIDADES_URL as URL,
  crearIncapacidadesTestApp,
} from './testing/incapacidades.test-app';

describe('GET /api/v1/rrhh/incapacidades', () => {
  let app: INestApplication<App>;
  let incapacidadRepository: Repository<Incapacidad>;
  let signAs: (role: Role) => string;
  let adminToken: string;
  let carlos: Colaborador;
  let ana: Colaborador;
  let sinIncapacidades: Colaborador;

  const get = (path: string, token = adminToken) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  const listar = async (query = '') => {
    const res = await get(`${URL}${query}`);
    expect(res.status).toBe(200);
    return res.body as IncapacidadesListado;
  };

  beforeAll(async () => {
    const ctx = await crearIncapacidadesTestApp();
    ({ app, incapacidadRepository, signAs } = ctx);
    adminToken = signAs(Role.ADMINISTRADORA);
    carlos = await ctx.crearColaborador({
      nombre: 'Carlos',
      cedula: '1-1234-0567',
    });
    ana = await ctx.crearColaborador({
      nombre: 'Ana',
      apellidos: 'Solís Vega',
      cedula: '2-0456-0789',
      cargo: 'Administradora',
    });
    sinIncapacidades = await ctx.crearColaborador({
      nombre: 'Luis',
      cedula: '3-1111-2222',
    });

    const semilla: Array<Partial<Incapacidad>> = [
      {
        colaboradorId: carlos.id,
        fechaInicio: '2026-10-12',
        fechaFin: '2026-10-14',
        observaciones: 'Incapacidad registrada.',
      },
      {
        colaboradorId: carlos.id,
        fechaInicio: '2026-11-01',
        fechaFin: '2026-11-05',
        observaciones: null,
      },
      {
        colaboradorId: ana.id,
        fechaInicio: '2026-10-20',
        fechaFin: '2026-10-21',
        observaciones: 'Documento entregado a administración',
      },
    ];
    for (const datos of semilla) {
      await incapacidadRepository.save(incapacidadRepository.create(datos));
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Autenticación y autorización', () => {
    it('rechaza sin token (401)', async () => {
      const res = await request(app.getHttpServer()).get(URL);
      expect(res.status).toBe(401);
    });

    it.each([Role.FONTANERO, Role.ABONADO, Role.AYUDANTE])(
      'rechaza al rol %s en listado y detalle (403)',
      async (role) => {
        const token = signAs(role);
        expect((await get(URL, token)).status).toBe(403);
        expect((await get(`${URL}/1`, token)).status).toBe(403);
      },
    );
  });

  describe('Listado', () => {
    it('devuelve todos ordenados por fechaInicio DESC e id DESC', async () => {
      const listado = await listar();
      expect(listado.total).toBe(3);
      expect(listado.page).toBe(1);
      expect(listado.limit).toBe(10);
      expect(listado.totalPages).toBe(1);
      expect(listado.data.map((i) => i.fechaInicio)).toEqual([
        '2026-11-01',
        '2026-10-20',
        '2026-10-12',
      ]);
      expect(listado.data[0].colaborador).toMatchObject({
        id: carlos.id,
        nombre: 'Carlos',
      });
    });

    it('filtra por colaborador', async () => {
      const listado = await listar(`?colaboradorId=${ana.id}`);
      expect(listado.total).toBe(1);
      expect(listado.data[0].observaciones).toBe(
        'Documento entregado a administración',
      );
      expect(listado.data[0].colaboradorId).toBe(ana.id);
    });

    it('colaborador sin incapacidades devuelve lista vacía (200)', async () => {
      const listado = await listar(`?colaboradorId=${sinIncapacidades.id}`);
      expect(listado.total).toBe(0);
      expect(listado.data).toEqual([]);
      expect(listado.totalPages).toBe(0);
    });

    it('filtra por fechaInicio (traslape)', async () => {
      const listado = await listar('?fechaInicio=2026-10-21');
      expect(listado.data.map((i) => i.fechaInicio).sort()).toEqual([
        '2026-10-20',
        '2026-11-01',
      ]);
    });

    it('filtra por fechaFin (traslape)', async () => {
      const listado = await listar('?fechaFin=2026-10-13');
      expect(listado.total).toBe(1);
      expect(listado.data[0].fechaInicio).toBe('2026-10-12');
    });

    it('filtra por rango completo (traslape)', async () => {
      const listado = await listar(
        '?fechaInicio=2026-10-13&fechaFin=2026-10-20',
      );
      expect(listado.data.map((i) => i.fechaInicio).sort()).toEqual([
        '2026-10-12',
        '2026-10-20',
      ]);
    });

    it('combina colaborador + fechas', async () => {
      const listado = await listar(
        `?colaboradorId=${carlos.id}&fechaInicio=2026-10-01&fechaFin=2026-10-31`,
      );
      expect(listado.total).toBe(1);
      expect(listado.data[0].fechaInicio).toBe('2026-10-12');
    });

    it('rango sin resultados devuelve lista vacía', async () => {
      const listado = await listar(
        `?colaboradorId=${carlos.id}&fechaInicio=2027-01-01&fechaFin=2027-01-31`,
      );
      expect(listado.total).toBe(0);
      expect(listado.data).toEqual([]);
      expect(listado.page).toBe(1);
      expect(listado.limit).toBe(10);
      expect(listado.totalPages).toBe(0);
    });

    it('rechaza fechaInicio > fechaFin (400)', async () => {
      const res = await get(
        `${URL}?fechaInicio=2026-10-20&fechaFin=2026-10-10`,
      );
      expect(res.status).toBe(400);
    });

    it('rechaza fecha inválida (400)', async () => {
      expect((await get(`${URL}?fechaInicio=12/10/2026`)).status).toBe(400);
      expect((await get(`${URL}?fechaFin=2026-02-31`)).status).toBe(400);
    });

    it('rechaza colaboradorId mal formado (400)', async () => {
      const res = await get(`${URL}?colaboradorId=abc`);
      expect(res.status).toBe(400);
    });

    it('pagina resultados con total y totalPages correctos', async () => {
      const pagina1 = await listar('?limit=2&page=1');
      expect(pagina1.data).toHaveLength(2);
      expect(pagina1.total).toBe(3);
      expect(pagina1.totalPages).toBe(2);
      expect(pagina1.page).toBe(1);
      expect(pagina1.data.map((i) => i.fechaInicio)).toEqual([
        '2026-11-01',
        '2026-10-20',
      ]);

      const pagina2 = await listar('?limit=2&page=2');
      expect(pagina2.data).toHaveLength(1);
      expect(pagina2.page).toBe(2);
      expect(pagina2.data[0].fechaInicio).toBe('2026-10-12');

      const idsPagina1 = pagina1.data.map((i) => i.id);
      expect(idsPagina1).not.toContain(pagina2.data[0].id);
    });
  });

  describe('Detalle', () => {
    it('devuelve la incapacidad con el colaborador relacionado', async () => {
      const listado = await listar(`?colaboradorId=${ana.id}`);
      const id = listado.data[0].id;
      const res = await get(`${URL}/${id}`);
      expect(res.status).toBe(200);
      const detalle = res.body as Incapacidad;
      expect(detalle).toMatchObject({
        id,
        colaboradorId: ana.id,
        fechaInicio: '2026-10-20',
        fechaFin: '2026-10-21',
        observaciones: 'Documento entregado a administración',
      });
      expect(detalle.colaborador.nombre).toBe('Ana');
      expect(detalle.createdAt).toBeTruthy();
      expect(detalle.updatedAt).toBeTruthy();
    });

    it('responde 404 si la incapacidad no existe', async () => {
      const res = await get(`${URL}/99999`);
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).toMatch(/incapacidad/i);
    });

    it('responde 400 si el id es inválido', async () => {
      const res = await get(`${URL}/abc`);
      expect(res.status).toBe(400);
    });
  });
});
