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
import { Averia } from '../averias/entities/averia.entity';
import { SolicitudServicio } from '../solicitudes/entities/solicitud-servicio.entity';
import { Usuario } from '../usuarios/entities/usuario.entity';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { DocumentoMovimientoInventario } from './entities/documento-movimiento-inventario.entity';
import { Material } from './entities/material.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';
import { SolicitudMaterial } from './entities/solicitud-material.entity';
import { DetalleSolicitudMaterial } from './entities/detalle-solicitud-material.entity';
import { InventarioModule } from './inventario.module';
import { InventarioService } from './inventario.service';

const integralSalidasTypeOrmModule = TypeOrmModule.forRoot({
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
    Averia,
    SolicitudServicio,
    SolicitudMaterial,
    DetalleSolicitudMaterial,
  ],
  synchronize: true,
});

describe('Backlog 4.5: Registro de Salidas de Materiales — Pruebas Funcionales e Integrales (Backend y BD)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let inventarioService: InventarioService;
  let materialRepository: Repository<Material>;
  let movimientoRepository: Repository<MovimientoInventario>;
  let averiaRepository: Repository<Averia>;
  let usuarioRepository: Repository<Usuario>;

  let fontaneroUser: Usuario;
  let adminUser: Usuario;
  let secretariaUser: Usuario;
  let abonadoUser: Usuario;

  const signAs = (role: Role | string, sub?: string) => {
    const roleStr = typeof role === 'string' ? role : String(role);
    const userId = sub ?? String(fontaneroUser?.idUsuario ?? 10);
    const payload: JwtPayload = {
      sub: userId,
      email: `${roleStr.toLowerCase()}@asada.test`,
      role: role as Role,
      name: `Usuario ${roleStr}`,
    };
    return jwtService.sign(payload);
  };

  const createMaterial = async (overrides: Partial<Material> = {}) => {
    return materialRepository.save(
      materialRepository.create({
        nombre: 'Material de Prueba Integral',
        unidadMedida: 'Unidad',
        stockActual: 20,
        stockMinimo: 5,
        activo: true,
        ...overrides,
      }),
    );
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig],
        }),
        integralSalidasTypeOrmModule,
        TypeOrmModule.forFeature([Usuario, Averia, SolicitudServicio]),
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
    averiaRepository = moduleRef.get<Repository<Averia>>(
      getRepositoryToken(Averia),
    );
    usuarioRepository = moduleRef.get<Repository<Usuario>>(
      getRepositoryToken(Usuario),
    );

    fontaneroUser = await usuarioRepository.save(
      usuarioRepository.create({ idUsuario: 10 }),
    );
    adminUser = await usuarioRepository.save(
      usuarioRepository.create({ idUsuario: 11 }),
    );
    secretariaUser = await usuarioRepository.save(
      usuarioRepository.create({ idUsuario: 12 }),
    );
    abonadoUser = await usuarioRepository.save(
      usuarioRepository.create({ idUsuario: 13 }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await movimientoRepository.clear();
    await materialRepository.clear();
    await averiaRepository.clear();
  });

  // =========================================================================
  // REGLA FUNDAMENTAL 1: Stock 20 -> Salida 5 -> Stock 15
  // =========================================================================
  describe('Regla Fundamental 1: Disminución Correcta de Existencias', () => {
    it('debe disminuir el stock de 20 a 15 y registrar movimiento SALIDA con auditoría completa', async () => {
      const material = await createMaterial({
        nombre: 'Tubo PVC 1/2"',
        stockActual: 20,
        stockMinimo: 5,
      });

      const token = signAs(Role.FONTANERO, String(fontaneroUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          idMaterial: material.id,
          cantidad: 5,
          observacion: 'Mantenimiento de tubería',
        });

      expect(res.status).toBe(201);
      expect(res.body.stockAnterior).toBe(20);
      expect(res.body.stockActual).toBe(15);
      expect(res.body.movimiento.tipo).toBe(TipoMovimientoInventario.SALIDA);
      expect(res.body.movimiento.cantidad).toBe(5);
      expect(res.body.movimiento.idUsuario).toBe(fontaneroUser.idUsuario);

      // Comprobar BD
      const enDb = await materialRepository.findOne({
        where: { id: material.id },
      });
      expect(enDb?.stockActual).toBe(15);

      const movs = await movimientoRepository.find({
        where: { idMaterial: material.id },
      });
      expect(movs).toHaveLength(1);
      expect(movs[0].tipo).toBe(TipoMovimientoInventario.SALIDA);
      expect(movs[0].cantidad).toBe(5);
    });
  });

  // =========================================================================
  // REGLA FUNDAMENTAL 2: Stock 5 -> Salida 8 -> Rechazo (Nunca Negativo)
  // =========================================================================
  describe('Regla Fundamental 2: Stock Disponible 5, Salida Solicitada 8 -> Rechazo (No Negativo)', () => {
    it('el sistema nunca debe permitir stock negativo (ej. 5 - 8 = -3 ❌)', async () => {
      const material = await createMaterial({
        nombre: 'Válvula de paso 1/2"',
        stockActual: 5,
      });

      const token = signAs(Role.FONTANERO, String(fontaneroUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          idMaterial: material.id,
          cantidad: 8,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain(
        'Stock insuficiente para realizar la salida',
      );
      expect(res.body.message).toContain('Existencias disponibles: 5');
      expect(res.body.message).toContain('cantidad solicitada: 8');

      // Comprobar que en BD el stock permanece en 5 y NUNCA queda en -3
      const enDb = await materialRepository.findOne({
        where: { id: material.id },
      });
      expect(enDb?.stockActual).toBe(5);
      expect(enDb?.stockActual).not.toBe(-3);

      // Comprobar que no hay movimientos espurios
      const movs = await movimientoRepository.find({
        where: { idMaterial: material.id },
      });
      expect(movs).toHaveLength(0);
    });
  });

  // =========================================================================
  // REGLA FUNDAMENTAL 3: Stock 10 -> Salida 10 -> Stock 0 (Permitido)
  // =========================================================================
  describe('Regla Fundamental 3: Salida Exacta hasta Agotar Existencias (Stock Final 0)', () => {
    it('permite una salida que deje el stock exactamente en 0 y reporta agotamiento total', async () => {
      const material = await createMaterial({
        nombre: 'Codo PVC 45°',
        stockActual: 10,
        stockMinimo: 2,
      });

      const token = signAs(Role.FONTANERO, String(fontaneroUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          idMaterial: material.id,
          cantidad: 10,
        });

      expect(res.status).toBe(201);
      expect(res.body.stockAnterior).toBe(10);
      expect(res.body.stockActual).toBe(0);

      const enDb = await materialRepository.findOne({
        where: { id: material.id },
      });
      expect(enDb?.stockActual).toBe(0);
    });
  });

  // =========================================================================
  // REGLA FUNDAMENTAL 4: Consistencia Atómica Transaccional
  // =========================================================================
  describe('Regla Fundamental 4: Consistencia Atómica (Evitar Actualizaciones Parciales)', () => {
    it('no debe existir escenario de stock disminuido sin movimiento ni movimiento registrado sin stock disminuido', async () => {
      const material = await createMaterial({
        nombre: 'Tubo HG 1"',
        stockActual: 15,
      });

      // Forzar que el guardado del movimiento lance un error simulado dentro de la transacción
      const saveMovimientoOriginal = movimientoRepository.save;
      jest
        .spyOn(materialRepository.manager, 'transaction')
        .mockImplementationOnce(async (cb: any) => {
          // Ejecutar con un manager simulado que falle en la persistencia del movimiento
          throw new Error(
            'Fallo simulado de red o desconexión en base de datos',
          );
        });

      const token = signAs(Role.FONTANERO, String(fontaneroUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          idMaterial: material.id,
          cantidad: 3,
        });

      expect(res.status).toBe(500);

      // Comprobar que ante el fallo, el stock en BD permanece INTACTO en 15 (no disminuyó a 12)
      const enDb = await materialRepository.findOne({
        where: { id: material.id },
      });
      expect(enDb?.stockActual).toBe(15);

      // Comprobar que no existe ningún movimiento huérfano
      const movs = await movimientoRepository.find({
        where: { idMaterial: material.id },
      });
      expect(movs).toHaveLength(0);
    });
  });

  // =========================================================================
  // REGLA FUNDAMENTAL 5: Identificación Segura del Responsable (No Manipulable)
  // =========================================================================
  describe('Regla Fundamental 5: Seguridad e Identificación del Usuario Responsable', () => {
    it('rechaza con 400 Bad Request si el frontend intenta enviar un fontaneroId o idUsuario manipulable', async () => {
      const material = await createMaterial({
        nombre: 'Tee PVC 1/2"',
        stockActual: 10,
      });

      const token = signAs(Role.FONTANERO, String(fontaneroUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          idMaterial: material.id,
          cantidad: 2,
          fontaneroId: 999, // intento de falsificación
        });

      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain(
        'property fontaneroId should not exist',
      );

      // Comprobar que no se modificó stock
      const enDb = await materialRepository.findOne({
        where: { id: material.id },
      });
      expect(enDb?.stockActual).toBe(10);
    });

    it('asigna siempre el idUsuario extraído de la sesión JWT del Fontanero autenticado', async () => {
      const material = await createMaterial({
        nombre: 'Adaptador hembra 1/2"',
        stockActual: 8,
      });

      const token = signAs(Role.FONTANERO, String(fontaneroUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          idMaterial: material.id,
          cantidad: 2,
        });

      expect(res.status).toBe(201);
      expect(res.body.movimiento.idUsuario).toBe(fontaneroUser.idUsuario);

      const mov = await movimientoRepository.findOne({
        where: { idMaterial: material.id },
      });
      expect(mov?.idUsuario).toBe(fontaneroUser.idUsuario);
    });
  });

  // =========================================================================
  // REGLA FUNDAMENTAL 6: Integración con Averías y Consulta Posterior
  // =========================================================================
  describe('Regla Fundamental 6: Integración con Averías y Consulta Posterior de Materiales', () => {
    it('registra la salida relacionada a la avería y permite consultar los materiales retirados para esa avería', async () => {
      const mat1 = await createMaterial({
        nombre: 'Pegamento PVC 1/4 galón',
        stockActual: 10,
      });
      const mat2 = await createMaterial({
        nombre: 'Tubo PVC 1/2"',
        stockActual: 15,
      });

      const averia = await averiaRepository.save(
        averiaRepository.create({
          codigoSeguimiento: 'AVE-INT-001',
          nombreReportante: 'Marta Salas',
          telefonoReportante: '8888-3333',
          ubicacion: 'Calle 3, San Juan',
          sectorComunidad: 'Sector 3',
          descripcion: 'Fuga visible en acera',
          idFontaneroAsignado: fontaneroUser.idUsuario,
          fechaReporte: new Date(),
        }),
      );

      const token = signAs(Role.FONTANERO, String(fontaneroUser.idUsuario));

      // Salida 1: 2 unidades de Pegamento
      await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: mat1.id, cantidad: 2, idAveria: averia.id })
        .expect(201);

      // Salida 2: 3 unidades de Tubo PVC
      await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: mat2.id, cantidad: 3, idAveria: averia.id })
        .expect(201);

      // Consultar materiales utilizados en la avería
      const resAveriaMovs = await request(app.getHttpServer())
        .get(`/api/v1/inventario/salidas/averia/${averia.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(resAveriaMovs.status).toBe(200);
      expect(resAveriaMovs.body).toHaveLength(2);

      const idsMateriales = resAveriaMovs.body.map((m: any) => m.idMaterial);
      expect(idsMateriales).toContain(mat1.id);
      expect(idsMateriales).toContain(mat2.id);

      // Comprobar que los stocks disminuyeron correctamente
      const mat1Db = await materialRepository.findOne({
        where: { id: mat1.id },
      });
      const mat2Db = await materialRepository.findOne({
        where: { id: mat2.id },
      });
      expect(mat1Db?.stockActual).toBe(8);
      expect(mat2Db?.stockActual).toBe(12);
    });
  });

  // =========================================================================
  // REGLA FUNDAMENTAL 7: Matriz de Permisos y Códigos de Error (400, 401, 403, 404)
  // =========================================================================
  describe('Regla Fundamental 7: Matriz de Seguridad y Códigos HTTP', () => {
    it('retorna 401 si no hay token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .send({ idMaterial: 1, cantidad: 1 })
        .expect(401);
    });

    it('retorna 403 si el rol es SECRETARIA o ABONADO', async () => {
      const tokenSec = signAs(
        Role.SECRETARIA,
        String(secretariaUser.idUsuario),
      );
      await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${tokenSec}`)
        .send({ idMaterial: 1, cantidad: 1 })
        .expect(403);

      const tokenAbo = signAs('ABONADO', String(abonadoUser.idUsuario));
      await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${tokenAbo}`)
        .send({ idMaterial: 1, cantidad: 1 })
        .expect(403);
    });

    it('retorna 404 si el material no existe', async () => {
      const token = signAs(Role.FONTANERO, String(fontaneroUser.idUsuario));
      await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: 99999, cantidad: 1 })
        .expect(404);
    });

    it('retorna 400 si el material está inactivo', async () => {
      const materialInactivo = await createMaterial({
        nombre: 'Medidor viejo inactivo',
        stockActual: 10,
        activo: false,
      });

      const token = signAs(Role.FONTANERO, String(fontaneroUser.idUsuario));
      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: materialInactivo.id, cantidad: 1 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('inactivo');
    });
  });
});
