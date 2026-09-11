import {
  BadRequestException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { TipoMovimientoInventario } from '../../common/enums/tipo-movimiento-inventario.enum';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { DocumentoMovimientoInventario } from './entities/documento-movimiento-inventario.entity';
import { Material } from './entities/material.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';
import { InventarioModule } from './inventario.module';
import { InventarioService } from './inventario.service';

const integralQaTypeOrmModule = TypeOrmModule.forRoot({
  type: 'sqljs',
  autoSave: false,
  dropSchema: true,
  entities: [
    Usuario,
    Material,
    CategoriaMaterial,
    Proveedor,
    MovimientoInventario,
    DocumentoMovimientoInventario,
  ],
  synchronize: true,
});

describe('Backlog 4.4: Registro de Entradas de Materiales — Pruebas Funcionales e Integrales (Backend y BD)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let inventarioService: InventarioService;
  let materialRepository: Repository<Material>;
  let movimientoRepository: Repository<MovimientoInventario>;
  let proveedorRepository: Repository<Proveedor>;
  let usuarioRepository: Repository<Usuario>;
  let documentoRepository: Repository<DocumentoMovimientoInventario>;

  let adminUser: Usuario;
  let materialActivo: Material;
  let materialInactivo: Material;
  let proveedorActivo: Proveedor;
  let proveedorInactivo: Proveedor;

  const signAs = (role: Role | string, sub = '1') => {
    const payload: JwtPayload = {
      sub,
      email: `${String(role).toLowerCase()}@asada.test`,
      role: role as Role,
      name: `Usuario ${String(role)}`,
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
        integralQaTypeOrmModule,
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
    inventarioService = moduleRef.get<InventarioService>(InventarioService);
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
    documentoRepository = moduleRef.get<Repository<DocumentoMovimientoInventario>>(
      getRepositoryToken(DocumentoMovimientoInventario),
    );

    // Sembrar usuario Administradora
    adminUser = await usuarioRepository.save(
      usuarioRepository.create({ idUsuario: 1 }),
    );

    // Sembrar proveedores
    proveedorActivo = await proveedorRepository.save(
      proveedorRepository.create({
        nombre: 'Ferretería El Lagar',
        razonSocial: 'El Lagar S.A.',
        identificacion: '3-101-998877',
        telefono: '2222-3333',
        correo: 'ventas@lagar.cr',
        activo: true,
      }),
    );

    proveedorInactivo = await proveedorRepository.save(
      proveedorRepository.create({
        nombre: 'Materiales del Norte Desactivado',
        razonSocial: 'Materiales del Norte S.A.',
        identificacion: '3-101-112233',
        activo: false,
      }),
    );

    // Sembrar materiales
    materialActivo = await materialRepository.save(
      materialRepository.create({
        nombre: 'Tubo PVC 1/2 pulgada Presión',
        descripcion: 'Tubo de presión para agua potable',
        unidadMedida: 'Tubo',
        ubicacion: 'Bodega Central - Estante A1',
        stockActual: 20,
        stockMinimo: 5,
        activo: true,
      }),
    );

    materialInactivo = await materialRepository.save(
      materialRepository.create({
        nombre: 'Válvula de compuerta descontinuada',
        descripcion: 'Válvula obsoleta',
        unidadMedida: 'Unidad',
        ubicacion: 'Bodega Central',
        stockActual: 0,
        stockMinimo: 0,
        activo: false,
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Registro Válido y Trazabilidad Completa del Movimiento', () => {
    it('debe registrar exitosamente una entrada, retornar confirmación y generar MovimientoInventario = ENTRADA', async () => {
      const entradaPayload = {
        idMaterial: materialActivo.id,
        cantidad: 15,
        idProveedor: proveedorActivo.id,
        observacion: '   Ingreso por compra según factura F-4589   ',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .send(entradaPayload)
        .expect(201);

      // Confirmar estructura de respuesta
      expect(response.body).toBeDefined();
      expect(response.body.stockAnterior).toBe(20);
      expect(response.body.stockActual).toBe(35);
      expect(response.body.mensaje).toContain('Entrada física registrada exitosamente');
      expect(response.body.mensaje).toContain('35');

      // Confirmar movimiento generado
      const movimiento = response.body.movimiento;
      expect(movimiento).toBeDefined();
      expect(movimiento.id).toBeDefined();
      expect(movimiento.tipo).toBe(TipoMovimientoInventario.ENTRADA);
      expect(movimiento.cantidad).toBe(15);
      expect(movimiento.idMaterial).toBe(materialActivo.id);
      expect(movimiento.idUsuario).toBe(adminUser.idUsuario);
      expect(movimiento.idProveedor).toBe(proveedorActivo.id);
      expect(movimiento.observacion).toBe('Ingreso por compra según factura F-4589');
      expect(new Date(movimiento.fechaMovimiento)).toBeInstanceOf(Date);

      // Confirmar persistencia en BD
      const movimientoEnBD = await movimientoRepository.findOne({
        where: { id: movimiento.id },
      });
      expect(movimientoEnBD).toBeDefined();
      expect(movimientoEnBD?.tipo).toBe(TipoMovimientoInventario.ENTRADA);
      expect(movimientoEnBD?.cantidad).toBe(15);
      expect(movimientoEnBD?.idMaterial).toBe(materialActivo.id);
    });

    it('debe reflejar el nuevo stock al consultar el material por GET /api/v1/inventario/materiales/:id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventario/materiales/${materialActivo.id}`)
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(response.body.stockActual).toBe(35);
    });

    it('debe registrar entrada sin proveedor y sin observación (campos opcionales nulos)', async () => {
      const entradaMinima = {
        idMaterial: materialActivo.id,
        cantidad: 5,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .send(entradaMinima)
        .expect(201);

      expect(response.body.stockAnterior).toBe(35);
      expect(response.body.stockActual).toBe(40);
      expect(response.body.movimiento.idProveedor).toBeNull();
      expect(response.body.movimiento.observacion).toBeNull();
    });

    it('debe permitir alias materialId y proveedorId para máxima compatibilidad con el frontend', async () => {
      const entradaConAlias = {
        materialId: materialActivo.id,
        cantidad: 10,
        proveedorId: proveedorActivo.id,
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .send(entradaConAlias)
        .expect(201);

      expect(response.body.stockAnterior).toBe(40);
      expect(response.body.stockActual).toBe(50);
      expect(response.body.movimiento.idMaterial).toBe(materialActivo.id);
      expect(response.body.movimiento.idProveedor).toBe(proveedorActivo.id);
    });
  });

  describe('2. Acumulación de Existencias y Verificación de Stock', () => {
    it('debe acumular correctamente múltiples entradas consecutivas sin pérdidas ni desfases', async () => {
      // Stock actual es 50
      // Entrada 1: +20 -> 70
      await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .send({ idMaterial: materialActivo.id, cantidad: 20 })
        .expect(201);

      // Entrada 2: +30 -> 100
      await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .send({ idMaterial: materialActivo.id, cantidad: 30 })
        .expect(201);

      const matBD = await materialRepository.findOne({
        where: { id: materialActivo.id },
      });
      expect(matBD?.stockActual).toBe(100);
    });
  });

  describe('3. Validaciones de Negocio y Errores Controlados', () => {
    it('debe rechazar con 400 Bad Request si la cantidad es cero', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .send({ idMaterial: materialActivo.id, cantidad: 0 })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('mayor a cero')]),
      );
    });

    it('debe rechazar con 400 Bad Request si la cantidad es negativa', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .send({ idMaterial: materialActivo.id, cantidad: -10 })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('mayor a cero')]),
      );
    });

    it('debe rechazar con 400 Bad Request si la cantidad es un número decimal', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .send({ idMaterial: materialActivo.id, cantidad: 12.75 })
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringContaining('número entero')]),
      );
    });

    it('debe rechazar con 400 Bad Request si no se especifica ningún material', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .send({ cantidad: 10 })
        .expect(400);

      expect(response.body.message).toContain(
        'Debe especificar el identificador del material',
      );
    });

    it('debe retornar 404 Not Found si el material especificado no existe', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .send({ idMaterial: 999999, cantidad: 10 })
        .expect(404);

      expect(response.body.message).toContain('no encontrado');
    });

    it('debe rechazar con 400 Bad Request si el material se encuentra inactivo', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .send({ idMaterial: materialInactivo.id, cantidad: 10 })
        .expect(400);

      expect(response.body.message).toContain('se encuentra inactivo');
    });

    it('debe retornar 404 Not Found si el proveedor especificado no existe', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .send({ idMaterial: materialActivo.id, cantidad: 10, idProveedor: 888888 })
        .expect(404);

      expect(response.body.message).toContain('Proveedor con ID 888888 no encontrado');
    });

    it('debe rechazar con 400 Bad Request si el proveedor especificado se encuentra inactivo', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .send({
          idMaterial: materialActivo.id,
          cantidad: 10,
          idProveedor: proveedorInactivo.id,
        })
        .expect(400);

      expect(response.body.message).toContain('se encuentra inactivo');
    });

    it('confirma que ninguna de las operaciones inválidas alteró el stock en base de datos', async () => {
      const matBD = await materialRepository.findOne({
        where: { id: materialActivo.id },
      });
      // Debe mantenerse exactamente en 100
      expect(matBD?.stockActual).toBe(100);
    });
  });

  describe('4. Consistencia y Atomicidad Transaccional (Regla Crítica)', () => {
    it('garantiza que si ocurre un fallo en la persistencia, el stock del material NO se incrementa (Rollback integral)', async () => {
      const stockAntes = (
        await materialRepository.findOne({ where: { id: materialActivo.id } })
      )?.stockActual!;

      // Simular un fallo forzado dentro de la transacción de base de datos
      const spyTx = jest
        .spyOn(materialRepository.manager, 'transaction')
        .mockRejectedValueOnce(
          new Error('Simulación de fallo en servidor o conexión de BD'),
        );

      await expect(
        inventarioService.registrarEntrada(
          { idMaterial: materialActivo.id, cantidad: 50 },
          {
            userId: '1',
            email: 'admin@asada.cr',
            role: Role.ADMINISTRADORA,
          },
        ),
      ).rejects.toThrow();

      // Verificar que el stock en la base de datos PERMANECE INTACTO
      const matDespues = await materialRepository.findOne({
        where: { id: materialActivo.id },
      });
      expect(matDespues?.stockActual).toBe(stockAntes);

      // Limpiar spy
      spyTx.mockRestore();
    });

    it('comprueba que no puede existir jamás un estado inconsistente (Stock actualizado sin movimiento o viceversa)', async () => {
      const movimientosTotales = await movimientoRepository.count({
        where: { idMaterial: materialActivo.id },
      });

      // Todas las entradas exitosas registradas en este suite:
      // Inicial: 20
      // Entrada 1: +15
      // Entrada 2: +5
      // Entrada 3: +10
      // Entrada 4: +20
      // Entrada 5: +30
      // Suma total de movimientos = 80 unidades
      // Stock final = 20 inicial + 80 = 100
      const sumaCantidades = (
        await movimientoRepository.find({
          where: { idMaterial: materialActivo.id },
        })
      ).reduce((acc, curr) => acc + curr.cantidad, 0);

      const matBD = await materialRepository.findOne({
        where: { id: materialActivo.id },
      });

      expect(matBD?.stockActual).toBe(20 + sumaCantidades);
      expect(movimientosTotales).toBe(5);
    });
  });

  describe('5. Integración con Documentos de Respaldo (Backlog 4.4.6)', () => {
    let entradaId: number;
    let savedFilename: string;

    beforeAll(async () => {
      const entrada = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .send({
          idMaterial: materialActivo.id,
          cantidad: 10,
          observacion: 'Entrada para prueba de adjuntos',
        });
      entradaId = entrada.body.movimiento.id;
    });

    it('adjunta una factura en PDF válida a la entrada registrada (201 Created)', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4 Factura oficial #9001 de compra de materiales');

      const response = await request(app.getHttpServer())
        .post(`/api/v1/inventario/entradas/${entradaId}/documentos`)
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .attach('archivo', pdfBuffer, {
          filename: 'factura_compra_9001.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.nombreOriginal).toBe('factura_compra_9001.pdf');
      expect(response.body.idMovimiento).toBe(entradaId);

      const parts = response.body.rutaReferenciaArchivo.split('/');
      savedFilename = parts[parts.length - 1];
    });

    it('adjunta una guía de entrega en formato PNG válido a la misma entrada (201 Created)', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

      const response = await request(app.getHttpServer())
        .post(`/api/v1/inventario/entradas/${entradaId}/documentos`)
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .attach('archivo', pngBuffer, {
          filename: 'guia_entrega.png',
          contentType: 'image/png',
        })
        .expect(201);

      expect(response.body.nombreOriginal).toBe('guia_entrega.png');
      expect(response.body.tipoArchivo).toBe('image/png');
    });

    it('permite listar todos los documentos asociados a la entrada (200 OK)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/inventario/entradas/${entradaId}/documentos`)
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body.map((d: any) => d.nombreOriginal)).toContain(
        'factura_compra_9001.pdf',
      );
      expect(response.body.map((d: any) => d.nombreOriginal)).toContain(
        'guia_entrega.png',
      );
    });

    it('permite visualizar o descargar el archivo adjunto en stream (200 OK)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/inventario/entradas/${entradaId}/documentos/${savedFilename}`)
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .expect(200);
    });

    it('confirma que la asociación de documentos de respaldo NO alteró las existencias de materiales', async () => {
      // Stock era 100 + 10 (de la entrada de prueba) = 110
      const mat = await materialRepository.findOne({
        where: { id: materialActivo.id },
      });
      expect(mat?.stockActual).toBe(110);
    });
  });

  describe('6. Seguridad y Control de Acceso por Roles (RBAC)', () => {
    it('rechaza el registro de entradas si no se provee token (401 Unauthorized)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .send({ idMaterial: materialActivo.id, cantidad: 10 })
        .expect(401);
    });

    it('rechaza el registro de entradas con token corrupto o inválido (401 Unauthorized)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', 'Bearer token_invalido_12345')
        .send({ idMaterial: materialActivo.id, cantidad: 10 })
        .expect(401);
    });

    it('rechaza con 403 Forbidden cuando FONTANERO intenta registrar una entrada de bodega', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO)}`)
        .send({ idMaterial: materialActivo.id, cantidad: 10 })
        .expect(403);
    });

    it('rechaza con 403 Forbidden cuando SECRETARIA intenta registrar una entrada de bodega', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${signAs(Role.SECRETARIA)}`)
        .send({ idMaterial: materialActivo.id, cantidad: 10 })
        .expect(403);
    });

    it('rechaza con 403 Forbidden a roles de usuario final (ABONADO)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${signAs('ABONADO')}`)
        .send({ idMaterial: materialActivo.id, cantidad: 10 })
        .expect(403);
    });

    it('permite el acceso exclusivo a ADMINISTRADORA (201 Created)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .send({ idMaterial: materialActivo.id, cantidad: 5 })
        .expect(201);
    });
  });
});
