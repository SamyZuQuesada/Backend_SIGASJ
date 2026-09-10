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
import { InventarioModule } from './inventario.module';

const inventarioQaTypeOrmModule = TypeOrmModule.forRoot({
  type: 'sqljs',
  autoSave: false,
  dropSchema: true,
  entities: [Usuario, Material, CategoriaMaterial],
  synchronize: true,
});

type MaterialResponseBody = {
  id: number;
  nombre: string;
  descripcion: string | null;
  unidadMedida: string;
  ubicacion: string | null;
  stockMinimo: number;
  stockActual: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

type PaginatedMaterialsResponse = {
  data: MaterialResponseBody[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

describe('Gestión de Materiales de Bodega — QA Integral y Validación Funcional', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const signAs = (role: Role | string, sub = '1') => {
    const payload: JwtPayload = {
      sub,
      email: 'usuario.qa@asadasanjuan.cr',
      role: role as Role,
      name: 'Usuario QA Backend',
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
        inventarioQaTypeOrmModule,
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
  // PILAR 1: Registro de Materiales
  // =========================================================================
  describe('1. Registro de Materiales (POST /api/v1/inventario/materiales)', () => {
    it('registra un material con información válida (stockActual=0, activo=true)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Tubo PVC 1/2 pulgada Presión',
          descripcion: 'Tubo para agua potable alta presión',
          unidadMedida: 'Tubo',
          ubicacion: 'Bodega Principal - Estante 1',
          stockMinimo: 10,
        });

      expect(response.status).toBe(HttpStatus.CREATED);
      const body = response.body as MaterialResponseBody;
      expect(body.id).toBeDefined();
      expect(body.nombre).toBe('Tubo PVC 1/2 pulgada Presión');
      expect(body.unidadMedida).toBe('Tubo');
      expect(body.stockMinimo).toBe(10);
      expect(body.stockActual).toBe(0); // Existencia física nace en cero
      expect(body.activo).toBe(true); // Activo por defecto
    });

    it('rechaza el registro si falta el nombre o la unidad de medida', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const resSinNombre = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({ unidadMedida: 'Unidad' });
      expect(resSinNombre.status).toBe(HttpStatus.BAD_REQUEST);

      const resSinUnidad = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Codo PVC 90' });
      expect(resSinUnidad.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('rechaza el registro si los datos exceden límites o stockMinimo es negativo', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const resStockNegativo = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Abrazadera',
          unidadMedida: 'Unidad',
          stockMinimo: -5,
        });
      expect(resStockNegativo.status).toBe(HttpStatus.BAD_REQUEST);

      const resNombreLargo = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'A'.repeat(151),
          unidadMedida: 'Unidad',
        });
      expect(resNombreLargo.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('rechaza el registro con 409 Conflict si ya existe un material con el mismo nombre', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      // Intento de duplicado insensible a mayúsculas y espacios
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: '  tubo pvc 1/2 pulgada presión  ',
          unidadMedida: 'Tubo',
        });

      expect(response.status).toBe(HttpStatus.CONFLICT);
    });
  });

  // =========================================================================
  // PILAR 2: Listado, Paginación y Búsqueda
  // =========================================================================
  describe('2. Listado de Materiales (GET /api/v1/inventario/materiales)', () => {
    let createdId2: number;

    beforeAll(async () => {
      const token = signAs(Role.ADMINISTRADORA);
      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Válvula de bola 1/2 pulgada',
          unidadMedida: 'Unidad',
          stockMinimo: 5,
        });
      const body = res.body as MaterialResponseBody;
      createdId2 = body.id;
      expect(createdId2).toBeDefined();
    });

    it('permite consultar el listado a ADMINISTRADORA, SECRETARIA y FONTANERO', async () => {
      for (const role of [
        Role.ADMINISTRADORA,
        Role.SECRETARIA,
        Role.FONTANERO,
      ]) {
        const token = signAs(role);
        const res = await request(app.getHttpServer())
          .get('/api/v1/inventario/materiales')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(HttpStatus.OK);
        const body = res.body as PaginatedMaterialsResponse;
        expect(body.total).toBeGreaterThanOrEqual(2);
        expect(Array.isArray(body.data)).toBe(true);
      }
    });

    it('aplica búsqueda parcial por nombre insensible a mayúsculas', async () => {
      const token = signAs(Role.FONTANERO);
      const res = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales?nombre=válvula')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(HttpStatus.OK);
      const body = res.body as PaginatedMaterialsResponse;
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      expect(body.data.some((m) => m.nombre.includes('Válvula'))).toBe(true);
    });

    it('maneja lista vacía sin errores cuando no hay coincidencias', async () => {
      const token = signAs(Role.ADMINISTRADORA);
      const res = await request(app.getHttpServer())
        .get(
          '/api/v1/inventario/materiales?nombre=articulo_totalmente_inexistente',
        )
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(HttpStatus.OK);
      const body = res.body as PaginatedMaterialsResponse;
      expect(body.data).toEqual([]);
      expect(body.total).toBe(0);
      expect(body.totalPages).toBe(0);
    });

    it('aplica paginación correctamente con page y limit', async () => {
      const token = signAs(Role.ADMINISTRADORA);
      const res = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales?page=1&limit=1')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(HttpStatus.OK);
      const body = res.body as PaginatedMaterialsResponse;
      expect(body.data.length).toBe(1);
      expect(body.limit).toBe(1);
      expect(body.page).toBe(1);
      expect(body.totalPages).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // PILAR 3: Detalle de Material por ID
  // =========================================================================
  describe('3. Detalle de Material (GET /api/v1/inventario/materiales/:id)', () => {
    let materialId: number;

    beforeAll(async () => {
      const token = signAs(Role.ADMINISTRADORA);
      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Codo PVC 90 x 1/2 pulgada',
          unidadMedida: 'Unidad',
          ubicacion: 'Caja 3',
        });
      const body = res.body as MaterialResponseBody;
      materialId = body.id;
    });

    it('obtiene la información completa del material por su ID', async () => {
      const token = signAs(Role.SECRETARIA);
      const res = await request(app.getHttpServer())
        .get(`/api/v1/inventario/materiales/${materialId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(HttpStatus.OK);
      const body = res.body as MaterialResponseBody;
      expect(body.id).toBe(materialId);
      expect(body.nombre).toBe('Codo PVC 90 x 1/2 pulgada');
      expect(body.ubicacion).toBe('Caja 3');
      expect(body.stockActual).toBe(0);
      expect(body.activo).toBe(true);
    });

    it('retorna 404 Not Found ante un material inexistente', async () => {
      const token = signAs(Role.ADMINISTRADORA);
      const res = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales/999999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
    });

    it('retorna 400 Bad Request ante un ID no numérico', async () => {
      const token = signAs(Role.ADMINISTRADORA);
      const res = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales/no_es_numero')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  // =========================================================================
  // PILAR 4: Edición e Inmutabilidad de Stock
  // =========================================================================
  describe('4. Edición de Materiales (PUT / PATCH)', () => {
    let editMaterialId: number;

    beforeAll(async () => {
      const token = signAs(Role.ADMINISTRADORA);
      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Adaptador Macho PVC 1/2 pulgada',
          unidadMedida: 'Unidad',
          stockMinimo: 8,
        });
      const body = res.body as MaterialResponseBody;
      editMaterialId = body.id;
    });

    it('permite actualizar campos descriptivos mediante PUT', async () => {
      const token = signAs(Role.ADMINISTRADORA);
      const res = await request(app.getHttpServer())
        .put(`/api/v1/inventario/materiales/${editMaterialId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Adaptador Macho PVC 1/2 pulgada Reforzado',
          descripcion: 'Actualizado para soportar 200 PSI',
          unidadMedida: 'Pieza',
          ubicacion: 'Estante D',
          stockMinimo: 15,
        });

      expect(res.status).toBe(HttpStatus.OK);
      const body = res.body as MaterialResponseBody;
      expect(body.nombre).toBe('Adaptador Macho PVC 1/2 pulgada Reforzado');
      expect(body.descripcion).toBe('Actualizado para soportar 200 PSI');
      expect(body.unidadMedida).toBe('Pieza');
      expect(body.ubicacion).toBe('Estante D');
      expect(body.stockMinimo).toBe(15);
      expect(body.stockActual).toBe(0); // Inmutable
    });

    it('permite actualizar parcialmente mediante PATCH', async () => {
      const token = signAs(Role.ADMINISTRADORA);
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/inventario/materiales/${editMaterialId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          stockMinimo: 22,
        });

      expect(res.status).toBe(HttpStatus.OK);
      const body = res.body as MaterialResponseBody;
      expect(body.stockMinimo).toBe(22);
    });

    it('REGLA CRÍTICA: rechaza con 400 Bad Request cualquier intento de alterar stockActual', async () => {
      const token = signAs(Role.ADMINISTRADORA);
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/inventario/materiales/${editMaterialId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          stockActual: 100,
        });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('rechaza con 409 Conflict si el nuevo nombre colisiona con otro material', async () => {
      const token = signAs(Role.ADMINISTRADORA);
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/inventario/materiales/${editMaterialId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Tubo PVC 1/2 pulgada Presión', // Ya registrado en el Pilar 1
        });

      expect(res.status).toBe(HttpStatus.CONFLICT);
    });
  });

  // =========================================================================
  // PILAR 5: Activación y Desactivación Lógica (Sin Borrado Físico)
  // =========================================================================
  describe('5. Activación / Desactivación Lógica (PATCH /:id/estado)', () => {
    let statusMaterialId: number;

    beforeAll(async () => {
      const token = signAs(Role.ADMINISTRADORA);
      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Unión Universal PVC 1/2 pulgada',
          unidadMedida: 'Unidad',
        });
      const body = res.body as MaterialResponseBody;
      statusMaterialId = body.id;
    });

    it('desactiva un material exitosamente y conserva sus datos (no se borra físicamente)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      // Desactivar
      const resPatch = await request(app.getHttpServer())
        .patch(`/api/v1/inventario/materiales/${statusMaterialId}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });

      expect(resPatch.status).toBe(HttpStatus.OK);
      const bodyPatch = resPatch.body as MaterialResponseBody;
      expect(bodyPatch.activo).toBe(false);

      // Verificar que sigue existiendo en el detalle
      const resGet = await request(app.getHttpServer())
        .get(`/api/v1/inventario/materiales/${statusMaterialId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(resGet.status).toBe(HttpStatus.OK);
      const bodyGet = resGet.body as MaterialResponseBody;
      expect(bodyGet.id).toBe(statusMaterialId);
      expect(bodyGet.activo).toBe(false);
    });

    it('excluye el material desactivado al consultar con ?activo=true', async () => {
      const token = signAs(Role.ADMINISTRADORA);
      const res = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales?activo=true')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(HttpStatus.OK);
      const body = res.body as PaginatedMaterialsResponse;
      expect(body.data.some((m) => m.id === statusMaterialId)).toBe(false);
    });

    it('incluye el material desactivado al consultar con ?activo=false', async () => {
      const token = signAs(Role.ADMINISTRADORA);
      const res = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales?activo=false')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(HttpStatus.OK);
      const body = res.body as PaginatedMaterialsResponse;
      expect(body.data.some((m) => m.id === statusMaterialId)).toBe(true);
    });

    it('reactiva el material exitosamente aceptando "Activo"', async () => {
      const token = signAs(Role.ADMINISTRADORA);
      const resPatch = await request(app.getHttpServer())
        .patch(`/api/v1/inventario/materiales/${statusMaterialId}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: 'Activo' });

      expect(resPatch.status).toBe(HttpStatus.OK);
      const bodyPatch = resPatch.body as MaterialResponseBody;
      expect(bodyPatch.activo).toBe(true);

      // Ahora sí debe figurar en ?activo=true
      const resGet = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales?activo=true')
        .set('Authorization', `Bearer ${token}`);

      const bodyGet = resGet.body as PaginatedMaterialsResponse;
      expect(bodyGet.data.some((m) => m.id === statusMaterialId)).toBe(true);
    });
  });

  // =========================================================================
  // PILAR 6: Seguridad, Tokens y Matriz de Roles (RBAC)
  // =========================================================================
  describe('6. Seguridad y Control de Acceso RBAC (401 y 403)', () => {
    it('rechaza con 401 Unauthorized sin token en todos los endpoints privados', async () => {
      const postRes = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .send({ nombre: 'X', unidadMedida: 'U' });
      expect(postRes.status).toBe(HttpStatus.UNAUTHORIZED);

      const getListRes = await request(app.getHttpServer()).get(
        '/api/v1/inventario/materiales',
      );
      expect(getListRes.status).toBe(HttpStatus.UNAUTHORIZED);

      const getDetailRes = await request(app.getHttpServer()).get(
        '/api/v1/inventario/materiales/1',
      );
      expect(getDetailRes.status).toBe(HttpStatus.UNAUTHORIZED);

      const putRes = await request(app.getHttpServer())
        .put('/api/v1/inventario/materiales/1')
        .send({ nombre: 'X', unidadMedida: 'U' });
      expect(putRes.status).toBe(HttpStatus.UNAUTHORIZED);

      const patchRes = await request(app.getHttpServer())
        .patch('/api/v1/inventario/materiales/1')
        .send({ stockMinimo: 10 });
      expect(patchRes.status).toBe(HttpStatus.UNAUTHORIZED);

      const patchEstadoRes = await request(app.getHttpServer())
        .patch('/api/v1/inventario/materiales/1/estado')
        .send({ activo: false });
      expect(patchEstadoRes.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 401 Unauthorized cuando el token es inválido o está corrupto', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales')
        .set('Authorization', 'Bearer token_falso_invalido');

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 403 Forbidden cuando FONTANERO intenta registrar, editar o cambiar estado', async () => {
      const token = signAs(Role.FONTANERO);

      const postRes = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Intento Fontanero', unidadMedida: 'U' });
      expect(postRes.status).toBe(HttpStatus.FORBIDDEN);

      const patchRes = await request(app.getHttpServer())
        .patch('/api/v1/inventario/materiales/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ stockMinimo: 5 });
      expect(patchRes.status).toBe(HttpStatus.FORBIDDEN);

      const estadoRes = await request(app.getHttpServer())
        .patch('/api/v1/inventario/materiales/1/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });
      expect(estadoRes.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('rechaza con 403 Forbidden a un rol sin permisos como ABONADO en todos los endpoints', async () => {
      const token = signAs('ABONADO');

      const getRes = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.status).toBe(HttpStatus.FORBIDDEN);

      const postRes = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Intento Abonado', unidadMedida: 'U' });
      expect(postRes.status).toBe(HttpStatus.FORBIDDEN);
    });
  });
});
