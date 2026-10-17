import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { HistorialAsociadosResponseDto } from './dto/historial-asociado.dto';
import { Asociado } from './entities/asociado.entity';
import {
  ASOCIADOS_URL as BASE_URL,
  crearAsociadosTestApp,
} from './testing/asociados.test-app';

describe('GET /api/v1/asociados/historial (Endpoint Administrativo de Consulta de Historial)', () => {
  let app: INestApplication<App>;
  let asociadoRepository: Repository<Asociado>;
  let signAs: (role: Role) => string;
  let adminToken: string;
  const URL = `${BASE_URL}/historial`;

  const getHistorial = (query = '', token = adminToken) =>
    request(app.getHttpServer())
      .get(`${URL}${query}`)
      .set('Authorization', `Bearer ${token}`);

  const listar = async (query = '', token = adminToken) => {
    const res = await getHistorial(query, token);
    expect(res.status).toBe(200);
    return res.body as HistorialAsociadosResponseDto;
  };

  beforeAll(async () => {
    ({ app, asociadoRepository, signAs } = await crearAsociadosTestApp());
    adminToken = signAs(Role.ADMINISTRADORA);

    // Semilla: Asociados con combinación de activos e inactivos (anteriores)
    const semilla: Partial<Asociado>[] = [
      {
        nombre: 'Carlos',
        apellidos: 'Pérez Mora',
        cedula: '1-1234-0567',
        correoElectronico: 'carlos.perez@test.cr',
        activo: true,
        fechaRegistro: new Date('2024-01-10T08:00:00.000Z'),
        fechaInactivacion: null,
        motivoInactivacion: null,
      },
      {
        nombre: 'Ana',
        apellidos: 'Solís Vega',
        cedula: '2-0456-0789',
        correoElectronico: 'ana.solis@test.cr',
        activo: true,
        fechaRegistro: new Date('2025-03-15T09:00:00.000Z'),
        fechaInactivacion: null,
        motivoInactivacion: null,
      },
      {
        nombre: 'Luis',
        apellidos: 'Mora Castro',
        cedula: '3-0111-0222',
        correoElectronico: 'luis.mora@test.cr',
        activo: false,
        fechaRegistro: new Date('2023-05-01T10:00:00.000Z'),
        fechaInactivacion: new Date('2026-02-20T16:00:00.000Z'),
        motivoInactivacion: 'Venta de la propiedad',
      },
      {
        nombre: 'María',
        apellidos: 'Alfaro Rojas',
        cedula: '1-0555-0666',
        correoElectronico: 'maria.alfaro@test.cr',
        activo: false,
        fechaRegistro: new Date('2022-11-20T11:00:00.000Z'),
        fechaInactivacion: new Date('2025-12-01T12:00:00.000Z'),
        motivoInactivacion: 'Fallecimiento',
      },
      {
        nombre: 'Beatriz',
        apellidos: 'Castro Vargas',
        cedula: '4-0777-0888',
        correoElectronico: 'beatriz.castro@test.cr',
        activo: true,
        fechaRegistro: new Date('2026-02-01T08:30:00.000Z'),
        fechaInactivacion: null,
        motivoInactivacion: null,
      },
    ];

    for (const datos of semilla) {
      await asociadoRepository.save(asociadoRepository.create(datos));
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Seguridad, Autenticación y Permisos de Acceso', () => {
    it('debe rechazar solicitudes anónimas sin token (401)', async () => {
      const res = await request(app.getHttpServer()).get(URL);
      expect(res.status).toBe(401);
    });

    it.each([Role.FONTANERO, Role.ABONADO, Role.AYUDANTE])(
      'debe rechazar acceso a roles no administrativos: %s (403)',
      async (role) => {
        const token = signAs(role);
        const res = await getHistorial('', token);
        expect(res.status).toBe(403);
      },
    );

    it.each([Role.ADMINISTRADORA, Role.SECRETARIA])(
      'debe permitir acceso al personal administrativo autorizado: %s (200)',
      async (role) => {
        const token = signAs(role);
        const res = await getHistorial('', token);
        expect(res.status).toBe(200);
      },
    );
  });

  describe('2. Estructura y Recuperación de Datos (Activos e Inactivos)', () => {
    it('debe incluir tanto asociados activos como inactivos en el historial', async () => {
      const response = await listar();

      expect(response.total).toBe(5);
      expect(response.data).toHaveLength(5);

      const estados = response.data.map((item) => item.activo);
      expect(estados).toContain(true);
      expect(estados).toContain(false);

      const activos = response.data.filter((item) => item.activo === true);
      const inactivos = response.data.filter((item) => item.activo === false);

      expect(activos.length).toBe(3);
      expect(inactivos.length).toBe(2);
    });

    it('cada elemento del historial debe mostrar nombre, apellidos, cédula, correo, estado y fechas históricas', async () => {
      const response = await listar();
      const inactivo = response.data.find((item) => item.cedula === '3-0111-0222');
      const activo = response.data.find((item) => item.cedula === '1-1234-0567');

      // Verificación de campos para inactivo
      expect(inactivo).toBeDefined();
      expect(inactivo).toMatchObject({
        nombre: 'Luis',
        apellidos: 'Mora Castro',
        cedula: '3-0111-0222',
        correo: 'luis.mora@test.cr',
        correoElectronico: 'luis.mora@test.cr',
        activo: false,
        estado: 'Inactivo',
        motivoInactivacion: 'Venta de la propiedad',
      });
      expect(inactivo?.fechaRegistro).toBeDefined();
      expect(inactivo?.fechaInactivacion).not.toBeNull();

      // Verificación de campos para activo
      expect(activo).toBeDefined();
      expect(activo).toMatchObject({
        nombre: 'Carlos',
        apellidos: 'Pérez Mora',
        cedula: '1-1234-0567',
        correo: 'carlos.perez@test.cr',
        correoElectronico: 'carlos.perez@test.cr',
        activo: true,
        estado: 'Activo',
        fechaInactivacion: null,
      });
      expect(activo?.fechaRegistro).toBeDefined();
    });

    it('los resultados deben venir ordenados por apellidos y nombre ascendentemente por defecto', async () => {
      const response = await listar();
      const apellidos = response.data.map((item) => item.apellidos);

      expect(apellidos).toEqual([
        'Alfaro Rojas',
        'Castro Vargas',
        'Mora Castro',
        'Pérez Mora',
        'Solís Vega',
      ]);
    });

    it('permite ordenar en sentido descendente (orden=DESC)', async () => {
      const response = await listar('?orden=DESC');
      const apellidos = response.data.map((item) => item.apellidos);

      expect(apellidos).toEqual([
        'Solís Vega',
        'Pérez Mora',
        'Mora Castro',
        'Castro Vargas',
        'Alfaro Rojas',
      ]);
    });
  });

  describe('3. Filtros y Búsqueda en el Historial', () => {
    it('filtra específicamente por nombre', async () => {
      const res = await listar('?nombre=Carlos');
      expect(res.total).toBe(1);
      expect(res.data[0].nombre).toBe('Carlos');
      expect(res.data[0].cedula).toBe('1-1234-0567');
    });

    it('filtra específicamente por apellidos', async () => {
      const res = await listar('?apellidos=Mora');
      // Coincide con Pérez Mora y Mora Castro
      expect(res.total).toBe(2);
      const nombres = res.data.map((item) => item.nombre).sort();
      expect(nombres).toEqual(['Carlos', 'Luis']);
    });

    it('filtra específicamente por cédula con guiones y sin guiones', async () => {
      const conGuiones = await listar('?cedula=3-0111-0222');
      expect(conGuiones.total).toBe(1);
      expect(conGuiones.data[0].cedula).toBe('3-0111-0222');

      const sinGuiones = await listar('?cedula=301110222');
      expect(sinGuiones.total).toBe(1);
      expect(sinGuiones.data[0].cedula).toBe('3-0111-0222');
    });

    it('filtra por estado mediante activo (true/false) o estado ("activo"/"inactivo")', async () => {
      const soloActivos = await listar('?activo=true');
      expect(soloActivos.total).toBe(3);
      expect(
        soloActivos.data.every(
          (a) => a.activo === true && a.estado === 'Activo',
        ),
      ).toBe(true);

      const porEstadoTexto = await listar('?estado=inactivo');
      expect(porEstadoTexto.total).toBe(2);
      expect(
        porEstadoTexto.data.every(
          (a) => a.activo === false && a.estado === 'Inactivo',
        ),
      ).toBe(true);
    });

    it('filtra por fecha de registro (exacta o rango)', async () => {
      const exacto = await listar('?fechaRegistro=2024-01-10');
      expect(exacto.total).toBe(1);
      expect(exacto.data[0].nombre).toBe('Carlos');

      const porRango = await listar(
        '?fechaRegistroDesde=2025-01-01&fechaRegistroHasta=2026-12-31',
      );
      // Ana (2025-03-15) y Beatriz (2026-02-01)
      expect(porRango.total).toBe(2);
      const cedulasRango = porRango.data.map((item) => item.cedula).sort();
      expect(cedulasRango).toEqual(['2-0456-0789', '4-0777-0888']);
    });

    it('filtra por fecha de inactivación (exacta o rango)', async () => {
      const inactivoExacto = await listar('?fechaInactivacion=2026-02-20');
      expect(inactivoExacto.total).toBe(1);
      expect(inactivoExacto.data[0].cedula).toBe('3-0111-0222');

      const inactivosRango = await listar(
        '?fechaInactivacionDesde=2025-11-01&fechaInactivacionHasta=2025-12-31',
      );
      expect(inactivosRango.total).toBe(1);
      expect(inactivosRango.data[0].cedula).toBe('1-0555-0666');
    });

    it('permite combinar múltiples filtros simultáneamente', async () => {
      // Combinar nombre + estado + fechaRegistroDesde
      const combinada = await listar(
        '?nombre=Ana&estado=activo&fechaRegistroDesde=2025-01-01',
      );
      expect(combinada.total).toBe(1);
      expect(combinada.data[0]).toMatchObject({
        nombre: 'Ana',
        apellidos: 'Solís Vega',
        activo: true,
        estado: 'Activo',
      });
    });

    it('maneja consultas sin resultados devolviendo array vacío y total 0 (200 OK)', async () => {
      const sinResultados = await listar('?nombre=NombreInexistenteXYZ');
      expect(sinResultados).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });

      const combinadaVacia = await listar(
        '?nombre=Carlos&estado=inactivo',
      );
      expect(combinadaVacia).toEqual({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });
    });

    it('permite búsqueda general y paginación en el historial', async () => {
      const porSearch = await listar('?search=Solís');
      expect(porSearch.total).toBe(1);
      expect(porSearch.data[0].nombre).toBe('Ana');

      const pagina1 = await listar('?page=1&limit=2');
      expect(pagina1.data).toHaveLength(2);
      expect(pagina1.total).toBe(5);
      expect(pagina1.page).toBe(1);
      expect(pagina1.limit).toBe(2);
      expect(pagina1.totalPages).toBe(3);
    });

    it.each([
      '?page=0',
      '?limit=0',
      '?limit=101',
      '?activo=quizas',
      '?estado=quizas',
      '?orden=INVALIDO',
      '?fechaRegistro=2026/01/01',
      '?fechaRegistroDesde=invalido',
      '?fechaInactivacion=10-05-2026',
    ])('valida fechas y parámetros rechazando formatos inválidos %s (400)', async (query) => {
      const res = await getHistorial(query);
      expect(res.status).toBe(400);
    });
  });

  describe('4. Paginación y Estabilidad de Resultados en el Historial', () => {
    it('existe paginación configurada con page, limit, total y totalPages', async () => {
      const res = await listar('?page=1&limit=2');
      expect(res.data).toHaveLength(2);
      expect(res.total).toBe(5);
      expect(res.page).toBe(1);
      expect(res.limit).toBe(2);
      expect(res.totalPages).toBe(3);
    });

    it('los filtros permanecen activos al cambiar de página', async () => {
      // Activos en semilla: Carlos (Pérez Mora), Ana (Solís Vega), Beatriz (Castro Vargas) -> 3 activos
      // Con limit=2 y activo=true:
      const p1 = await listar('?activo=true&limit=2&page=1');
      expect(p1.total).toBe(3);
      expect(p1.totalPages).toBe(2);
      expect(p1.data).toHaveLength(2);
      expect(p1.data.every((a) => a.activo === true)).toBe(true);

      const p2 = await listar('?activo=true&limit=2&page=2');
      expect(p2.total).toBe(3);
      expect(p2.totalPages).toBe(2);
      expect(p2.data).toHaveLength(1);
      expect(p2.data.every((a) => a.activo === true)).toBe(true);

      // Comprobar que los elementos de p1 y p2 no se solapan y suman el total de activos
      const cedulasP1 = p1.data.map((a) => a.cedula);
      const cedulasP2 = p2.data.map((a) => a.cedula);
      expect(cedulasP1).not.toContain(cedulasP2[0]);
      expect([...cedulasP1, ...cedulasP2].sort()).toEqual([
        '1-1234-0567',
        '2-0456-0789',
        '4-0777-0888',
      ]);
    });

    it('devuelve la cantidad total exacta de resultados independientemente de la página solicitada', async () => {
      const p1 = await listar('?page=1&limit=1');
      const p3 = await listar('?page=3&limit=1');
      const p5 = await listar('?page=5&limit=1');

      expect(p1.total).toBe(5);
      expect(p3.total).toBe(5);
      expect(p5.total).toBe(5);
    });

    it('el orden es completamente estable y determinista entre páginas consecutivas', async () => {
      // Obtener todos los asociados de una sola vez
      const todos = await listar('?limit=100');
      const ordenGlobal = todos.data.map((a) => a.cedula);

      // Recorrerlos página por página con limit=1
      const recolectadosPaginaPorPagina: string[] = [];
      for (let p = 1; p <= todos.total; p++) {
        const pag = await listar(`?limit=1&page=${p}`);
        expect(pag.data).toHaveLength(1);
        recolectadosPaginaPorPagina.push(pag.data[0].cedula);
      }

      // La secuencia obtenida página por página debe ser exactamente idéntica al orden global
      expect(recolectadosPaginaPorPagina).toEqual(ordenGlobal);
    });

    it('devuelve lista vacía cuando la página solicitada está fuera de rango', async () => {
      const res = await listar('?page=10&limit=2');
      expect(res.data).toEqual([]);
      expect(res.total).toBe(5);
      expect(res.totalPages).toBe(3);
      expect(res.page).toBe(10);
    });
  });

  describe('5. Consulta de Solo Lectura (Garantía de No Modificación)', () => {
    it('la ejecución de la consulta no altera el conteo ni la información de la base de datos', async () => {
      const conteoAntes = await asociadoRepository.count();

      await listar();
      await listar('?activo=true');
      await listar('?search=Luis');
      await listar('?page=2&limit=2');

      const conteoDespues = await asociadoRepository.count();
      expect(conteoDespues).toBe(conteoAntes);
    });
  });
});
