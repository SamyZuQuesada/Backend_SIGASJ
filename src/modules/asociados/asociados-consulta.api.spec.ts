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

describe('GET /api/v1/asociados (consulta y búsqueda)', () => {
  let app: INestApplication<App>;
  let asociadoRepository: Repository<Asociado>;
  let signAs: (role: Role) => string;
  let adminToken: string;
  const ids: Record<string, number> = {};

  const get = (path: string, token = adminToken) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  const listar = async (query = '') => {
    const res = await get(`${URL}${query}`);
    expect(res.status).toBe(200);
    return res.body as AsociadosListado;
  };

  const cedulas = (listado: AsociadosListado) =>
    listado.data.map((a) => a.cedula);

  beforeAll(async () => {
    ({ app, asociadoRepository, signAs } = await crearAsociadosTestApp());
    adminToken = signAs(Role.ADMINISTRADORA);

    const semilla: Partial<Asociado>[] = [
      {
        nombre: 'Carlos',
        apellidos: 'Pérez Mora',
        cedula: '1-1234-0567',
        activo: true,
      },
      {
        nombre: 'Ana',
        apellidos: 'Solís Vega',
        cedula: '2-0456-0789',
        activo: true,
      },
      {
        nombre: 'Luis',
        apellidos: 'Mora Castro',
        cedula: '3-0111-0222',
        activo: false,
        fechaInactivacion: new Date('2026-05-02T10:00:00.000Z'),
      },
      {
        nombre: 'María',
        apellidos: 'Alfaro Rojas',
        cedula: '155812345678',
        activo: true,
      },
      {
        nombre: 'Carla',
        apellidos: 'Ureña Díaz',
        cedula: '4-0999-0100',
        activo: true,
      },
    ];
    for (const datos of semilla) {
      const guardado = await asociadoRepository.save(
        asociadoRepository.create({
          ...datos,
          correoElectronico: `${datos.nombre?.toLowerCase()}@test.cr`,
          fechaRegistro: new Date('2026-01-15T08:00:00.000Z'),
        }),
      );
      ids[guardado.cedula] = guardado.id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Permisos', () => {
    it('rechaza sin token en listado y detalle (401)', async () => {
      const server = app.getHttpServer();
      expect((await request(server).get(URL)).status).toBe(401);
      expect(
        (await request(server).get(`${URL}/${ids['1-1234-0567']}`)).status,
      ).toBe(401);
    });

    it.each([Role.FONTANERO, Role.ABONADO, Role.AYUDANTE])(
      'rechaza al rol %s en listado y detalle (403)',
      async (role) => {
        const token = signAs(role);
        expect((await get(URL, token)).status).toBe(403);
        expect((await get(`${URL}/${ids['1-1234-0567']}`, token)).status).toBe(
          403,
        );
      },
    );

    it.each([Role.ADMINISTRADORA, Role.SECRETARIA])(
      'permite al rol %s consultar listado y detalle (200)',
      async (role) => {
        const token = signAs(role);
        expect((await get(URL, token)).status).toBe(200);
        expect((await get(`${URL}/${ids['1-1234-0567']}`, token)).status).toBe(
          200,
        );
      },
    );
  });

  describe('Listado (5.2.1)', () => {
    it('devuelve todos ordenados por apellidos con metadatos de paginación', async () => {
      const listado = await listar();
      expect(listado.total).toBe(5);
      expect(listado.page).toBe(1);
      expect(listado.limit).toBe(10);
      expect(listado.totalPages).toBe(1);
      expect(listado.data.map((a) => a.apellidos)).toEqual([
        'Alfaro Rojas',
        'Mora Castro',
        'Pérez Mora',
        'Solís Vega',
        'Ureña Díaz',
      ]);
    });

    it('incluye los datos del padrón en cada fila', async () => {
      const listado = await listar('?search=Luis');
      expect(listado.data[0]).toMatchObject({
        id: ids['3-0111-0222'],
        nombre: 'Luis',
        apellidos: 'Mora Castro',
        cedula: '3-0111-0222',
        correoElectronico: 'luis@test.cr',
        activo: false,
      });
      expect(listado.data[0].fechaRegistro).toBeDefined();
      expect(listado.data[0].fechaInactivacion).not.toBeNull();
    });
  });

  describe('Búsqueda y filtros (5.2.2)', () => {
    it('busca por nombre (parcial)', async () => {
      expect(cedulas(await listar('?search=Carl')).sort()).toEqual([
        '1-1234-0567',
        '4-0999-0100',
      ]);
    });

    it('busca por apellidos (parcial)', async () => {
      expect(cedulas(await listar('?search=Mora'))).toEqual([
        '3-0111-0222',
        '1-1234-0567',
      ]);
    });

    it('busca por cédula con o sin guiones', async () => {
      expect(cedulas(await listar('?search=1-1234'))).toEqual(['1-1234-0567']);
      expect(cedulas(await listar('?search=112340567'))).toEqual([
        '1-1234-0567',
      ]);
      expect(cedulas(await listar('?search=304560789'))).toEqual([]);
    });

    it('ignora espacios alrededor del término', async () => {
      expect(cedulas(await listar('?search=%20%20Ana%20%20'))).toEqual([
        '2-0456-0789',
      ]);
    });

    it('trata % y _ como texto literal', async () => {
      expect((await listar('?search=%25')).total).toBe(0);
      expect((await listar('?search=_')).total).toBe(0);
    });

    it('devuelve todos cuando el término está vacío', async () => {
      expect((await listar('?search=')).total).toBe(5);
    });

    it('filtra por estado', async () => {
      expect(cedulas(await listar('?activo=false'))).toEqual(['3-0111-0222']);
      expect((await listar('?activo=true')).total).toBe(4);
    });

    it('combina búsqueda y estado', async () => {
      expect(cedulas(await listar('?search=Mora&activo=true'))).toEqual([
        '1-1234-0567',
      ]);
    });
  });

  describe('Paginación (5.2.3)', () => {
    it('pagina los resultados', async () => {
      const pagina1 = await listar('?limit=2&page=1');
      const pagina3 = await listar('?limit=2&page=3');

      expect(pagina1.data).toHaveLength(2);
      expect(pagina1.total).toBe(5);
      expect(pagina1.totalPages).toBe(3);
      expect(pagina3.data).toHaveLength(1);
      expect(pagina3.data[0].apellidos).toBe('Ureña Díaz');
    });

    it('pagina sobre los resultados filtrados', async () => {
      const listado = await listar('?activo=true&limit=3&page=2');
      expect(listado.total).toBe(4);
      expect(listado.totalPages).toBe(2);
      expect(listado.data.map((a) => a.apellidos)).toEqual(['Ureña Díaz']);
    });

    it('devuelve página vacía fuera de rango', async () => {
      const listado = await listar('?limit=2&page=10');
      expect(listado.data).toHaveLength(0);
      expect(listado.total).toBe(5);
    });

    it('devuelve totalPages 0 sin resultados', async () => {
      const listado = await listar('?search=NoExiste');
      expect(listado).toMatchObject({ data: [], total: 0, totalPages: 0 });
    });

    it.each([
      '?page=0',
      '?limit=0',
      '?limit=101',
      '?page=abc',
      '?page=1.5',
      '?activo=quizas',
      `?search=${'a'.repeat(101)}`,
      '?otro=1',
    ])('rechaza parámetros inválidos %s (400)', async (query) => {
      expect((await get(`${URL}${query}`)).status).toBe(400);
    });
  });

  describe('Detalle (5.2.4)', () => {
    it('devuelve el asociado completo', async () => {
      const res = await get(`${URL}/${ids['2-0456-0789']}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: ids['2-0456-0789'],
        nombre: 'Ana',
        apellidos: 'Solís Vega',
        cedula: '2-0456-0789',
        correoElectronico: 'ana@test.cr',
        activo: true,
        fechaInactivacion: null,
      });
      const asociado = res.body as Asociado;
      expect(asociado.fechaRegistro).toBeDefined();
      expect(asociado.createdAt).toBeDefined();
    });

    it('devuelve 404 si no existe', async () => {
      expect((await get(`${URL}/99999`)).status).toBe(404);
    });

    it.each(['abc', '1.5'])(
      'devuelve 400 si el id no es entero (%s)',
      async (id) => {
        expect((await get(`${URL}/${id}`)).status).toBe(400);
      },
    );
  });
});
