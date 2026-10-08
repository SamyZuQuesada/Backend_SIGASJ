import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { ColaboradoresListado } from './colaboradores.service';
import { Colaborador } from './entities/colaborador.entity';
import {
  COLABORADORES_URL as URL,
  crearColaboradoresTestApp,
} from './testing/colaboradores.test-app';

describe('GET /api/v1/rrhh/colaboradores', () => {
  let app: INestApplication<App>;
  let colaboradorRepository: Repository<Colaborador>;
  let signAs: (role: Role) => string;
  let usuario: Usuario;
  let adminToken: string;
  const ids: Record<string, number> = {};

  const get = (path: string, token = adminToken) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  const listar = async (query = '') => {
    const res = await get(`${URL}${query}`);
    expect(res.status).toBe(200);
    return res.body as ColaboradoresListado;
  };

  const cedulas = (listado: ColaboradoresListado) =>
    listado.data.map((c) => c.cedula);

  beforeAll(async () => {
    const ctx = await crearColaboradoresTestApp();
    ({ app, colaboradorRepository, signAs } = ctx);
    adminToken = signAs(Role.ADMINISTRADORA);
    usuario = await ctx.crearUsuario('carlos@asadasanjuan.cr');

    const semilla: Partial<Colaborador>[] = [
      {
        nombre: 'Carlos',
        apellidos: 'Pérez Mora',
        cedula: '1-1234-0567',
        cargo: 'Fontanero',
        activo: true,
        usuarioId: usuario.idUsuario,
      },
      {
        nombre: 'Ana',
        apellidos: 'Solís Vega',
        cedula: '2-0456-0789',
        cargo: 'Administradora',
        activo: true,
      },
      {
        nombre: 'Luis',
        apellidos: 'Mora Castro',
        cedula: '3-0111-0222',
        cargo: 'Fontanero',
        activo: false,
      },
      {
        nombre: 'María',
        apellidos: 'Alfaro Rojas',
        cedula: '155812345678',
        cargo: 'Secretaria',
        activo: true,
      },
      {
        nombre: 'Carla',
        apellidos: 'Ureña Díaz',
        cedula: '4-0999-0100',
        cargo: 'Fontanero',
        activo: true,
      },
    ];
    for (const datos of semilla) {
      const guardado = await colaboradorRepository.save(
        colaboradorRepository.create({
          ...datos,
          correoElectronico: `${datos.nombre?.toLowerCase()}@test.cr`,
        }),
      );
      ids[guardado.cedula] = guardado.id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Permisos', () => {
    it('rechaza sin token (401)', async () => {
      const res = await request(app.getHttpServer()).get(URL);
      expect(res.status).toBe(401);
    });

    it.each([Role.SECRETARIA, Role.FONTANERO, Role.ABONADO, Role.AYUDANTE])(
      'rechaza al rol %s en listado y detalle (403)',
      async (role) => {
        const token = signAs(role);
        expect((await get(URL, token)).status).toBe(403);
        expect((await get(`${URL}/${ids['1-1234-0567']}`, token)).status).toBe(
          403,
        );
      },
    );
  });

  describe('Listado', () => {
    it('devuelve todos ordenados por apellidos con metadatos de paginación', async () => {
      const listado = await listar();
      expect(listado.total).toBe(5);
      expect(listado.page).toBe(1);
      expect(listado.limit).toBe(10);
      expect(listado.totalPages).toBe(1);
      expect(listado.data.map((c) => c.apellidos)).toEqual([
        'Alfaro Rojas',
        'Mora Castro',
        'Pérez Mora',
        'Solís Vega',
        'Ureña Díaz',
      ]);
    });

    it('pagina los resultados', async () => {
      const pagina1 = await listar('?limit=2&page=1');
      const pagina3 = await listar('?limit=2&page=3');

      expect(pagina1.data).toHaveLength(2);
      expect(pagina1.total).toBe(5);
      expect(pagina1.totalPages).toBe(3);
      expect(pagina3.data).toHaveLength(1);
      expect(pagina3.data[0].apellidos).toBe('Ureña Díaz');
    });

    it('devuelve página vacía fuera de rango', async () => {
      const listado = await listar('?limit=2&page=10');
      expect(listado.data).toHaveLength(0);
      expect(listado.total).toBe(5);
    });

    it('busca por nombre (parcial)', async () => {
      const listado = await listar('?nombre=Carl');
      expect(cedulas(listado).sort()).toEqual(['1-1234-0567', '4-0999-0100']);
    });

    it('busca por apellidos (parcial)', async () => {
      const listado = await listar('?apellidos=Mora');
      expect(cedulas(listado)).toEqual(['3-0111-0222', '1-1234-0567']);
    });

    it('busca por cédula con o sin guiones', async () => {
      expect(cedulas(await listar('?cedula=1-1234'))).toEqual(['1-1234-0567']);
      expect(cedulas(await listar('?cedula=112340567'))).toEqual([
        '1-1234-0567',
      ]);
    });

    it('búsqueda general en nombre, apellidos y cédula', async () => {
      expect(cedulas(await listar('?search=Ana'))).toEqual(['2-0456-0789']);
      expect(cedulas(await listar('?search=Rojas'))).toEqual(['155812345678']);
      expect(cedulas(await listar('?search=304560789'))).toEqual([]);
      expect(cedulas(await listar('?search=204560789'))).toEqual([
        '2-0456-0789',
      ]);
    });

    it('trata % y _ como texto literal en las búsquedas', async () => {
      expect((await listar('?nombre=%25')).total).toBe(0);
      expect((await listar('?nombre=_')).total).toBe(0);
    });

    it('filtra por cargo sin distinguir mayúsculas', async () => {
      const listado = await listar('?cargo=fontanero');
      expect(listado.total).toBe(3);
      expect(listado.data.every((c) => c.cargo === 'Fontanero')).toBe(true);
    });

    it('filtra por estado', async () => {
      const inactivos = await listar('?activo=false');
      const activos = await listar('?activo=true');
      expect(cedulas(inactivos)).toEqual(['3-0111-0222']);
      expect(activos.total).toBe(4);
    });

    it('combina búsqueda y filtros', async () => {
      const listado = await listar('?cargo=Fontanero&activo=true&search=Carl');
      expect(cedulas(listado).sort()).toEqual(['1-1234-0567', '4-0999-0100']);
    });

    it.each([
      '?page=0',
      '?limit=0',
      '?limit=101',
      '?page=abc',
      '?activo=quizas',
      '?otro=1',
    ])('rechaza parámetros inválidos %s (400)', async (query) => {
      const res = await get(`${URL}${query}`);
      expect(res.status).toBe(400);
    });
  });

  describe('Detalle', () => {
    it('devuelve el colaborador con su cuenta de usuario', async () => {
      const res = await get(`${URL}/${ids['1-1234-0567']}`);
      expect(res.status).toBe(200);

      const colaborador = res.body as Colaborador;
      expect(colaborador).toMatchObject({
        id: ids['1-1234-0567'],
        nombre: 'Carlos',
        cedula: '1-1234-0567',
        usuarioId: usuario.idUsuario,
      });
      expect(colaborador.usuario).toMatchObject({
        idUsuario: usuario.idUsuario,
        correo: 'carlos@asadasanjuan.cr',
      });
      expect(colaborador.usuario).not.toHaveProperty('passwordHash');
    });

    it('devuelve usuario null si no tiene cuenta', async () => {
      const res = await get(`${URL}/${ids['2-0456-0789']}`);
      expect(res.status).toBe(200);
      expect((res.body as Colaborador).usuario).toBeNull();
    });

    it('devuelve 404 si no existe', async () => {
      const res = await get(`${URL}/99999`);
      expect(res.status).toBe(404);
    });

    it('devuelve 400 si el id no es numérico', async () => {
      const res = await get(`${URL}/abc`);
      expect(res.status).toBe(400);
    });
  });
});
