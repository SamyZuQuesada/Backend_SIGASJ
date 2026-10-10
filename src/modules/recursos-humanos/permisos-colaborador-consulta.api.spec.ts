import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { Colaborador } from './entities/colaborador.entity';
import { PermisoColaborador } from './entities/permiso-colaborador.entity';
import { PermisosColaboradorListado } from './permisos-colaborador.service';
import {
  PERMISOS_URL as URL,
  crearPermisosTestApp,
} from './testing/permisos-colaborador.test-app';

describe('GET /api/v1/rrhh/permisos', () => {
  let app: INestApplication<App>;
  let permisoRepository: Repository<PermisoColaborador>;
  let signAs: (role: Role) => string;
  let adminToken: string;
  let carlos: Colaborador;
  let ana: Colaborador;

  const get = (path: string, token = adminToken) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  const listar = async (query = '') => {
    const res = await get(`${URL}${query}`);
    expect(res.status).toBe(200);
    return res.body as PermisosColaboradorListado;
  };

  beforeAll(async () => {
    const ctx = await crearPermisosTestApp();
    ({ app, permisoRepository, signAs } = ctx);
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

    const semilla: Array<Partial<PermisoColaborador>> = [
      {
        colaboradorId: carlos.id,
        fechaInicio: '2026-10-12',
        fechaFin: '2026-10-14',
        motivo: 'Cita médica',
      },
      {
        colaboradorId: carlos.id,
        fechaInicio: '2026-11-01',
        fechaFin: '2026-11-05',
        motivo: 'Vacaciones',
      },
      {
        colaboradorId: ana.id,
        fechaInicio: '2026-10-20',
        fechaFin: '2026-10-21',
        motivo: 'Asunto personal',
      },
    ];
    for (const datos of semilla) {
      await permisoRepository.save(permisoRepository.create(datos));
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Permisos de acceso', () => {
    it('rechaza sin token (401)', async () => {
      const res = await request(app.getHttpServer()).get(URL);
      expect(res.status).toBe(401);
    });

    it.each([Role.SECRETARIA, Role.FONTANERO, Role.ABONADO, Role.AYUDANTE])(
      'rechaza al rol %s en listado y detalle (403)',
      async (role) => {
        const token = signAs(role);
        expect((await get(URL, token)).status).toBe(403);
        expect((await get(`${URL}/1`, token)).status).toBe(403);
      },
    );
  });

  describe('Listado', () => {
    it('devuelve todos ordenados por fecha de inicio descendente', async () => {
      const listado = await listar();
      expect(listado.total).toBe(3);
      expect(listado.page).toBe(1);
      expect(listado.limit).toBe(10);
      expect(listado.totalPages).toBe(1);
      expect(listado.data.map((p) => p.motivo)).toEqual([
        'Vacaciones',
        'Asunto personal',
        'Cita médica',
      ]);
      expect(listado.data[0].colaborador).toMatchObject({
        id: carlos.id,
        nombre: 'Carlos',
      });
    });

    it('filtra por colaborador', async () => {
      const listado = await listar(`?colaboradorId=${ana.id}`);
      expect(listado.total).toBe(1);
      expect(listado.data[0].motivo).toBe('Asunto personal');
    });

    it('filtra por periodo de fechas (traslape)', async () => {
      const listado = await listar('?fechaInicio=2026-10-13&fechaFin=2026-10-20');
      expect(listado.data.map((p) => p.motivo).sort()).toEqual([
        'Asunto personal',
        'Cita médica',
      ]);
    });

    it('pagina los resultados', async () => {
      const pagina1 = await listar('?limit=2&page=1');
      expect(pagina1.data).toHaveLength(2);
      expect(pagina1.total).toBe(3);
      expect(pagina1.totalPages).toBe(2);

      const pagina2 = await listar('?limit=2&page=2');
      expect(pagina2.data).toHaveLength(1);
      expect(pagina2.page).toBe(2);
    });

    it('devuelve listado vacío cuando no hay coincidencias', async () => {
      const listado = await listar(`?colaboradorId=${carlos.id}&fechaInicio=2027-01-01`);
      expect(listado.total).toBe(0);
      expect(listado.data).toEqual([]);
      expect(listado.totalPages).toBe(0);
    });
  });

  describe('Detalle', () => {
    it('devuelve el permiso con el colaborador relacionado', async () => {
      const listado = await listar(`?colaboradorId=${ana.id}`);
      const id = listado.data[0].id;
      const res = await get(`${URL}/${id}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id,
        motivo: 'Asunto personal',
        colaboradorId: ana.id,
      });
      expect((res.body as PermisoColaborador).colaborador.nombre).toBe('Ana');
    });

    it('responde 404 si el permiso no existe', async () => {
      const res = await get(`${URL}/99999`);
      expect(res.status).toBe(404);
    });
  });
});
