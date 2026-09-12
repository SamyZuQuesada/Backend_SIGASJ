/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { EstadoSolicitudMaterial } from '../../common/enums/estado-solicitud-material.enum';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { Averia } from '../averias/entities/averia.entity';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { DetalleSolicitudMaterial } from './entities/detalle-solicitud-material.entity';
import { DocumentoMovimientoInventario } from './entities/documento-movimiento-inventario.entity';
import { Material } from './entities/material.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';
import { SolicitudMaterial } from './entities/solicitud-material.entity';
import { InventarioModule } from './inventario.module';

describe('Solicitudes de Materiales por Fontanero (Backlog 4.6) — QA y Pruebas Funcionales', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  let mockMaterialRepo: any;
  let mockAveriaRepo: any;
  let mockSolicitudRepo: any;
  let mockDetalleRepo: any;
  let mockManager: any;

  let materialesDb: Map<number, Material>;
  let averiasDb: Map<number, Averia>;
  let solicitudesDb: Map<number, SolicitudMaterial>;
  let detallesDb: DetalleSolicitudMaterial[];

  const signAs = (role: Role | string, userId = '7') => {
    const roleStr = String(role);
    const payload: JwtPayload = {
      sub: userId,
      email: `${roleStr.toLowerCase()}@asadasanjuan.cr`,
      role: role as Role,
      name: `Usuario ${roleStr}`,
    };
    return jwtService.sign(payload);
  };

  const resetState = () => {
    materialesDb = new Map();
    averiasDb = new Map();
    solicitudesDb = new Map();
    detallesDb = [];

    // Seed de materiales
    const mat1 = new Material();
    mat1.id = 1;
    mat1.nombre = 'Tubo PVC 1/2"';
    mat1.unidadMedida = 'Metro';
    mat1.stockActual = 50;
    mat1.activo = true;
    materialesDb.set(1, mat1);

    const mat2 = new Material();
    mat2.id = 2;
    mat2.nombre = 'Unión PVC';
    mat2.unidadMedida = 'Unidad';
    mat2.stockActual = 30;
    mat2.activo = true;
    materialesDb.set(2, mat2);

    const mat3 = new Material();
    mat3.id = 3;
    mat3.nombre = 'Codo PVC';
    mat3.unidadMedida = 'Unidad';
    mat3.stockActual = 20;
    mat3.activo = true;
    materialesDb.set(3, mat3);

    const matInactivo = new Material();
    matInactivo.id = 4;
    matInactivo.nombre = 'Pegamento PVC Vencido';
    matInactivo.unidadMedida = 'Tarro';
    matInactivo.stockActual = 10;
    matInactivo.activo = false;
    materialesDb.set(4, matInactivo);

    // Seed de averías
    const averiaPropia = new Averia();
    averiaPropia.id = 10;
    averiaPropia.codigoSeguimiento = 'AVR-2026-0010';
    averiaPropia.idFontaneroAsignado = 7;
    averiasDb.set(10, averiaPropia);

    const averiaAjena = new Averia();
    averiaAjena.id = 20;
    averiaAjena.codigoSeguimiento = 'AVR-2026-0020';
    averiaAjena.idFontaneroAsignado = 99; // asignada a otro fontanero
    averiasDb.set(20, averiaAjena);
  };

  beforeAll(async () => {
    resetState();

    // Mocks de repositorios
    mockMaterialRepo = {
      findOne: jest.fn().mockImplementation(({ where: { id } }: any) => {
        return Promise.resolve(materialesDb.get(id) ?? null);
      }),
      save: jest.fn().mockImplementation((entity: Material) => {
        materialesDb.set(entity.id, entity);
        return Promise.resolve(entity);
      }),
    };

    mockAveriaRepo = {
      findOne: jest.fn().mockImplementation(({ where: { id } }: any) => {
        return Promise.resolve(averiasDb.get(id) ?? null);
      }),
    };

    mockDetalleRepo = {
      create: jest.fn().mockImplementation((dto: any) => ({
        id: detallesDb.length + 1,
        ...dto,
      })),
      save: jest.fn().mockImplementation((entity: any) => {
        detallesDb.push(entity);
        return Promise.resolve(entity);
      }),
    };

    mockSolicitudRepo = {
      count: jest
        .fn()
        .mockImplementation(() => Promise.resolve(solicitudesDb.size)),
      create: jest.fn().mockImplementation((dto: any) => ({
        id: solicitudesDb.size + 1,
        ...dto,
      })),
      save: jest.fn().mockImplementation((entity: SolicitudMaterial) => {
        const id = entity.id || solicitudesDb.size + 1;
        entity.id = id;
        solicitudesDb.set(id, entity);
        return Promise.resolve(entity);
      }),
      findOne: jest.fn().mockImplementation(({ where: { id } }: any) => {
        const sol = solicitudesDb.get(id);
        if (!sol) return Promise.resolve(null);
        return Promise.resolve({
          ...sol,
          detalles: (sol.detalles || []).map((det: any) => ({
            ...det,
            material: materialesDb.get(det.idMaterial),
          })),
          averia: sol.idAveria ? averiasDb.get(sol.idAveria) : null,
        });
      }),
      createQueryBuilder: jest.fn().mockImplementation(() => {
        let filterFontanero: number | null = null;
        let filterEstado: string | null = null;
        let filterAveria: number | null = null;
        let skipNum = 0;
        let takeNum: number | null = null;

        const getFiltered = () => {
          let list = Array.from(solicitudesDb.values());
          if (filterFontanero !== null) {
            list = list.filter(
              (s) => Number(s.idFontanero) === filterFontanero,
            );
          }
          if (filterEstado !== null) {
            list = list.filter((s) => s.estado === filterEstado);
          }
          if (filterAveria !== null) {
            list = list.filter((s) => s.idAveria === filterAveria);
          }
          list.sort(
            (a, b) =>
              new Date(b.fechaSolicitud).getTime() -
              new Date(a.fechaSolicitud).getTime(),
          );
          return list;
        };

        const builder: any = {
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest
            .fn()
            .mockImplementation((_clause: string, params: any) => {
              if (params?.idFontanero !== undefined) {
                filterFontanero = Number(params.idFontanero);
              }
              return builder;
            }),
          andWhere: jest
            .fn()
            .mockImplementation((_clause: string, params: any) => {
              if (params?.estado !== undefined) {
                filterEstado = String(params.estado);
              }
              if (params?.idAveria !== undefined) {
                filterAveria = Number(params.idAveria);
              }
              return builder;
            }),
          orderBy: jest.fn().mockReturnThis(),
          addOrderBy: jest.fn().mockReturnThis(),
          skip: jest.fn().mockImplementation((s: number) => {
            skipNum = s;
            return builder;
          }),
          take: jest.fn().mockImplementation((t: number) => {
            takeNum = t;
            return builder;
          }),
          getCount: jest.fn().mockImplementation(() => {
            return Promise.resolve(getFiltered().length);
          }),
          getMany: jest.fn().mockImplementation(() => {
            const list = getFiltered();
            const mapped = list.map((sol) => ({
              ...sol,
              detalles: (sol.detalles || []).map((det: any) => ({
                ...det,
                material: materialesDb.get(det.idMaterial),
              })),
              averia: sol.idAveria ? averiasDb.get(sol.idAveria) : null,
            }));
            if (takeNum !== null) {
              return Promise.resolve(mapped.slice(skipNum, skipNum + takeNum));
            }
            return Promise.resolve(mapped);
          }),
        };
        return builder;
      }),
    };

    mockManager = {
      getRepository: jest.fn().mockImplementation((entity: any) => {
        if (entity === Material) return mockMaterialRepo;
        if (entity === Averia) return mockAveriaRepo;
        if (entity === SolicitudMaterial) return mockSolicitudRepo;
        if (entity === DetalleSolicitudMaterial) return mockDetalleRepo;
        return mockMaterialRepo;
      }),
      transaction: jest
        .fn()
        .mockImplementation(async (cb: (m: any) => any) => cb(mockManager)),
    };

    mockMaterialRepo.manager = mockManager;

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [jwtConfig],
        }),
        AuthModule,
        InventarioModule,
      ],
    })
      .overrideProvider(getRepositoryToken(Material))
      .useValue(mockMaterialRepo)
      .overrideProvider(getRepositoryToken(CategoriaMaterial))
      .useValue({})
      .overrideProvider(getRepositoryToken(Proveedor))
      .useValue({})
      .overrideProvider(getRepositoryToken(MovimientoInventario))
      .useValue({})
      .overrideProvider(getRepositoryToken(DocumentoMovimientoInventario))
      .useValue({})
      .overrideProvider(getRepositoryToken(SolicitudMaterial))
      .useValue(mockSolicitudRepo)
      .overrideProvider(getRepositoryToken(DetalleSolicitudMaterial))
      .useValue(mockDetalleRepo)
      .overrideProvider(getRepositoryToken(Averia))
      .useValue(mockAveriaRepo)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  beforeEach(() => {
    resetState();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. Seguridad, Control de Acceso y Rutas', () => {
    it('rechaza con 401 Unauthorized si no se envía token JWT', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .send({
          materiales: [{ idMaterial: 1, cantidad: 5 }],
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 401 Unauthorized si el token JWT es inválido, corrupto o expirado', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', 'Bearer token_totalmente_invalido_12345')
        .send({ materiales: [{ idMaterial: 1, cantidad: 5 }] })
        .expect(HttpStatus.UNAUTHORIZED);

      await request(app.getHttpServer())
        .get('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', 'Bearer token_invalido_xyz')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 403 Forbidden si el rol es SECRETARIA', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.SECRETARIA)}`)
        .send({
          materiales: [{ idMaterial: 1, cantidad: 5 }],
        })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('rechaza con 403 Forbidden si el rol es ADMINISTRADORA (restringido a fontanero)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA)}`)
        .send({
          materiales: [{ idMaterial: 1, cantidad: 5 }],
        })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('rechaza con 403 Forbidden si el rol es ABONADO', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs('ABONADO')}`)
        .send({
          materiales: [{ idMaterial: 1, cantidad: 5 }],
        })
        .expect(HttpStatus.FORBIDDEN);
    });

    it('rechaza con 400 Bad Request si el frontend intenta enviar un fontaneroId o idFontanero manipulable', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({
          fontaneroId: 999, // intento de suplantación
          materiales: [{ idMaterial: 1, cantidad: 5 }],
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(JSON.stringify(response.body)).toContain(
        'property fontaneroId should not exist',
      );
    });

    it('soporta la ruta alias /api/v1/inventario/solicitudes-materiales para interoperabilidad', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({
          materiales: [{ idMaterial: 1, cantidad: 2 }],
        })
        .expect(HttpStatus.CREATED);

      expect(response.body.id).toBeDefined();
      expect(response.body.estado).toBe(EstadoSolicitudMaterial.PENDIENTE);
    });
  });

  describe('2. Validación de Entrada de Materiales', () => {
    it('rechaza con 400 Bad Request si no se envía la lista de materiales', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({})
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('rechaza con 400 Bad Request si la lista de materiales está vacía', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({
          materiales: [],
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(JSON.stringify(response.body)).toContain(
        'La solicitud debe incluir al menos un material',
      );
    });

    it('rechaza con 400 Bad Request si un material no especifica idMaterial ni materialId', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({
          materiales: [{ cantidad: 5 }],
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('rechaza con 400 Bad Request si se envían objetos de material vacíos o sin cantidad obligatoria', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({
          materiales: [{}],
        })
        .expect(HttpStatus.BAD_REQUEST);

      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({
          materiales: [{ idMaterial: 1 }], // sin cantidad
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('rechaza con 400 Bad Request si la cantidad es 0 o negativa', async () => {
      const resCero = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({
          materiales: [{ idMaterial: 1, cantidad: 0 }],
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(JSON.stringify(resCero.body)).toContain(
        'La cantidad solicitada debe ser mayor a cero',
      );

      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({
          materiales: [{ idMaterial: 1, cantidad: -3 }],
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('rechaza con 400 Bad Request si la cantidad no es un número entero', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({
          materiales: [{ idMaterial: 1, cantidad: 4.7 }],
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('retorna 404 Not Found si el material solicitado no existe en bodega', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({
          materiales: [{ idMaterial: 9999, cantidad: 10 }],
        })
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain(
        'Material con ID 9999 no encontrado en el inventario',
      );
    });

    it('rechaza con 400 Bad Request si el material solicitado se encuentra inactivo', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({
          materiales: [{ idMaterial: 4, cantidad: 2 }],
        })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.message).toContain(
        'se encuentra inactivo y no puede ser solicitado',
      );
    });
  });

  describe('3. Vinculación y Validación con Averías', () => {
    it('permite registrar la solicitud vinculada a una avería asignada al Fontanero autenticado', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({
          idAveria: 10,
          observacion: 'Materiales para atender fuga en tubería de avería 10',
          materiales: [{ idMaterial: 1, cantidad: 4 }],
        })
        .expect(HttpStatus.CREATED);

      expect(response.body.idAveria).toBe(10);
      expect(response.body.averia).toBeDefined();
      expect(response.body.averia.codigoSeguimiento).toBe('AVR-2026-0010');
    });

    it('rechaza con 403 Forbidden si la avería está asignada a OTRO fontanero', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({
          idAveria: 20, // pertenece al fontanero 99
          materiales: [{ idMaterial: 1, cantidad: 2 }],
        })
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body.message).toContain(
        'La avería indicada no está asignada al Fontanero autenticado',
      );
    });

    it('retorna 404 Not Found si la avería indicada no existe', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({
          idAveria: 9999,
          materiales: [{ idMaterial: 1, cantidad: 2 }],
        })
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.message).toContain(
        'Avería con ID 9999 no encontrada',
      );
    });

    it('permite registrar la solicitud sin avería (independiente / mantenimiento)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({
          observacion: 'Mantenimiento preventivo programado',
          materiales: [{ idMaterial: 2, cantidad: 3 }],
        })
        .expect(HttpStatus.CREATED);

      expect(response.body.idAveria).toBeNull();
      expect(response.body.averia).toBeNull();
    });
  });

  describe('4. Registro Exitoso con Múltiples Materiales y Regla de Inmutabilidad de Stock', () => {
    it('permite registrar exitosamente una solicitud con un único material válido', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({
          observacion: 'Reparación puntual de llave',
          materiales: [
            { idMaterial: 1, cantidad: 3, observacion: 'Llave de paso' },
          ],
        })
        .expect(HttpStatus.CREATED);

      expect(response.body.id).toBeDefined();
      expect(response.body.detalles).toHaveLength(1);
      expect(response.body.detalles[0].idMaterial).toBe(1);
      expect(response.body.detalles[0].cantidad).toBe(3);
      expect(response.body.detalles[0].observacion).toBe('Llave de paso');
    });

    it('permite crear múltiples solicitudes consecutivas del mismo material sin alterar el stock en ninguna de ellas', async () => {
      const stockInicial = materialesDb.get(1)!.stockActual;

      // Solicitud 1
      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({ materiales: [{ idMaterial: 1, cantidad: 15 }] })
        .expect(HttpStatus.CREATED);

      expect(materialesDb.get(1)!.stockActual).toBe(stockInicial);

      // Solicitud 2
      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({ materiales: [{ idMaterial: 1, cantidad: 20 }] })
        .expect(HttpStatus.CREATED);

      expect(materialesDb.get(1)!.stockActual).toBe(stockInicial);

      // Solicitud 3
      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({ materiales: [{ idMaterial: 1, cantidad: 10 }] })
        .expect(HttpStatus.CREATED);

      expect(materialesDb.get(1)!.stockActual).toBe(stockInicial);
    });

    it('registra una solicitud con múltiples materiales, código amigable y estado PENDIENTE', async () => {
      const stockAnteriorMat1 = materialesDb.get(1)!.stockActual;
      const stockAnteriorMat2 = materialesDb.get(2)!.stockActual;
      const stockAnteriorMat3 = materialesDb.get(3)!.stockActual;

      const payload = {
        observacion: 'Materiales para empalme nuevo',
        materiales: [
          { idMaterial: 1, cantidad: 5, observacion: '5 metros de tubo' },
          { idMaterial: 2, cantidad: 3, observacion: '3 uniones' },
          { idMaterial: 3, cantidad: 2, observacion: '2 codos' },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send(payload)
        .expect(HttpStatus.CREATED);

      const solicitudCreada = response.body;

      expect(solicitudCreada.id).toBeDefined();
      expect(solicitudCreada.codigo).toMatch(/^SOL-\d{4}$/);
      expect(solicitudCreada.estado).toBe(EstadoSolicitudMaterial.PENDIENTE);
      expect(solicitudCreada.idFontanero).toBe(7);
      expect(solicitudCreada.observacion).toBe('Materiales para empalme nuevo');
      expect(solicitudCreada.fechaSolicitud).toBeDefined();

      // Verificar renglones de detalle
      expect(solicitudCreada.detalles).toHaveLength(3);
      expect(solicitudCreada.detalles[0].idMaterial).toBe(1);
      expect(solicitudCreada.detalles[0].cantidad).toBe(5);
      expect(solicitudCreada.detalles[1].idMaterial).toBe(2);
      expect(solicitudCreada.detalles[1].cantidad).toBe(3);
      expect(solicitudCreada.detalles[2].idMaterial).toBe(3);
      expect(solicitudCreada.detalles[2].cantidad).toBe(2);

      // REGLA FUNDAMENTAL DE NEGOCIO: REGISTRAR UNA SOLICITUD NO MODIFICA EL STOCK
      expect(materialesDb.get(1)!.stockActual).toBe(stockAnteriorMat1);
      expect(materialesDb.get(2)!.stockActual).toBe(stockAnteriorMat2);
      expect(materialesDb.get(3)!.stockActual).toBe(stockAnteriorMat3);
    });

    it('consolida automáticamente materiales repetidos en la solicitud sumando sus cantidades', async () => {
      const payload = {
        materiales: [
          { idMaterial: 1, cantidad: 4, observacion: 'Tramo principal' },
          { idMaterial: 2, cantidad: 1 },
          { idMaterial: 1, cantidad: 6, observacion: 'Tramo secundario' }, // repetido id 1
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send(payload)
        .expect(HttpStatus.CREATED);

      const solicitud = response.body;

      // Debe haberse consolidado a 2 renglones distintos (idMaterial 1 e idMaterial 2)
      expect(solicitud.detalles).toHaveLength(2);

      const detalleMat1 = solicitud.detalles.find(
        (d: any) => d.idMaterial === 1,
      );
      expect(detalleMat1).toBeDefined();
      expect(detalleMat1.cantidad).toBe(10); // 4 + 6 = 10
      expect(detalleMat1.observacion).toBe('Tramo principal; Tramo secundario');

      const detalleMat2 = solicitud.detalles.find(
        (d: any) => d.idMaterial === 2,
      );
      expect(detalleMat2).toBeDefined();
      expect(detalleMat2.cantidad).toBe(1);
    });

    it('soporta materialId como alias de idMaterial y averiaId como alias de idAveria', async () => {
      const payload = {
        averiaId: 10,
        materiales: [
          { materialId: 1, cantidad: 3 },
          { materialId: 2, cantidad: 2 },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send(payload)
        .expect(HttpStatus.CREATED);

      expect(response.body.idAveria).toBe(10);
      expect(response.body.detalles).toHaveLength(2);
      expect(response.body.detalles[0].idMaterial).toBe(1);
      expect(response.body.detalles[0].cantidad).toBe(3);
    });
  });

  describe('5. Consulta y Detalle de Solicitudes (GET Endpoints)', () => {
    it('GET /fontanero/solicitudes-materiales lista exclusivamente las solicitudes del fontanero autenticado', async () => {
      // Registrar solicitud para fontanero 7
      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({
          idAveria: 10,
          observacion: 'Reparación de fuga en calle principal',
          materiales: [
            { idMaterial: 1, cantidad: 5 },
            { idMaterial: 2, cantidad: 3 },
          ],
        })
        .expect(HttpStatus.CREATED);

      // Registrar solicitud para otro fontanero (ID 88)
      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '88')}`)
        .send({
          observacion: 'Mantenimiento del fontanero 88',
          materiales: [{ idMaterial: 3, cantidad: 2 }],
        })
        .expect(HttpStatus.CREATED);

      // Consultar como fontanero 7
      const resFontanero7 = await request(app.getHttpServer())
        .get('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(resFontanero7.body)).toBe(true);
      expect(resFontanero7.body).toHaveLength(1);
      expect(resFontanero7.body[0].idFontanero).toBe(7);
      expect(resFontanero7.body[0].cantidadMateriales).toBe(2);
      expect(resFontanero7.body[0].totalMateriales).toBe(8);
      expect(resFontanero7.body[0].averia).toBeDefined();
      expect(resFontanero7.body[0].averia.codigo).toBe('AVR-2026-0010');

      // Consultar como fontanero 88
      const resFontanero88 = await request(app.getHttpServer())
        .get('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '88')}`)
        .expect(HttpStatus.OK);

      expect(resFontanero88.body).toHaveLength(1);
      expect(resFontanero88.body[0].idFontanero).toBe(88);
      expect(resFontanero88.body[0].cantidadMateriales).toBe(1);
      expect(resFontanero88.body[0].totalMateriales).toBe(2);
      expect(resFontanero88.body[0].averia).toBeNull();
    });

    it('GET con parámetros de paginación retorna estructura { data, total, page, limit, totalPages }', async () => {
      // Registrar 2 solicitudes para fontanero 7
      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({ materiales: [{ idMaterial: 1, cantidad: 2 }] })
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({ materiales: [{ idMaterial: 2, cantidad: 4 }] })
        .expect(HttpStatus.CREATED);

      const resPaginado = await request(app.getHttpServer())
        .get('/api/v1/fontanero/solicitudes-materiales?page=1&limit=1')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .expect(HttpStatus.OK);

      expect(resPaginado.body).toHaveProperty('data');
      expect(resPaginado.body).toHaveProperty('total');
      expect(resPaginado.body).toHaveProperty('page', 1);
      expect(resPaginado.body).toHaveProperty('limit', 1);
      expect(resPaginado.body.data).toHaveLength(1);
      expect(resPaginado.body.total).toBe(2);
    });

    it('soporta la ruta alias /api/v1/inventario/solicitudes-materiales para consulta', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/inventario/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .expect(HttpStatus.OK);
    });

    it('GET /fontanero/solicitudes-materiales/:id retorna el detalle completo con catálogo de materiales', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({
          idAveria: 10,
          observacion: 'Detalle de reparación en tubo principal',
          materiales: [
            {
              idMaterial: 1,
              cantidad: 5,
              observacion: 'Tramo de alta presión',
            },
          ],
        })
        .expect(HttpStatus.CREATED);

      const solicitudId = createRes.body.id;

      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/fontanero/solicitudes-materiales/${solicitudId}`)
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .expect(HttpStatus.OK);

      const body = detailRes.body;
      expect(body.id).toBe(solicitudId);
      expect(body.idFontanero).toBe(7);
      expect(body.estado).toBe(EstadoSolicitudMaterial.PENDIENTE);
      expect(body.observacion).toBe('Detalle de reparación en tubo principal');
      expect(body.averia).toBeDefined();
      expect(body.averia.codigo).toBe('AVR-2026-0010');

      expect(body.detalles).toHaveLength(1);
      expect(body.detalles[0].idMaterial).toBe(1);
      expect(body.detalles[0].cantidad).toBe(5);
      expect(body.detalles[0].observacion).toBe('Tramo de alta presión');
      expect(body.detalles[0].material).toBeDefined();
      expect(body.detalles[0].material.nombre).toBe('Tubo PVC 1/2"');
      expect(body.detalles[0].material.unidadMedida).toBe('Metro');
      expect(body.detalles[0].material.stockActual).toBe(50);
    });

    it('GET /fontanero/solicitudes-materiales/:id rechaza con 403 Forbidden si pertenece a otro fontanero', async () => {
      // Fontanero 88 crea una solicitud
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '88')}`)
        .send({
          materiales: [{ idMaterial: 1, cantidad: 2 }],
        })
        .expect(HttpStatus.CREATED);

      const solicitudId = createRes.body.id;

      // Fontanero 7 intenta consultar la solicitud del fontanero 88
      const res = await request(app.getHttpServer())
        .get(`/api/v1/fontanero/solicitudes-materiales/${solicitudId}`)
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`);

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
      expect(res.body.message).toContain('No tiene permiso');
    });

    it('GET /fontanero/solicitudes-materiales/:id retorna 404 Not Found si la solicitud no existe', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/fontanero/solicitudes-materiales/9999')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('rechaza con 401 Unauthorized si no se envía token JWT en consultas', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/fontanero/solicitudes-materiales')
        .expect(HttpStatus.UNAUTHORIZED);

      await request(app.getHttpServer())
        .get('/api/v1/fontanero/solicitudes-materiales/1')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 403 Forbidden si un rol no fontanero (ej. SECRETARIA, ADMINISTRADORA) intenta consultar', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.SECRETARIA, '2')}`)
        .expect(HttpStatus.FORBIDDEN);

      await request(app.getHttpServer())
        .get('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.ADMINISTRADORA, '1')}`)
        .expect(HttpStatus.FORBIDDEN);
    });

    it('garantiza que consultar el listado y el detalle NO altere las existencias físicas de inventario', async () => {
      const mat1Antes = materialesDb.get(1)!.stockActual;

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({ materiales: [{ idMaterial: 1, cantidad: 10 }] })
        .expect(HttpStatus.CREATED);

      // Consultar listado y detalle varias veces
      await request(app.getHttpServer())
        .get('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .expect(HttpStatus.OK);

      await request(app.getHttpServer())
        .get(`/api/v1/fontanero/solicitudes-materiales/${createRes.body.id}`)
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .expect(HttpStatus.OK);

      const mat1Despues = materialesDb.get(1)!.stockActual;
      expect(mat1Despues).toBe(mat1Antes);
    });

    it('rechaza con 400 Bad Request si el frontend intenta enviar un fontaneroId o idFontanero en query params al listar', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/fontanero/solicitudes-materiales?fontaneroId=99')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .expect(HttpStatus.BAD_REQUEST);

      expect(JSON.stringify(response.body)).toContain('fontaneroId');

      const response2 = await request(app.getHttpServer())
        .get('/api/v1/fontanero/solicitudes-materiales?idFontanero=99')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .expect(HttpStatus.BAD_REQUEST);

      expect(JSON.stringify(response2.body)).toContain('idFontanero');
    });

    it('filtra correctamente las solicitudes por estado', async () => {
      const sol1 = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({ materiales: [{ idMaterial: 1, cantidad: 2 }] })
        .expect(HttpStatus.CREATED);

      const sol2 = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({ materiales: [{ idMaterial: 2, cantidad: 3 }] })
        .expect(HttpStatus.CREATED);

      const sol2Db = solicitudesDb.get(sol2.body.id)!;
      sol2Db.estado = EstadoSolicitudMaterial.APROBADA;

      const resPendientes = await request(app.getHttpServer())
        .get('/api/v1/fontanero/solicitudes-materiales?estado=PENDIENTE')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .expect(HttpStatus.OK);

      expect(resPendientes.body).toHaveLength(1);
      expect(resPendientes.body[0].id).toBe(sol1.body.id);
      expect(resPendientes.body[0].estado).toBe(
        EstadoSolicitudMaterial.PENDIENTE,
      );

      const resAprobadas = await request(app.getHttpServer())
        .get('/api/v1/fontanero/solicitudes-materiales?estado=APROBADA')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .expect(HttpStatus.OK);

      expect(resAprobadas.body).toHaveLength(1);
      expect(resAprobadas.body[0].id).toBe(sol2.body.id);
      expect(resAprobadas.body[0].estado).toBe(EstadoSolicitudMaterial.APROBADA);
    });

    it('filtra correctamente las solicitudes por idAveria o averiaId', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({ idAveria: 10, materiales: [{ idMaterial: 1, cantidad: 2 }] })
        .expect(HttpStatus.CREATED);

      await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({ materiales: [{ idMaterial: 2, cantidad: 1 }] })
        .expect(HttpStatus.CREATED);

      const resConAveria = await request(app.getHttpServer())
        .get('/api/v1/fontanero/solicitudes-materiales?idAveria=10')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .expect(HttpStatus.OK);

      expect(resConAveria.body).toHaveLength(1);
      expect(resConAveria.body[0].idAveria).toBe(10);

      const resConAlias = await request(app.getHttpServer())
        .get('/api/v1/fontanero/solicitudes-materiales?averiaId=10')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .expect(HttpStatus.OK);

      expect(resConAlias.body).toHaveLength(1);
      expect(resConAlias.body[0].idAveria).toBe(10);
    });

    it('retorna lista vacía [] cuando el fontanero no tiene solicitudes registradas', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });

    it('retorna las solicitudes ordenadas cronológicamente de forma descendente', async () => {
      const sol1 = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({ materiales: [{ idMaterial: 1, cantidad: 1 }] })
        .expect(HttpStatus.CREATED);

      const sol2 = await request(app.getHttpServer())
        .post('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .send({ materiales: [{ idMaterial: 2, cantidad: 2 }] })
        .expect(HttpStatus.CREATED);

      solicitudesDb.get(sol1.body.id)!.fechaSolicitud = new Date(
        '2026-09-01T10:00:00Z',
      );
      solicitudesDb.get(sol2.body.id)!.fechaSolicitud = new Date(
        '2026-09-10T10:00:00Z',
      );

      const res = await request(app.getHttpServer())
        .get('/api/v1/fontanero/solicitudes-materiales')
        .set('Authorization', `Bearer ${signAs(Role.FONTANERO, '7')}`)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveLength(2);
      expect(res.body[0].id).toBe(sol2.body.id);
      expect(res.body[1].id).toBe(sol1.body.id);
    });
  });
});
