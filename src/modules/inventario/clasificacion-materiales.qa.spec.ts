import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { Material } from './entities/material.entity';
import { DocumentoMovimientoInventario } from './entities/documento-movimiento-inventario.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';
import { InventarioModule } from './inventario.module';

const clasificacionQaTypeOrmModule = TypeOrmModule.forRoot({
  type: 'sqljs',
  autoSave: false,
  dropSchema: true,
  entities: [Usuario, Material, CategoriaMaterial, Proveedor, MovimientoInventario, DocumentoMovimientoInventario],
  synchronize: true,
});

type CategoriaResponseBody = {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

type PaginatedCategoriasResponse = {
  data: CategoriaResponseBody[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type MaterialResponseBody = {
  id: number;
  nombre: string;
  descripcion: string | null;
  unidadMedida: string;
  ubicacion: string | null;
  stockMinimo: number;
  stockActual: number;
  activo: boolean;
  idCategoria: number | null;
  categoria?: CategoriaResponseBody | null;
  createdAt: string;
  updatedAt: string;
};

type PaginatedMaterialesResponse = {
  data: MaterialResponseBody[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

describe('Backlog 3.2: Clasificación de Materiales — QA Integral, Integración y Base de Datos', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const signAs = (role: Role | string, sub = '1') => {
    const payload: JwtPayload = {
      sub,
      email: 'qa.clasificacion@asadasanjuan.cr',
      role: role as Role,
      name: 'Tester Clasificación',
    };
    return jwtService.sign(payload);
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig],
        }),
        clasificacionQaTypeOrmModule,
        AuthModule,
        InventarioModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    jwtService = moduleRef.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // BLOQUE 1: Gestión de Categorías (CRUD y Estados)
  // =========================================================================
  describe('1. Gestión de Categorías de Materiales', () => {
    let categoriaTuberiasId: number;

    it('crea una categoría válida y confirma que nace activa y persistida', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/categorias')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Tuberías',
          descripcion: 'Tuberías de PVC y polietileno de alta densidad',
        });

      expect(response.status).toBe(HttpStatus.CREATED);
      const body = response.body as CategoriaResponseBody;
      expect(body.id).toBeDefined();
      expect(body.nombre).toBe('Tuberías');
      expect(body.descripcion).toBe(
        'Tuberías de PVC y polietileno de alta densidad',
      );
      expect(body.activo).toBe(true);
      categoriaTuberiasId = body.id;
    });

    it('rechaza la creación de una categoría sin nombre o con cadena vacía (400 Bad Request)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const resSinNombre = await request(app.getHttpServer())
        .post('/api/v1/inventario/categorias')
        .set('Authorization', `Bearer ${token}`)
        .send({
          descripcion: 'Sin nombre asignado',
        });
      expect(resSinNombre.status).toBe(HttpStatus.BAD_REQUEST);

      const resNombreVacio = await request(app.getHttpServer())
        .post('/api/v1/inventario/categorias')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: '   ',
        });
      expect(resNombreVacio.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('rechaza nombres que excedan 100 caracteres o descripciones mayores a 500 (400 Bad Request)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const resNombreLargo = await request(app.getHttpServer())
        .post('/api/v1/inventario/categorias')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'T'.repeat(101),
        });
      expect(resNombreLargo.status).toBe(HttpStatus.BAD_REQUEST);

      const resDescLarga = await request(app.getHttpServer())
        .post('/api/v1/inventario/categorias')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Válvulas',
          descripcion: 'D'.repeat(501),
        });
      expect(resDescLarga.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('rechaza nombres duplicados insensible a mayúsculas y espacios (409 Conflict)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/categorias')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: '  tuberías  ',
        });

      expect(response.status).toBe(HttpStatus.CONFLICT);
    });

    it('consulta el listado de categorías con soporte de paginación y búsqueda', async () => {
      const token = signAs(Role.SECRETARIA);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/categorias?nombre=tube')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.OK);
      const body = response.body as PaginatedCategoriasResponse;
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      expect(body.data.some((c) => c.nombre === 'Tuberías')).toBe(true);
    });

    it('consulta el detalle de una categoría por su ID', async () => {
      const token = signAs(Role.FONTANERO);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventario/categorias/${categoriaTuberiasId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.OK);
      const body = response.body as CategoriaResponseBody;
      expect(body.id).toBe(categoriaTuberiasId);
      expect(body.nombre).toBe('Tuberías');
    });

    it('retorna 404 Not Found al consultar una categoría inexistente', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/categorias/999999')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.NOT_FOUND);
    });

    it('actualiza el nombre y la descripción de una categoría', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/inventario/categorias/${categoriaTuberiasId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Tuberías y Mangueras',
          descripcion: 'Conductos de agua potable y mangueras PEAD',
        });

      expect(response.status).toBe(HttpStatus.OK);
      const body = response.body as CategoriaResponseBody;
      expect(body.nombre).toBe('Tuberías y Mangueras');
      expect(body.descripcion).toBe(
        'Conductos de agua potable y mangueras PEAD',
      );
    });

    it('desactiva una categoría conservándola en la base de datos', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/inventario/categorias/${categoriaTuberiasId}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });

      expect(response.status).toBe(HttpStatus.OK);
      const body = response.body as CategoriaResponseBody;
      expect(body.activo).toBe(false);

      // Sigue existiendo en la base de datos
      const checkRes = await request(app.getHttpServer())
        .get(`/api/v1/inventario/categorias/${categoriaTuberiasId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(checkRes.status).toBe(HttpStatus.OK);
      expect((checkRes.body as CategoriaResponseBody).activo).toBe(false);
    });

    it('reactiva la categoría exitosamente aceptando valor booleano o "Activo"', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/inventario/categorias/${categoriaTuberiasId}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: 'Activo' });

      expect(response.status).toBe(HttpStatus.OK);
      const body = response.body as CategoriaResponseBody;
      expect(body.activo).toBe(true);
    });
  });

  // =========================================================================
  // BLOQUE 2: Clasificación de Materiales (Relación 1 a N)
  // =========================================================================
  describe('2. Clasificación de Materiales e Integridad Referencial', () => {
    let catValvulasId: number;
    let catAccesoriosId: number;
    let catInactivaId: number;
    let materialId: number;

    beforeAll(async () => {
      const token = signAs(Role.ADMINISTRADORA);

      // Crear categorías para pruebas de clasificación
      const resValvulas = await request(app.getHttpServer())
        .post('/api/v1/inventario/categorias')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Válvulas',
          descripcion: 'Válvulas de corte y retención',
        });
      catValvulasId = (resValvulas.body as CategoriaResponseBody).id;

      const resAccesorios = await request(app.getHttpServer())
        .post('/api/v1/inventario/categorias')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Accesorios',
          descripcion: 'Codos, uniones y adaptadores',
        });
      catAccesoriosId = (resAccesorios.body as CategoriaResponseBody).id;

      const resInactiva = await request(app.getHttpServer())
        .post('/api/v1/inventario/categorias')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Categoría Antigua Obsoleta' });
      catInactivaId = (resInactiva.body as CategoriaResponseBody).id;

      // Desactivar la categoría obsoleta
      await request(app.getHttpServer())
        .patch(`/api/v1/inventario/categorias/${catInactivaId}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });
    });

    it('registra un material asociándole una categoría activa válida (idCategoria)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Válvula de compuerta 1/2 pulgada',
          unidadMedida: 'Unidad',
          stockMinimo: 5,
          idCategoria: catValvulasId,
        });

      expect(response.status).toBe(HttpStatus.CREATED);
      const body = response.body as MaterialResponseBody;
      expect(body.id).toBeDefined();
      expect(body.idCategoria).toBe(catValvulasId);
      expect(body.categoria).toBeDefined();
      expect(body.categoria?.id).toBe(catValvulasId);
      expect(body.categoria?.nombre).toBe('Válvulas');
      materialId = body.id;
    });

    it('registra un material utilizando el alias categoriaId para clientes frontend', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Codo PVC 90 x 1/2',
          unidadMedida: 'Unidad',
          stockMinimo: 10,
          categoriaId: catAccesoriosId,
        });

      expect(response.status).toBe(HttpStatus.CREATED);
      const body = response.body as MaterialResponseBody;
      expect(body.idCategoria).toBe(catAccesoriosId);
      expect(body.categoria?.nombre).toBe('Accesorios');
    });

    it('retorna la información de categoría anidada en la consulta por ID y en listado', async () => {
      const token = signAs(Role.FONTANERO);

      const resDetail = await request(app.getHttpServer())
        .get(`/api/v1/inventario/materiales/${materialId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(resDetail.status).toBe(HttpStatus.OK);
      const bodyDetail = resDetail.body as MaterialResponseBody;
      expect(bodyDetail.idCategoria).toBe(catValvulasId);
      expect(bodyDetail.categoria?.nombre).toBe('Válvulas');

      const resList = await request(app.getHttpServer())
        .get(`/api/v1/inventario/materiales?idCategoria=${catValvulasId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(resList.status).toBe(HttpStatus.OK);
      const bodyList = resList.body as PaginatedMaterialesResponse;
      expect(bodyList.data.some((m) => m.id === materialId)).toBe(true);
      expect(bodyList.data.every((m) => m.idCategoria === catValvulasId)).toBe(
        true,
      );
    });

    it('permite reasignar el material a otra categoría activa', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/inventario/materiales/${materialId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          idCategoria: catAccesoriosId,
        });

      expect(response.status).toBe(HttpStatus.OK);
      const body = response.body as MaterialResponseBody;
      expect(body.idCategoria).toBe(catAccesoriosId);
      expect(body.categoria?.nombre).toBe('Accesorios');
    });

    it('permite desvincular un material de su categoría enviando idCategoria: null', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/inventario/materiales/${materialId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          idCategoria: null,
        });

      expect(response.status).toBe(HttpStatus.OK);
      const body = response.body as MaterialResponseBody;
      expect(body.idCategoria).toBeNull();
      expect(body.categoria).toBeNull();
    });

    it('rechaza con 404 Not Found al intentar asignar una categoría inexistente', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const resPost = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Material con Categoria Fantasma',
          unidadMedida: 'Unidad',
          idCategoria: 888888,
        });
      expect(resPost.status).toBe(HttpStatus.NOT_FOUND);

      const resPatch = await request(app.getHttpServer())
        .patch(`/api/v1/inventario/materiales/${materialId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          idCategoria: 888888,
        });
      expect(resPatch.status).toBe(HttpStatus.NOT_FOUND);
    });

    it('rechaza con 400 Bad Request al intentar asignar una categoría inactiva a un nuevo material', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Material con Categoria Inactiva',
          unidadMedida: 'Unidad',
          idCategoria: catInactivaId,
        });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('rechaza con 400 Bad Request al intentar reasignar un material existente a una categoría inactiva', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/inventario/materiales/${materialId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          idCategoria: catInactivaId,
        });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('preserva la relación histórica de materiales cuando la categoría asignada se desactiva con posterioridad', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      // Asignar catValvulas al material
      await request(app.getHttpServer())
        .patch(`/api/v1/inventario/materiales/${materialId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ idCategoria: catValvulasId });

      // Desactivar catValvulas
      await request(app.getHttpServer())
        .patch(`/api/v1/inventario/categorias/${catValvulasId}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });

      // Consultar el material: Debe seguir manteniendo su relación con catValvulas
      const resDetail = await request(app.getHttpServer())
        .get(`/api/v1/inventario/materiales/${materialId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(resDetail.status).toBe(HttpStatus.OK);
      const bodyDetail = resDetail.body as MaterialResponseBody;
      expect(bodyDetail.idCategoria).toBe(catValvulasId);
      expect(bodyDetail.categoria?.nombre).toBe('Válvulas');
      expect(bodyDetail.categoria?.activo).toBe(false);

      // Editar otro campo del material (ej. ubicacion) debe seguir funcionando sin bloquearse por la categoría inactiva
      const resUpdateOtherField = await request(app.getHttpServer())
        .patch(`/api/v1/inventario/materiales/${materialId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ ubicacion: 'Estante Especial de Trazabilidad' });

      expect(resUpdateOtherField.status).toBe(HttpStatus.OK);
      expect((resUpdateOtherField.body as MaterialResponseBody).ubicacion).toBe(
        'Estante Especial de Trazabilidad',
      );
    });

    it('excluye categorías inactivas en el filtro de selector (?activo=true) y las reincorpora al reactivar', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      // 1. Con catValvulas inactiva, el selector de activas NO debe contenerla
      const resSoloActivas = await request(app.getHttpServer())
        .get('/api/v1/inventario/categorias?activo=true')
        .set('Authorization', `Bearer ${token}`);

      expect(resSoloActivas.status).toBe(HttpStatus.OK);
      const dataActivas = (resSoloActivas.body as PaginatedCategoriasResponse)
        .data;
      expect(dataActivas.some((c) => c.id === catValvulasId)).toBe(false);

      // 2. Reactivar catValvulas
      await request(app.getHttpServer())
        .patch(`/api/v1/inventario/categorias/${catValvulasId}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: true });

      // 3. Ahora vuelve a aparecer disponible en el selector
      const resVuelveActiva = await request(app.getHttpServer())
        .get('/api/v1/inventario/categorias?activo=true')
        .set('Authorization', `Bearer ${token}`);

      expect(resVuelveActiva.status).toBe(HttpStatus.OK);
      const dataReactivada = (
        resVuelveActiva.body as PaginatedCategoriasResponse
      ).data;
      expect(dataReactivada.some((c) => c.id === catValvulasId)).toBe(true);
    });
  });

  // =========================================================================
  // BLOQUE 3: Seguridad, Autenticación y Matriz de Roles (RBAC)
  // =========================================================================
  describe('3. Matriz de Permisos y Seguridad (RBAC)', () => {
    it('rechaza con 401 Unauthorized sin token JWT en todos los endpoints de categorías y materiales', async () => {
      const resCatPost = await request(app.getHttpServer())
        .post('/api/v1/inventario/categorias')
        .send({ nombre: 'Intento Anónimo' });
      expect(resCatPost.status).toBe(HttpStatus.UNAUTHORIZED);

      const resCatGet = await request(app.getHttpServer()).get(
        '/api/v1/inventario/categorias',
      );
      expect(resCatGet.status).toBe(HttpStatus.UNAUTHORIZED);

      const resMatPost = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .send({ nombre: 'Intento Anónimo', unidadMedida: 'U' });
      expect(resMatPost.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 401 Unauthorized cuando el token está mal formado o corrupto', async () => {
      const resTokenInvalido = await request(app.getHttpServer())
        .get('/api/v1/inventario/categorias')
        .set('Authorization', 'Bearer token_manipulado_o_expirado_123');
      expect(resTokenInvalido.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('permite consulta a FONTANERO y SECRETARIA pero bloquea creación y edición de categorías con 403 Forbidden', async () => {
      for (const rolLectura of [Role.FONTANERO, Role.SECRETARIA]) {
        const token = signAs(rolLectura);

        // Lectura permitida
        const resGet = await request(app.getHttpServer())
          .get('/api/v1/inventario/categorias')
          .set('Authorization', `Bearer ${token}`);
        expect(resGet.status).toBe(HttpStatus.OK);

        // Creación prohibida
        const resPost = await request(app.getHttpServer())
          .post('/api/v1/inventario/categorias')
          .set('Authorization', `Bearer ${token}`)
          .send({ nombre: 'Categoría No Autorizada' });
        expect(resPost.status).toBe(HttpStatus.FORBIDDEN);

        // Actualización prohibida
        const resPut = await request(app.getHttpServer())
          .put('/api/v1/inventario/categorias/1')
          .set('Authorization', `Bearer ${token}`)
          .send({ nombre: 'Intento de Edición' });
        expect(resPut.status).toBe(HttpStatus.FORBIDDEN);

        // Cambio de estado prohibido
        const resEstado = await request(app.getHttpServer())
          .patch('/api/v1/inventario/categorias/1/estado')
          .set('Authorization', `Bearer ${token}`)
          .send({ activo: false });
        expect(resEstado.status).toBe(HttpStatus.FORBIDDEN);
      }
    });

    it('bloquea a usuarios con rol ABONADO con 403 Forbidden en todas las operaciones', async () => {
      const token = signAs('ABONADO');

      const resCat = await request(app.getHttpServer())
        .get('/api/v1/inventario/categorias')
        .set('Authorization', `Bearer ${token}`);
      expect(resCat.status).toBe(HttpStatus.FORBIDDEN);

      const resMat = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`);
      expect(resMat.status).toBe(HttpStatus.FORBIDDEN);
    });
  });
});
