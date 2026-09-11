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

const proveedoresQaTypeOrmModule = TypeOrmModule.forRoot({
  type: 'sqljs',
  autoSave: false,
  dropSchema: true,
  entities: [Usuario, Material, CategoriaMaterial, Proveedor, MovimientoInventario, DocumentoMovimientoInventario],
  synchronize: true,
});

type ProveedorResponseBody = {
  id: number;
  nombre: string;
  razonSocial: string | null;
  identificacion: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  personaContacto: string | null;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
};

type PaginatedProveedoresResponse = {
  data: ProveedorResponseBody[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

describe('Gestión de Proveedores de Inventario — QA Integral y Validación Funcional', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const signAs = (role: Role | string, sub = '1') => {
    const payload: JwtPayload = {
      sub,
      email: 'qa.proveedores@asadasanjuan.cr',
      role: role as Role,
      name: 'Tester Proveedores ASADA',
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
        proveedoresQaTypeOrmModule,
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

  describe('1. Registro de Proveedores (POST /api/v1/inventario/proveedores)', () => {
    it('registra exitosamente un nuevo proveedor con rol ADMINISTRADORA (201 Created)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/proveedores')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: '  Ferretería El Lagar  ',
          razonSocial: '  El Lagar S.A.  ',
          identificacion: '  3-101-112233  ',
          telefono: '  2680-1122  ',
          correo: '  VENTAS@LAGAR.CR  ',
          direccion: '  Nicoya, Guanacaste  ',
          personaContacto: '  Carlos Méndez  ',
        });

      expect(response.status).toBe(HttpStatus.CREATED);
      const body: ProveedorResponseBody = response.body;

      expect(body.id).toBeDefined();
      expect(body.nombre).toBe('Ferretería El Lagar');
      expect(body.razonSocial).toBe('El Lagar S.A.');
      expect(body.identificacion).toBe('3-101-112233');
      expect(body.telefono).toBe('2680-1122');
      expect(body.correo).toBe('ventas@lagar.cr');
      expect(body.direccion).toBe('Nicoya, Guanacaste');
      expect(body.personaContacto).toBe('Carlos Méndez');
      expect(body.activo).toBe(true);
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();
    });

    it('rechaza el registro si ya existe un proveedor con el mismo nombre (409 Conflict)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/proveedores')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'ferretería el lagar', // Mismo nombre en minúsculas
        });

      expect(response.status).toBe(HttpStatus.CONFLICT);
      expect(response.body.message).toContain('Ya existe un proveedor');
    });

    it('rechaza el registro si ya existe un proveedor con la misma identificación (409 Conflict)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/proveedores')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Distribuidora H2O Guanacaste',
          identificacion: '3-101-112233', // Misma identificación ya registrada
        });

      expect(response.status).toBe(HttpStatus.CONFLICT);
      expect(response.body.message).toContain('identificación');
    });

    it('rechaza con 400 Bad Request cuando el nombre falta o está en blanco', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/proveedores')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: '   ',
        });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('rechaza con 400 Bad Request si el correo tiene un formato inválido', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/proveedores')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Tubos y Conexiones del Pacífico',
          correo: 'correo_invalido_sin_arroba',
        });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('rechaza con 403 Forbidden cuando FONTANERO o SECRETARIA intentan registrar', async () => {
      const tokenFont = signAs(Role.FONTANERO);
      const resFont = await request(app.getHttpServer())
        .post('/api/v1/inventario/proveedores')
        .set('Authorization', `Bearer ${tokenFont}`)
        .send({ nombre: 'Intento Fontanero' });
      expect(resFont.status).toBe(HttpStatus.FORBIDDEN);

      const tokenSec = signAs(Role.SECRETARIA);
      const resSec = await request(app.getHttpServer())
        .post('/api/v1/inventario/proveedores')
        .set('Authorization', `Bearer ${tokenSec}`)
        .send({ nombre: 'Intento Secretaria' });
      expect(resSec.status).toBe(HttpStatus.FORBIDDEN);
    });
  });

  describe('2. Consulta y Listado de Proveedores (GET /api/v1/inventario/proveedores)', () => {
    beforeAll(async () => {
      const token = signAs(Role.ADMINISTRADORA);
      await request(app.getHttpServer())
        .post('/api/v1/inventario/proveedores')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Abastecedora San Juan',
          identificacion: '3-101-998877',
          telefono: '2680-3344',
        });

      await request(app.getHttpServer())
        .post('/api/v1/inventario/proveedores')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Válvulas y Medidores de Costa Rica',
          identificacion: '3-101-554433',
        });
    });

    it('permite a ADMINISTRADORA, SECRETARIA y FONTANERO consultar proveedores con paginación', async () => {
      const tokenSec = signAs(Role.SECRETARIA);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/proveedores?page=1&limit=10')
        .set('Authorization', `Bearer ${tokenSec}`);

      expect(response.status).toBe(HttpStatus.OK);
      const body: PaginatedProveedoresResponse = response.body;

      expect(body.total).toBeGreaterThanOrEqual(3);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(10);
      expect(body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('permite buscar proveedores por coincidencia parcial en nombre', async () => {
      const tokenFont = signAs(Role.FONTANERO);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/proveedores?nombre=Válvulas')
        .set('Authorization', `Bearer ${tokenFont}`);

      expect(response.status).toBe(HttpStatus.OK);
      const body: PaginatedProveedoresResponse = response.body;

      expect(body.total).toBe(1);
      expect(body.data[0]?.nombre).toBe('Válvulas y Medidores de Costa Rica');
    });

    it('permite buscar por término general search (nombre, razón social o identificación)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/proveedores?search=998877')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.OK);
      const body: PaginatedProveedoresResponse = response.body;

      expect(body.total).toBe(1);
      expect(body.data[0]?.nombre).toBe('Abastecedora San Juan');
    });

    it('maneja una lista vacía cuando ningún proveedor coincide con el filtro', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/proveedores?nombre=NoExisteAbsolutamenteNada')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.OK);
      const body: PaginatedProveedoresResponse = response.body;

      expect(body.total).toBe(0);
      expect(body.data).toHaveLength(0);
      expect(body.totalPages).toBe(0);
    });

    it('rechaza con 401 a usuarios sin token y 403 a roles no autorizados', async () => {
      const resSinToken = await request(app.getHttpServer()).get(
        '/api/v1/inventario/proveedores',
      );
      expect(resSinToken.status).toBe(HttpStatus.UNAUTHORIZED);

      const tokenNoAutorizado = signAs('ROL_NO_AUTORIZADO');
      const resNoAutorizado = await request(app.getHttpServer())
        .get('/api/v1/inventario/proveedores')
        .set('Authorization', `Bearer ${tokenNoAutorizado}`);
      expect(resNoAutorizado.status).toBe(HttpStatus.FORBIDDEN);
    });
  });

  describe('3. Consulta de Detalle por ID (GET /api/v1/inventario/proveedores/:id)', () => {
    it('retorna el detalle completo de un proveedor existente', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/proveedores/1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.id).toBe(1);
      expect(response.body.nombre).toBe('Ferretería El Lagar');
    });

    it('retorna 404 Not Found cuando el proveedor no existe', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/proveedores/9999')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.NOT_FOUND);
    });

    it('retorna 400 Bad Request cuando el ID no es numérico', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/proveedores/codigo-invalido')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('4. Actualización de Proveedores (PATCH /api/v1/inventario/proveedores/:id)', () => {
    it('permite actualizar campos comerciales y de contacto con rol ADMINISTRADORA (200 OK)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/proveedores/1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          telefono: '  2680-9999  ',
          direccion: '  Nueva dirección central  ',
          personaContacto: '  Ana Vega  ',
        });

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.telefono).toBe('2680-9999');
      expect(response.body.direccion).toBe('Nueva dirección central');
      expect(response.body.personaContacto).toBe('Ana Vega');
    });

    it('rechaza si el nuevo nombre colisiona con otro proveedor existente (409 Conflict)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/proveedores/1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Abastecedora San Juan', // Nombre ya usado por otro proveedor
        });

      expect(response.status).toBe(HttpStatus.CONFLICT);
    });

    it('retorna 404 Not Found si se intenta actualizar un proveedor que no existe', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/proveedores/9999')
        .set('Authorization', `Bearer ${token}`)
        .send({
          telefono: '2222-3333',
        });

      expect(response.status).toBe(HttpStatus.NOT_FOUND);
    });

    it('rechaza con 403 Forbidden a FONTANERO en actualización', async () => {
      const token = signAs(Role.FONTANERO);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/proveedores/1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          telefono: '8888-8888',
        });

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });
  });

  describe('5. Activación / Desactivación Lógica (PATCH /api/v1/inventario/proveedores/:id/estado)', () => {
    it('desactiva un proveedor con 200 OK (borrado lógico: activo=false)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/proveedores/1/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.activo).toBe(false);

      // Comprobar que permanece almacenado y consultable
      const detalle = await request(app.getHttpServer())
        .get('/api/v1/inventario/proveedores/1')
        .set('Authorization', `Bearer ${token}`);

      expect(detalle.status).toBe(HttpStatus.OK);
      expect(detalle.body.activo).toBe(false);
      expect(detalle.body.nombre).toBe('Ferretería El Lagar');
    });

    it('permite filtrar proveedores inactivos con ?activo=false', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/proveedores?activo=false')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.data.some((p: ProveedorResponseBody) => p.id === 1)).toBe(
        true,
      );
    });

    it('reactiva el proveedor exitosamente aceptando "Activo" (200 OK)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/proveedores/1/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: 'Activo' });

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.activo).toBe(true);
    });

    it('rechaza con 400 Bad Request si el valor de estado no es válido', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/proveedores/1/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: 'valor_invalido' });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('retorna 404 Not Found si el proveedor a cambiar estado no existe', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/proveedores/9999/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });

      expect(response.status).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('6. Integración con Materiales, Trazabilidad Histórica y Seguridad', () => {
    let idProveedorPrueba: number;
    let idMaterialPrueba: number;

    beforeAll(async () => {
      const token = signAs(Role.ADMINISTRADORA);

      // 1. Crear un proveedor exclusivo para las pruebas de integración
      const provRes = await request(app.getHttpServer())
        .post('/api/v1/inventario/proveedores')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Comercializadora de Tuberías del Norte',
          identificacion: '3-101-778899',
          telefono: '2680-7777',
          correo: 'contacto@tuberiasnorte.cr',
        });

      idProveedorPrueba = provRes.body.id;
    });

    it('registra un material asociando el proveedor activo existente (201 Created)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Tubo PVC 1 pulgada SDR 13.5 Integracion',
          unidadMedida: 'Tubo',
          stockMinimo: 15,
          idProveedor: idProveedorPrueba,
        });

      expect(response.status).toBe(HttpStatus.CREATED);
      expect(response.body.idProveedor).toBe(idProveedorPrueba);
      idMaterialPrueba = response.body.id;
    });

    it('consulta el material por ID y confirma que devuelva los datos del proveedor relacionado', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventario/materiales/${idMaterialPrueba}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.idProveedor).toBe(idProveedorPrueba);
      expect(response.body.proveedor).toBeDefined();
      expect(response.body.proveedor.nombre).toBe(
        'Comercializadora de Tuberías del Norte',
      );
    });

    it('rechaza el registro de un material si el proveedor asignado no existe (404 Not Found)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Válvula de Aire Inexistente',
          unidadMedida: 'Unidad',
          idProveedor: 99999,
        });

      expect(response.status).toBe(HttpStatus.NOT_FOUND);
      expect(response.body.message).toContain('El proveedor con ID 99999 no existe');
    });

    it('desactiva el proveedor y comprueba que NO se elimine físicamente (borrado lógico)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      // Desactivar el proveedor
      const desactRes = await request(app.getHttpServer())
        .patch(`/api/v1/inventario/proveedores/${idProveedorPrueba}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });

      expect(desactRes.status).toBe(HttpStatus.OK);
      expect(desactRes.body.activo).toBe(false);

      // El proveedor sigue existiendo en el sistema
      const provRes = await request(app.getHttpServer())
        .get(`/api/v1/inventario/proveedores/${idProveedorPrueba}`)
        .set('Authorization', `Bearer ${token}`);

      expect(provRes.status).toBe(HttpStatus.OK);
      expect(provRes.body.activo).toBe(false);
    });

    it('comprueba que el material ya existente conserva su relación con el proveedor desactivado (trazabilidad)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventario/materiales/${idMaterialPrueba}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.OK);
      expect(response.body.idProveedor).toBe(idProveedorPrueba);
      expect(response.body.proveedor).toBeDefined();
      expect(response.body.proveedor.activo).toBe(false);
    });

    it('rechaza asignar el proveedor inactivo a un NUEVO material (400 Bad Request)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Codo 90 PVC con Proveedor Inactivo',
          unidadMedida: 'Unidad',
          idProveedor: idProveedorPrueba,
        });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
      expect(response.body.message).toContain(
        'No se puede asignar un proveedor inactivo a un nuevo material',
      );
    });

    it('reactiva el proveedor y confirma que vuelve a estar disponible para nuevas asignaciones (200 OK)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      // Reactivar el proveedor
      const reactRes = await request(app.getHttpServer())
        .patch(`/api/v1/inventario/proveedores/${idProveedorPrueba}/estado`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: true });

      expect(reactRes.status).toBe(HttpStatus.OK);
      expect(reactRes.body.activo).toBe(true);

      // Ahora sí permite asociarlo a un nuevo material
      const matRes = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Codo 90 PVC con Proveedor Reactivado',
          unidadMedida: 'Unidad',
          idProveedor: idProveedorPrueba,
        });

      expect(matRes.status).toBe(HttpStatus.CREATED);
      expect(matRes.body.idProveedor).toBe(idProveedorPrueba);
    });

    it('rechaza solicitudes con token inválido o malformado (401 Unauthorized)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/proveedores')
        .set('Authorization', 'Bearer token_totalmente_invalido');

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 403 Forbidden cuando un rol no autorizado intenta desactivar un proveedor', async () => {
      const tokenFontanero = signAs(Role.FONTANERO);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/inventario/proveedores/${idProveedorPrueba}/estado`)
        .set('Authorization', `Bearer ${tokenFontanero}`)
        .send({ activo: false });

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });
  });
});
