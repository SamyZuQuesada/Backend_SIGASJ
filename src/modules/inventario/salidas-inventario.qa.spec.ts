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

const salidasQaTypeOrmModule = TypeOrmModule.forRoot({
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

describe('Salidas de Inventario — QA Integral, Validación Funcional y Transaccional (Backlog 4.5)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let materialRepository: Repository<Material>;
  let movimientoRepository: Repository<MovimientoInventario>;
  let averiaRepository: Repository<Averia>;
  let solicitudRepository: Repository<SolicitudServicio>;
  let usuarioRepository: Repository<Usuario>;

  let adminUser: Usuario;
  let fontaneroUser: Usuario;
  let otroFontaneroUser: Usuario;
  let secretariaUser: Usuario;
  let abonadoUser: Usuario;

  const signAs = (role: Role | string, sub?: string) => {
    const roleStr = typeof role === 'string' ? role : String(role);
    const userId = sub ?? String(fontaneroUser?.idUsuario ?? 2);
    const payload: JwtPayload = {
      sub: userId,
      email: `${roleStr.toLowerCase()}@asadasanjuan.cr`,
      role: role as Role,
      name: `Usuario ${roleStr}`,
    };
    return jwtService.sign(payload);
  };

  const createMaterial = async (overrides: Partial<Material> = {}) => {
    return materialRepository.save(
      materialRepository.create({
        nombre: 'Material Test',
        unidadMedida: 'Unidad',
        stockActual: 10,
        stockMinimo: 2,
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
        salidasQaTypeOrmModule,
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
    materialRepository = moduleRef.get<Repository<Material>>(
      getRepositoryToken(Material),
    );
    movimientoRepository = moduleRef.get<Repository<MovimientoInventario>>(
      getRepositoryToken(MovimientoInventario),
    );
    averiaRepository = moduleRef.get<Repository<Averia>>(
      getRepositoryToken(Averia),
    );
    solicitudRepository = moduleRef.get<Repository<SolicitudServicio>>(
      getRepositoryToken(SolicitudServicio),
    );
    usuarioRepository = moduleRef.get<Repository<Usuario>>(
      getRepositoryToken(Usuario),
    );

    // Sembrar usuarios en la base de datos
    adminUser = await usuarioRepository.save(
      usuarioRepository.create({ idUsuario: 1 }),
    );
    fontaneroUser = await usuarioRepository.save(
      usuarioRepository.create({ idUsuario: 2 }),
    );
    otroFontaneroUser = await usuarioRepository.save(
      usuarioRepository.create({ idUsuario: 3 }),
    );
    secretariaUser = await usuarioRepository.save(
      usuarioRepository.create({ idUsuario: 4 }),
    );
    abonadoUser = await usuarioRepository.save(
      usuarioRepository.create({ idUsuario: 5 }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await movimientoRepository.clear();
    await materialRepository.clear();
    await averiaRepository.clear();
    await solicitudRepository.clear();
  });

  // =========================================================================
  // PILAR 1: Registro Válido y Flujo Completo
  // =========================================================================
  describe('1. Registro Válido de Salida Física de Materiales', () => {
    it('iniciar sesión como Fontanero, consultar existencia, registrar salida válida y confirmar disminución correcta', async () => {
      // 1. Material activo con stockActual = 20
      const material = await createMaterial({
        nombre: 'Tubo PVC 1/2 pulgada',
        descripcion: 'Tubo de alta presión',
        stockActual: 20,
        stockMinimo: 5,
        activo: true,
      });

      const tokenFontanero = signAs(
        Role.FONTANERO,
        String(fontaneroUser.idUsuario),
      );

      // 2. Consultar existencia previa mediante endpoint de disponibilidad
      const resDisp = await request(app.getHttpServer())
        .get(
          `/api/v1/inventario/materiales/${material.id}/disponibilidad?cantidad=5`,
        )
        .set('Authorization', `Bearer ${tokenFontanero}`);

      expect(resDisp.status).toBe(HttpStatus.OK);
      expect(resDisp.body.stockActual).toBe(20);
      expect(resDisp.body.stockFinal).toBe(15);
      expect(resDisp.body.esValido).toBe(true);

      // 3. Registrar salida física de 5 unidades
      const resSalida = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${tokenFontanero}`)
        .send({
          idMaterial: material.id,
          cantidad: 5,
          observacion: 'Reparación de fuga en calle principal',
        });

      expect(resSalida.status).toBe(HttpStatus.CREATED);
      expect(resSalida.body.stockAnterior).toBe(20);
      expect(resSalida.body.stockActual).toBe(15);
      expect(resSalida.body.mensaje).toContain(
        'Salida física registrada exitosamente',
      );
      expect(resSalida.body.movimiento.tipo).toBe(
        TipoMovimientoInventario.SALIDA,
      );
      expect(resSalida.body.movimiento.cantidad).toBe(5);
      expect(resSalida.body.movimiento.idUsuario).toBe(fontaneroUser.idUsuario);

      // 4. Consultar nuevamente el material y confirmar persistencia
      const materialEnDb = await materialRepository.findOne({
        where: { id: material.id },
      });
      expect(materialEnDb?.stockActual).toBe(15);

      // 5. Verificar registro en MovimientoInventario
      const movimientos = await movimientoRepository.find({
        where: { idMaterial: material.id },
      });
      expect(movimientos).toHaveLength(1);
      expect(movimientos[0].tipo).toBe(TipoMovimientoInventario.SALIDA);
      expect(movimientos[0].cantidad).toBe(5);
      expect(movimientos[0].idUsuario).toBe(fontaneroUser.idUsuario);
      expect(movimientos[0].observacion).toBe(
        'Reparación de fuga en calle principal',
      );
    });

    it('permite a Administradora registrar salidas de materiales autorizados', async () => {
      const material = await createMaterial({
        nombre: 'Válvula de compuerta 2"',
        stockActual: 10,
        activo: true,
      });

      const tokenAdmin = signAs(
        Role.ADMINISTRADORA,
        String(adminUser.idUsuario),
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          idMaterial: material.id,
          cantidad: 2,
        });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.stockActual).toBe(8);

      const updated = await materialRepository.findOne({
        where: { id: material.id },
      });
      expect(updated?.stockActual).toBe(8);
    });
  });

  // =========================================================================
  // PILAR 2: Regla Centralizada de Existencias Disponibles (4.5.2)
  // =========================================================================
  describe('2. Validación de Existencias Disponibles y Prevención de Stock Negativo', () => {
    it('permite una salida que deje las existencias exactamente en cero', async () => {
      const material = await createMaterial({
        nombre: 'Codo PVC 90° 1/2"',
        stockActual: 5,
        stockMinimo: 1,
        activo: true,
      });

      const token = signAs(Role.FONTANERO, String(fontaneroUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          idMaterial: material.id,
          cantidad: 5,
        });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.stockActual).toBe(0);

      const updated = await materialRepository.findOne({
        where: { id: material.id },
      });
      expect(updated?.stockActual).toBe(0);
    });

    it('rechaza con 400 Bad Request cuando la cantidad solicitada supera el stock disponible (nunca negativo)', async () => {
      const material = await createMaterial({
        nombre: 'Llave de paso 1/2"',
        stockActual: 5,
        activo: true,
      });

      const token = signAs(Role.FONTANERO, String(fontaneroUser.idUsuario));

      // Intento de salida de 8 unidades cuando solo hay 5
      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          idMaterial: material.id,
          cantidad: 8,
        });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body.message).toContain(
        'Stock insuficiente para realizar la salida',
      );
      expect(res.body.message).toContain('Existencias disponibles: 5');
      expect(res.body.message).toContain('cantidad solicitada: 8');

      // Comprobar que el stock NUNCA queda en -3 y no se altera
      const materialSinCambios = await materialRepository.findOne({
        where: { id: material.id },
      });
      expect(materialSinCambios?.stockActual).toBe(5);

      // Comprobar que NO se insertó movimiento
      const movimientos = await movimientoRepository.find({
        where: { idMaterial: material.id },
      });
      expect(movimientos).toHaveLength(0);
    });

    it('rechaza salidas cuando el stock actual del material es 0', async () => {
      const material = await createMaterial({
        nombre: 'Teflón industrial',
        stockActual: 0,
        activo: true,
      });

      const token = signAs(Role.FONTANERO, String(fontaneroUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          idMaterial: material.id,
          cantidad: 1,
        });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body.message).toContain('Stock insuficiente');

      const materialSinCambios = await materialRepository.findOne({
        where: { id: material.id },
      });
      expect(materialSinCambios?.stockActual).toBe(0);
    });

    it('rechaza cantidades cero, negativas o decimales', async () => {
      const material = await createMaterial({
        nombre: 'Abrazadera metálica',
        stockActual: 15,
        activo: true,
      });

      const token = signAs(Role.FONTANERO, String(fontaneroUser.idUsuario));

      // Cantidad cero
      const resCero = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: material.id, cantidad: 0 });
      expect(resCero.status).toBe(HttpStatus.BAD_REQUEST);

      // Cantidad negativa
      const resNegativo = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: material.id, cantidad: -5 });
      expect(resNegativo.status).toBe(HttpStatus.BAD_REQUEST);

      // Cantidad decimal
      const resDecimal = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: material.id, cantidad: 2.5 });
      expect(resDecimal.status).toBe(HttpStatus.BAD_REQUEST);

      const materialSinCambios = await materialRepository.findOne({
        where: { id: material.id },
      });
      expect(materialSinCambios?.stockActual).toBe(15);
    });
  });

  // =========================================================================
  // PILAR 3: Validación de Materiales
  // =========================================================================
  describe('3. Validación del Estado y Existencia del Material', () => {
    it('retorna 404 Not Found si el material no existe', async () => {
      const token = signAs(Role.FONTANERO, String(fontaneroUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          idMaterial: 99999,
          cantidad: 2,
        });

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
      expect(res.body.message).toContain('Material con ID 99999 no encontrado');
    });

    it('rechaza con 400 Bad Request si el material se encuentra inactivo', async () => {
      const materialInactivo = await createMaterial({
        nombre: 'Tubo de asbesto obsoleto',
        stockActual: 30,
        activo: false,
      });

      const token = signAs(Role.FONTANERO, String(fontaneroUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          idMaterial: materialInactivo.id,
          cantidad: 1,
        });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body.message).toContain('porque se encuentra inactivo');

      const sinCambios = await materialRepository.findOne({
        where: { id: materialInactivo.id },
      });
      expect(sinCambios?.stockActual).toBe(30);
    });

    it('rechaza con 400 Bad Request identificadores de material inválidos (menores a 1 o no enteros)', async () => {
      const token = signAs(Role.FONTANERO, String(fontaneroUser.idUsuario));

      const resCero = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: 0, cantidad: 1 });
      expect(resCero.status).toBe(HttpStatus.BAD_REQUEST);

      const resNegativo = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: -3, cantidad: 1 });
      expect(resNegativo.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  // =========================================================================
  // PILAR 4: Integración con Gestión de Averías
  // =========================================================================
  describe('4. Integración con Gestión de Averías', () => {
    it('registra una salida vinculada a una avería asignada al Fontanero autenticado', async () => {
      // 1. Crear material
      const material = await createMaterial({
        nombre: 'Unión universal 1/2"',
        stockActual: 12,
        activo: true,
      });

      // 2. Crear avería asignada al fontaneroUser (idUsuario: 2)
      const averia = await averiaRepository.save(
        averiaRepository.create({
          codigoSeguimiento: 'AVE-QA-2026-001',
          nombreReportante: 'Carlos Méndez',
          telefonoReportante: '8888-1111',
          ubicacion: 'Calle Las Flores, San Juan',
          sectorComunidad: 'Sector 1',
          descripcion: 'Fuga de agua potable en medidor',
          idFontaneroAsignado: fontaneroUser.idUsuario,
          fechaReporte: new Date(),
        }),
      );

      const tokenFontanero = signAs(
        Role.FONTANERO,
        String(fontaneroUser.idUsuario),
      );

      // 3. Registrar salida con idAveria
      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${tokenFontanero}`)
        .send({
          idMaterial: material.id,
          cantidad: 2,
          idAveria: averia.id,
          observacion: 'Reparación de conexión de medidor en avería',
        });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.movimiento.idAveria).toBe(averia.id);
      expect(res.body.stockActual).toBe(10);

      // 4. Consultar movimientos vinculados a la avería
      const resMovsAveria = await request(app.getHttpServer())
        .get(`/api/v1/inventario/salidas/averia/${averia.id}`)
        .set('Authorization', `Bearer ${tokenFontanero}`);

      expect(resMovsAveria.status).toBe(HttpStatus.OK);
      expect(resMovsAveria.body).toHaveLength(1);
      expect(resMovsAveria.body[0].idMaterial).toBe(material.id);
      expect(resMovsAveria.body[0].cantidad).toBe(2);
    });

    it('rechaza con 400 Bad Request si otro Fontanero intenta registrar salida para una avería que no tiene asignada', async () => {
      const material = await createMaterial({
        nombre: 'Tubo PVC 3/4"',
        stockActual: 25,
        activo: true,
      });

      // Avería asignada a fontaneroUser (ID: 2)
      const averia = await averiaRepository.save(
        averiaRepository.create({
          codigoSeguimiento: 'AVE-QA-2026-002',
          nombreReportante: 'Lorena Solano',
          telefonoReportante: '8888-2222',
          ubicacion: 'Barrio El Carmen',
          sectorComunidad: 'Sector 2',
          descripcion: 'Fuga en red secundaria',
          idFontaneroAsignado: fontaneroUser.idUsuario,
          fechaReporte: new Date(),
        }),
      );

      // Token de otro fontanero (ID: 3)
      const tokenOtroFontanero = signAs(
        Role.FONTANERO,
        String(otroFontaneroUser.idUsuario),
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${tokenOtroFontanero}`)
        .send({
          idMaterial: material.id,
          cantidad: 3,
          idAveria: averia.id,
        });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body.message).toContain('no tiene asignada');

      // Confirmar que el stock no fue alterado
      const materialSinCambios = await materialRepository.findOne({
        where: { id: material.id },
      });
      expect(materialSinCambios?.stockActual).toBe(25);
    });

    it('retorna 404 Not Found si se intenta vincular una avería inexistente', async () => {
      const material = await createMaterial({
        nombre: 'Adaptador macho 1/2"',
        stockActual: 10,
        activo: true,
      });

      const tokenFontanero = signAs(
        Role.FONTANERO,
        String(fontaneroUser.idUsuario),
      );

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${tokenFontanero}`)
        .send({
          idMaterial: material.id,
          cantidad: 1,
          idAveria: 99999,
        });

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
      expect(res.body.message).toContain('Avería con ID 99999 no encontrada');

      const materialSinCambios = await materialRepository.findOne({
        where: { id: material.id },
      });
      expect(materialSinCambios?.stockActual).toBe(10);
    });
  });

  // =========================================================================
  // PILAR 5: Seguridad y Autorización RBAC
  // =========================================================================
  describe('5. Seguridad y Roles de Acceso', () => {
    it('rechaza con 401 Unauthorized peticiones sin token JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .send({ idMaterial: 1, cantidad: 5 });

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 403 Forbidden a un rol no autorizado como SECRETARIA', async () => {
      const token = signAs(Role.SECRETARIA, String(secretariaUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: 1, cantidad: 5 });

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('rechaza con 403 Forbidden a un usuario con rol ABONADO', async () => {
      const token = signAs('ABONADO', String(abonadoUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: 1, cantidad: 5 });

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('rechaza con 400 Bad Request si el cliente intenta manipular fontaneroId o idUsuario en el body', async () => {
      const token = signAs(Role.FONTANERO, String(fontaneroUser.idUsuario));

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          idMaterial: 1,
          cantidad: 2,
          fontaneroId: 999,
        });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(JSON.stringify(res.body)).toContain(
        'property fontaneroId should not exist',
      );
    });
  });
});
