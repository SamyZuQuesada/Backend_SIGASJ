import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { TipoMovimientoInventario } from '../../common/enums/tipo-movimiento-inventario.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { DocumentoMovimientoInventario } from './entities/documento-movimiento-inventario.entity';
import { Material } from './entities/material.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';
import { InventarioModule } from './inventario.module';

const entradasQaTypeOrmModule = TypeOrmModule.forRoot({
  type: 'sqljs',
  autoSave: false,
  dropSchema: true,
  entities: [Usuario, Material, CategoriaMaterial, Proveedor, MovimientoInventario, DocumentoMovimientoInventario],
  synchronize: true,
});

describe('Entradas de Inventario — QA Integral, Validación Funcional y Transaccional', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let materialRepository: Repository<Material>;
  let movimientoRepository: Repository<MovimientoInventario>;
  let proveedorRepository: Repository<Proveedor>;
  let usuarioRepository: Repository<Usuario>;

  let adminUser: Usuario;
  let fontaneroUser: Usuario;
  let secretariaUser: Usuario;
  let abonadoUser: Usuario;

  const signAs = (role: Role | string, sub?: string) => {
    const roleStr = typeof role === 'string' ? role : String(role);
    const userId = sub ?? String(adminUser?.idUsuario ?? 1);
    const payload: JwtPayload = {
      sub: userId,
      email: `${roleStr.toLowerCase()}@asadasanjuan.cr`,
      role: role as Role,
      name: `Usuario ${roleStr}`,
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
        entradasQaTypeOrmModule,
        TypeOrmModule.forFeature([Usuario]),
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
    materialRepository = moduleRef.get<Repository<Material>>(
      getRepositoryToken(Material),
    );
    movimientoRepository = moduleRef.get<Repository<MovimientoInventario>>(
      getRepositoryToken(MovimientoInventario),
    );
    proveedorRepository = moduleRef.get<Repository<Proveedor>>(
      getRepositoryToken(Proveedor),
    );
    usuarioRepository = moduleRef.get<Repository<Usuario>>(
      getRepositoryToken(Usuario),
    );

    // Sembrar usuarios en la tabla Usuario para mantener integridad referencial
    adminUser = await usuarioRepository.save(
      usuarioRepository.create({ idUsuario: 1 }),
    );

    fontaneroUser = await usuarioRepository.save(
      usuarioRepository.create({ idUsuario: 2 }),
    );

    secretariaUser = await usuarioRepository.save(
      usuarioRepository.create({ idUsuario: 3 }),
    );

    abonadoUser = await usuarioRepository.save(
      usuarioRepository.create({ idUsuario: 4 }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await movimientoRepository.clear();
    await materialRepository.clear();
    await proveedorRepository.clear();
  });

  // =========================================================================
  // PILAR 1: Registro Exitoso de Entradas Físicas y Actualización de Stock
  // =========================================================================
  describe('1. Flujo Completo: Registro de Entradas y Aumento Atómico de Stock', () => {
    it('debe recibir datos, validar material, registrar MovimientoInventario = ENTRADA y aumentar existencias', async () => {
      // 1. Crear material con stockActual = 20
      const material = await materialRepository.save(
        materialRepository.create({
          nombre: 'Tubo PVC 1/2 pulgada',
          unidadMedida: 'Tubo',
          stockMinimo: 10,
          stockActual: 20,
          activo: true,
        }),
      );

      const token = signAs(Role.ADMINISTRADORA, String(adminUser.idUsuario));

      // 2. Registrar entrada de 15 unidades
      const payload = {
        idMaterial: material.id,
        cantidad: 15,
        observacion: 'Compra según factura F-4589',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(HttpStatus.CREATED);
      expect(response.body).toHaveProperty('movimiento');
      expect(response.body).toHaveProperty('material');
      expect(response.body.stockAnterior).toBe(20);
      expect(response.body.stockActual).toBe(35);
      expect(response.body.mensaje).toContain('Entrada física registrada exitosamente');

      // 3. Verificar persistencia en base de datos del material actualizado
      const materialEnDb = await materialRepository.findOne({
        where: { id: material.id },
      });
      expect(materialEnDb).toBeDefined();
      expect(materialEnDb!.stockActual).toBe(35);

      // 4. Verificar persistencia en base de datos del MovimientoInventario
      const movimientos = await movimientoRepository.find({
        where: { idMaterial: material.id },
      });
      expect(movimientos).toHaveLength(1);
      const mov = movimientos[0];
      expect(mov.tipo).toBe(TipoMovimientoInventario.ENTRADA);
      expect(mov.cantidad).toBe(15);
      expect(mov.idUsuario).toBe(adminUser.idUsuario);
      expect(mov.observacion).toBe('Compra según factura F-4589');
      expect(mov.createdAt).toBeDefined();
      expect(mov.fechaMovimiento).toBeDefined();
    });

    it('debe reflejar el nuevo stock al consultar el material por su endpoint GET /materiales/:id', async () => {
      const material = await materialRepository.save(
        materialRepository.create({
          nombre: 'Válvula de compuerta 2"',
          unidadMedida: 'Unidad',
          stockMinimo: 5,
          stockActual: 8,
          activo: true,
        }),
      );

      const token = signAs(Role.ADMINISTRADORA, String(adminUser.idUsuario));

      const entradaRes = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: material.id, cantidad: 12 });

      expect(entradaRes.status).toBe(HttpStatus.CREATED);

      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/inventario/materiales/${material.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.status).toBe(HttpStatus.OK);
      expect(getRes.body.stockActual).toBe(20);
    });

    it('debe acumular correctamente existencias ante múltiples entradas consecutivas', async () => {
      const material = await materialRepository.save(
        materialRepository.create({
          nombre: 'Cinta Teflón 3/4',
          unidadMedida: 'Rollo',
          stockMinimo: 15,
          stockActual: 0,
          activo: true,
        }),
      );

      const token = signAs(Role.ADMINISTRADORA, String(adminUser.idUsuario));

      // Primera entrada: +10 -> Stock 10
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: material.id, cantidad: 10 });
      expect(res1.status).toBe(HttpStatus.CREATED);
      expect(res1.body.stockActual).toBe(10);

      // Segunda entrada: +25 -> Stock 35
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: material.id, cantidad: 25 });
      expect(res2.status).toBe(HttpStatus.CREATED);
      expect(res2.body.stockActual).toBe(35);

      // Tercera entrada: +5 -> Stock 40
      const res3 = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: material.id, cantidad: 5 });
      expect(res3.status).toBe(HttpStatus.CREATED);
      expect(res3.body.stockActual).toBe(40);

      // Verificar 3 movimientos históricos registrados
      const totalMovimientos = await movimientoRepository.count({
        where: { idMaterial: material.id },
      });
      expect(totalMovimientos).toBe(3);
    });
  });

  // =========================================================================
  // PILAR 2: Asociación de Proveedores y Alias de Campos
  // =========================================================================
  describe('2. Integración con Proveedores y Soporte de Alias', () => {
    it('debe registrar entrada vinculando a un proveedor activo existente', async () => {
      const proveedor = await proveedorRepository.save(
        proveedorRepository.create({
          nombre: 'Ferretería El Lagar',
          identificacion: '3-101-778899',
          activo: true,
        }),
      );

      const material = await materialRepository.save(
        materialRepository.create({
          nombre: 'Codo PVC 90° 1/2"',
          unidadMedida: 'Unidad',
          stockMinimo: 20,
          stockActual: 5,
          activo: true,
        }),
      );

      const token = signAs(Role.ADMINISTRADORA, String(adminUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          idMaterial: material.id,
          cantidad: 30,
          idProveedor: proveedor.id,
          observacion: 'Suministrado por El Lagar',
        });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.movimiento.idProveedor).toBe(proveedor.id);
      expect(res.body.stockActual).toBe(35);

      const movDb = await movimientoRepository.findOne({
        where: { id: res.body.movimiento.id },
        relations: { proveedor: true },
      });
      expect(movDb).toBeDefined();
      expect(movDb!.proveedor?.id).toBe(proveedor.id);
      expect(movDb!.proveedor?.nombre).toBe('Ferretería El Lagar');
    });

    it('debe soportar materialId y proveedorId como alias para interoperabilidad con el frontend', async () => {
      const proveedor = await proveedorRepository.save(
        proveedorRepository.create({
          nombre: 'Distribuidora Fontanería CR',
          activo: true,
        }),
      );

      const material = await materialRepository.save(
        materialRepository.create({
          nombre: 'Pegamento PVC 1/4 galón',
          unidadMedida: 'Lata',
          stockMinimo: 5,
          stockActual: 2,
          activo: true,
        }),
      );

      const token = signAs(Role.ADMINISTRADORA, String(adminUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          materialId: material.id,
          cantidad: 8,
          proveedorId: proveedor.id,
        });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.stockActual).toBe(10);
      expect(res.body.movimiento.idMaterial).toBe(material.id);
      expect(res.body.movimiento.idProveedor).toBe(proveedor.id);
    });

    it('debe rechazar con 404 Not Found si el proveedor especificado no existe', async () => {
      const material = await materialRepository.save(
        materialRepository.create({
          nombre: 'Material Prueba',
          unidadMedida: 'Unidad',
          stockActual: 10,
          activo: true,
        }),
      );

      const token = signAs(Role.ADMINISTRADORA, String(adminUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          idMaterial: material.id,
          cantidad: 5,
          idProveedor: 99999,
        });

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
      expect(res.body.message).toContain('Proveedor con ID 99999 no encontrado');

      // Garantizar que no se alteró el stock
      const matDb = await materialRepository.findOne({ where: { id: material.id } });
      expect(matDb!.stockActual).toBe(10);
    });

    it('debe rechazar con 400 Bad Request si el proveedor se encuentra inactivo', async () => {
      const proveedorInactivo = await proveedorRepository.save(
        proveedorRepository.create({
          nombre: 'Proveedor Clausurado',
          activo: false,
        }),
      );

      const material = await materialRepository.save(
        materialRepository.create({
          nombre: 'Tubo PVC 1"',
          unidadMedida: 'Tubo',
          stockActual: 10,
          activo: true,
        }),
      );

      const token = signAs(Role.ADMINISTRADORA, String(adminUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          idMaterial: material.id,
          cantidad: 10,
          idProveedor: proveedorInactivo.id,
        });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body.message).toContain('se encuentra inactivo');

      // Stock sin cambios
      const matDb = await materialRepository.findOne({ where: { id: material.id } });
      expect(matDb!.stockActual).toBe(10);
    });
  });

  // =========================================================================
  // PILAR 3: Validaciones de Integridad y Reglas de Negocio
  // =========================================================================
  describe('3. Validaciones de Negocio y Reglas de Entrada', () => {
    it('debe rechazar con 400 Bad Request si la cantidad es menor o igual a cero', async () => {
      const material = await materialRepository.save(
        materialRepository.create({
          nombre: 'Adaptador Macho 1/2"',
          unidadMedida: 'Pieza',
          stockActual: 10,
          activo: true,
        }),
      );

      const token = signAs(Role.ADMINISTRADORA, String(adminUser.idUsuario));

      const resCero = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: material.id, cantidad: 0 });

      expect(resCero.status).toBe(HttpStatus.BAD_REQUEST);

      const resNegativo = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: material.id, cantidad: -5 });

      expect(resNegativo.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('debe rechazar con 400 Bad Request si la cantidad es un número decimal', async () => {
      const material = await materialRepository.save(
        materialRepository.create({
          nombre: 'Tee PVC 1/2"',
          unidadMedida: 'Pieza',
          stockActual: 10,
          activo: true,
        }),
      );

      const token = signAs(Role.ADMINISTRADORA, String(adminUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: material.id, cantidad: 4.75 });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('debe rechazar con 404 Not Found si el material no existe', async () => {
      const token = signAs(Role.ADMINISTRADORA, String(adminUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: 88888, cantidad: 10 });

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
      expect(res.body.message).toContain('Material con ID 88888 no encontrado');
    });

    it('debe rechazar con 400 Bad Request si el material se encuentra inactivo', async () => {
      const materialInactivo = await materialRepository.save(
        materialRepository.create({
          nombre: 'Material Obsoleto',
          unidadMedida: 'Unidad',
          stockActual: 10,
          activo: false,
        }),
      );

      const token = signAs(Role.ADMINISTRADORA, String(adminUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: materialInactivo.id, cantidad: 10 });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body.message).toContain('se encuentra inactivo');

      // Asegurar que no se creó ningún movimiento
      const movCount = await movimientoRepository.count({
        where: { idMaterial: materialInactivo.id },
      });
      expect(movCount).toBe(0);
    });

    it('debe rechazar con 400 Bad Request si no se especifica el material', async () => {
      const token = signAs(Role.ADMINISTRADORA, String(adminUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({ cantidad: 10 });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('debe respetar la fechaMovimiento provista explícitamente', async () => {
      const material = await materialRepository.save(
        materialRepository.create({
          nombre: 'Abrazadera 2 pulg',
          unidadMedida: 'Unidad',
          stockActual: 0,
          activo: true,
        }),
      );

      const fechaFisica = '2026-08-20T14:30:00.000Z';
      const token = signAs(Role.ADMINISTRADORA, String(adminUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          idMaterial: material.id,
          cantidad: 15,
          fechaMovimiento: fechaFisica,
        });

      expect(res.status).toBe(HttpStatus.CREATED);
      const movDb = await movimientoRepository.findOne({
        where: { id: res.body.movimiento.id },
      });
      expect(new Date(movDb!.fechaMovimiento).toISOString()).toBe(fechaFisica);
    });
  });

  // =========================================================================
  // PILAR 4: Seguridad y Control de Acceso (RBAC)
  // =========================================================================
  describe('4. Seguridad y Control de Acceso por Roles (RBAC)', () => {
    const payload = {
      idMaterial: 1,
      cantidad: 10,
    };

    it('rechaza con 401 Unauthorized sin token en POST /api/v1/inventario/entradas', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .send(payload);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 401 Unauthorized cuando el token es inválido o está corrupto', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', 'Bearer token_falso_o_corrupto')
        .send(payload);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 403 Forbidden cuando FONTANERO intenta registrar una entrada', async () => {
      const token = signAs(Role.FONTANERO, String(fontaneroUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('rechaza con 403 Forbidden cuando SECRETARIA intenta registrar una entrada', async () => {
      const token = signAs(Role.SECRETARIA, String(secretariaUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('rechaza con 403 Forbidden a un rol de usuario final como ABONADO', async () => {
      const token = signAs('ABONADO', String(abonadoUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send(payload);

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('permite el acceso exclusivo a ADMINISTRADORA', async () => {
      const material = await materialRepository.save(
        materialRepository.create({
          nombre: 'Material RBAC Test',
          unidadMedida: 'Unidad',
          stockActual: 5,
          activo: true,
        }),
      );

      const token = signAs(Role.ADMINISTRADORA, String(adminUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: material.id, cantidad: 5 });

      expect(res.status).toBe(HttpStatus.CREATED);
    });
  });
});
