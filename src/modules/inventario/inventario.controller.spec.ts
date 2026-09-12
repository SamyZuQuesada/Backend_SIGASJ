import {
  BadRequestException,
  HttpStatus,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import jwtConfig from '../../config/jwt.config';
import { AuthModule } from '../auth/auth.module';
import { CambiarEstadoMaterialDto } from './dto/cambiar-estado-material.dto';
import { CreateMaterialDto } from './dto/create-material.dto';
import { QueryMaterialesDto } from './dto/query-materiales.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { DocumentoMovimientoInventario } from './entities/documento-movimiento-inventario.entity';
import { Material } from './entities/material.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';
import { SolicitudMaterial } from './entities/solicitud-material.entity';
import { DetalleSolicitudMaterial } from './entities/detalle-solicitud-material.entity';
import { Averia } from '../averias/entities/averia.entity';
import { RegistrarEntradaDto } from './dto/registrar-entrada.dto';
import { RegistrarSalidaDto } from './dto/registrar-salida.dto';
import { InventarioController } from './inventario.controller';
import { InventarioModule } from './inventario.module';
import { InventarioService, MaterialesPaginados } from './inventario.service';

type MaterialResponseBody = {
  id: number;
  nombre: string;
  unidadMedida: string;
  stockActual: number;
  activo: boolean;
};

type MaterialesPaginadosResponse = {
  data: MaterialResponseBody[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type CategoriaResponseBody = {
  id: number;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
};

describe('InventarioController — Endpoints de Materiales', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let controller: InventarioController;
  let createServiceSpy: jest.Mock;
  let findAllServiceSpy: jest.Mock;
  let findOneServiceSpy: jest.Mock;
  let updateServiceSpy: jest.Mock;
  let cambiarEstadoServiceSpy: jest.Mock;
  let createCategoriaServiceSpy: jest.Mock;
  let findAllCategoriasServiceSpy: jest.Mock;
  let findOneCategoriaServiceSpy: jest.Mock;
  let updateCategoriaServiceSpy: jest.Mock;
  let cambiarEstadoCategoriaServiceSpy: jest.Mock;
  let createProveedorServiceSpy: jest.Mock;
  let findAllProveedoresServiceSpy: jest.Mock;
  let findOneProveedorServiceSpy: jest.Mock;
  let updateProveedorServiceSpy: jest.Mock;
  let cambiarEstadoProveedorServiceSpy: jest.Mock;
  let registrarEntradaServiceSpy: jest.Mock;
  let registrarSalidaServiceSpy: jest.Mock;
  let validarDisponibilidadStockSpy: jest.Mock;

  const signAs = (role: Role | string, sub = '1') => {
    const payload: JwtPayload = {
      sub,
      email: 'usuario@asadasanjuan.cr',
      role: role as Role,
      name: 'Usuario Prueba',
    };
    return jwtService.sign(payload);
  };

  beforeAll(async () => {
    const mockRepo = {
      createQueryBuilder: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as Repository<Material>;

    createServiceSpy = jest
      .fn()
      .mockImplementation((dto: CreateMaterialDto) => {
        return Promise.resolve({
          id: 1,
          nombre: dto.nombre.trim(),
          descripcion: dto.descripcion ?? null,
          unidadMedida: dto.unidadMedida.trim(),
          ubicacion: dto.ubicacion ?? null,
          stockMinimo: dto.stockMinimo ?? 0,
          stockActual: 0,
          activo: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Material);
      });

    findAllServiceSpy = jest
      .fn()
      .mockImplementation((query: QueryMaterialesDto) => {
        const page = query.page ?? 1;
        const limit = query.limit ?? 10;
        const mockItem: Material = {
          id: 1,
          nombre: 'Tubo PVC 1/2 pulgada',
          descripcion: null,
          unidadMedida: 'Tubo',
          ubicacion: 'Bodega 1',
          stockMinimo: 10,
          stockActual: 25,
          activo: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          validar: jest.fn(),
        };

        const result: MaterialesPaginados = {
          data: [mockItem],
          total: 1,
          page,
          limit,
          totalPages: 1,
        };
        return Promise.resolve(result);
      });

    findOneServiceSpy = jest.fn().mockImplementation((id: number) => {
      if (id === 999) {
        return Promise.reject(
          new NotFoundException(`Material con ID ${id} no encontrado`),
        );
      }
      return Promise.resolve({
        id,
        nombre: 'Tubo PVC 1/2 pulgada',
        descripcion: 'Tubo para conducción de agua potable',
        unidadMedida: 'Tubo',
        ubicacion: 'Bodega Principal - Pasillo 2',
        stockMinimo: 10,
        stockActual: 30,
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Material);
    });

    updateServiceSpy = jest
      .fn()
      .mockImplementation((id: number, dto: UpdateMaterialDto) => {
        return Promise.resolve({
          id,
          nombre: dto.nombre ?? 'Tubo PVC 1/2 pulgada',
          descripcion: dto.descripcion ?? null,
          unidadMedida: dto.unidadMedida ?? 'Tubo',
          ubicacion: dto.ubicacion ?? null,
          stockMinimo: dto.stockMinimo ?? 10,
          stockActual: 30, // Conserva stock
          activo: dto.activo ?? true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Material);
      });

    cambiarEstadoServiceSpy = jest
      .fn()
      .mockImplementation((id: number, activo: boolean) => {
        if (id === 999) {
          return Promise.reject(
            new NotFoundException(`Material con ID ${id} no encontrado`),
          );
        }
        return Promise.resolve({
          id,
          nombre: 'Tubo PVC 1/2 pulgada',
          descripcion: null,
          unidadMedida: 'Tubo',
          ubicacion: 'Bodega 1',
          stockMinimo: 10,
          stockActual: 30,
          activo,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Material);
      });

    createCategoriaServiceSpy = jest
      .fn()
      .mockImplementation((dto: { nombre: string; descripcion?: string }) => {
        return Promise.resolve({
          id: 1,
          nombre: dto.nombre.trim(),
          descripcion: dto.descripcion ?? null,
          activo: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as CategoriaMaterial);
      });

    findAllCategoriasServiceSpy = jest
      .fn()
      .mockImplementation((query?: { page?: number; limit?: number }) => {
        return Promise.resolve({
          data: [
            {
              id: 1,
              nombre: 'Tuberías',
              descripcion: 'Líneas principales',
              activo: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ] as CategoriaMaterial[],
          total: 1,
          page: query?.page ?? 1,
          limit: query?.limit ?? 20,
          totalPages: 1,
        });
      });

    findOneCategoriaServiceSpy = jest.fn().mockImplementation((id: number) => {
      if (id === 999) {
        return Promise.reject(new NotFoundException('Categoría no encontrada'));
      }
      return Promise.resolve({
        id,
        nombre: 'Tuberías',
        descripcion: 'Líneas principales',
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as CategoriaMaterial);
    });

    updateCategoriaServiceSpy = jest
      .fn()
      .mockImplementation(
        (id: number, dto: { nombre?: string; descripcion?: string }) => {
          if (id === 999) {
            return Promise.reject(
              new NotFoundException('Categoría no encontrada'),
            );
          }
          return Promise.resolve({
            id,
            nombre: dto.nombre ? dto.nombre.trim() : 'Tuberías',
            descripcion:
              dto.descripcion !== undefined
                ? dto.descripcion
                : 'Líneas principales',
            activo: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as CategoriaMaterial);
        },
      );

    cambiarEstadoCategoriaServiceSpy = jest
      .fn()
      .mockImplementation((id: number, activo: boolean) => {
        if (id === 999) {
          return Promise.reject(
            new NotFoundException('Categoría no encontrada'),
          );
        }
        return Promise.resolve({
          id,
          nombre: 'Tuberías',
          descripcion: 'Líneas principales',
          activo,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as CategoriaMaterial);
      });

    createProveedorServiceSpy = jest.fn().mockImplementation((dto: any) => {
      return Promise.resolve({
        id: 1,
        nombre: dto.nombre.trim(),
        razonSocial: dto.razonSocial ?? null,
        identificacion: dto.identificacion ?? null,
        telefono: dto.telefono ?? null,
        correo: dto.correo ?? null,
        direccion: dto.direccion ?? null,
        personaContacto: dto.personaContacto ?? null,
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Proveedor);
    });

    findAllProveedoresServiceSpy = jest.fn().mockImplementation(() => {
      return Promise.resolve({
        data: [
          {
            id: 1,
            nombre: 'Ferretería El Lagar',
            activo: true,
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
    });

    findOneProveedorServiceSpy = jest.fn().mockImplementation((id: number) => {
      if (id === 999) {
        return Promise.reject(new NotFoundException('Proveedor no encontrado'));
      }
      return Promise.resolve({
        id,
        nombre: 'Ferretería El Lagar',
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Proveedor);
    });

    updateProveedorServiceSpy = jest
      .fn()
      .mockImplementation((id: number, dto: any) => {
        if (id === 999) {
          return Promise.reject(
            new NotFoundException('Proveedor no encontrado'),
          );
        }
        return Promise.resolve({
          id,
          nombre: dto.nombre ? dto.nombre.trim() : 'Ferretería El Lagar',
          telefono: dto.telefono ?? null,
          activo: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Proveedor);
      });

    cambiarEstadoProveedorServiceSpy = jest
      .fn()
      .mockImplementation((id: number, activo: boolean) => {
        if (id === 999) {
          return Promise.reject(
            new NotFoundException('Proveedor no encontrado'),
          );
        }
        return Promise.resolve({
          id,
          nombre: 'Ferretería El Lagar',
          activo,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Proveedor);
      });

    registrarEntradaServiceSpy = jest
      .fn()
      .mockImplementation((dto: any, user: any) => {
        const idMaterial = dto.idMaterial ?? dto.materialId;
        if (idMaterial === 999) {
          return Promise.reject(
            new NotFoundException(
              'Material con ID 999 no encontrado en el inventario',
            ),
          );
        }
        return Promise.resolve({
          movimiento: {
            id: 1,
            tipo: 'ENTRADA',
            cantidad: dto.cantidad,
            idMaterial,
            idUsuario: Number(user?.userId || 1),
            idProveedor: dto.idProveedor ?? dto.proveedorId ?? null,
            observacion: dto.observacion ?? null,
            fechaMovimiento: dto.fechaMovimiento ?? new Date(),
            createdAt: new Date(),
          },
          material: {
            id: idMaterial,
            nombre: 'Tubo PVC 1/2 pulgada',
            stockActual: 35,
            activo: true,
          },
          stockAnterior: 20,
          stockActual: 35,
          mensaje: 'Entrada registrada exitosamente.',
        });
      });

    registrarSalidaServiceSpy = jest
      .fn()
      .mockImplementation((dto: any, user: any) => {
        const idMaterial = dto.idMaterial ?? dto.materialId;
        if (idMaterial === 999) {
          return Promise.reject(
            new NotFoundException(
              'Material con ID 999 no encontrado en el inventario',
            ),
          );
        }
        if (dto.cantidad > 30) {
          return Promise.reject(
            new BadRequestException(
              `Stock insuficiente para realizar la salida. Existencias disponibles: 30, cantidad solicitada: ${dto.cantidad}`,
            ),
          );
        }
        return Promise.resolve({
          movimiento: {
            id: 2,
            tipo: 'SALIDA',
            cantidad: dto.cantidad,
            idMaterial,
            idUsuario: Number(user?.userId || 1),
            idAveria: dto.idAveria ?? dto.averiaId ?? null,
            idSolicitud: dto.idSolicitud ?? dto.solicitudId ?? null,
            observacion: dto.observacion ?? null,
            fechaMovimiento: dto.fechaMovimiento ?? new Date(),
            createdAt: new Date(),
          },
          material: {
            id: idMaterial,
            nombre: 'Tubo PVC 1/2 pulgada',
            stockActual: 30 - dto.cantidad,
            activo: true,
          },
          stockAnterior: 30,
          stockActual: 30 - dto.cantidad,
          mensaje: 'Salida física registrada exitosamente.',
        });
      });

    validarDisponibilidadStockSpy = jest
      .fn()
      .mockImplementation((id: number, cantidad: number) => {
        if (id === 999) {
          return Promise.reject(
            new NotFoundException(
              'Material con ID 999 no encontrado en el inventario',
            ),
          );
        }
        if (cantidad <= 0) {
          return Promise.reject(
            new BadRequestException(
              'La cantidad a retirar debe ser un número entero mayor a cero',
            ),
          );
        }
        if (cantidad > 10) {
          return Promise.reject(
            new BadRequestException(
              `Stock insuficiente para realizar la salida. Existencias disponibles: 10, cantidad solicitada: ${cantidad}`,
            ),
          );
        }
        return Promise.resolve({
          esValido: true,
          materialId: id,
          materialNombre: 'Tubo PVC 1/2 pulgada',
          stockActual: 10,
          cantidadSolicitada: cantidad,
          stockFinal: 10 - cantidad,
          stockMinimo: 3,
          alcanzaStockMinimo: 10 - cantidad <= 3,
          esAgotamientoTotal: 10 - cantidad === 0,
          mensaje: 'Salida autorizada.',
          material: {
            id,
            nombre: 'Tubo PVC 1/2 pulgada',
            stockActual: 10,
            stockMinimo: 3,
            activo: true,
          },
        });
      });

    const mockInventarioService = {
      create: createServiceSpy,
      findAll: findAllServiceSpy,
      findOne: findOneServiceSpy,
      update: updateServiceSpy,
      cambiarEstado: cambiarEstadoServiceSpy,
      createCategoria: createCategoriaServiceSpy,
      findAllCategorias: findAllCategoriasServiceSpy,
      findOneCategoria: findOneCategoriaServiceSpy,
      updateCategoria: updateCategoriaServiceSpy,
      cambiarEstadoCategoria: cambiarEstadoCategoriaServiceSpy,
      createProveedor: createProveedorServiceSpy,
      findAllProveedores: findAllProveedoresServiceSpy,
      findOneProveedor: findOneProveedorServiceSpy,
      updateProveedor: updateProveedorServiceSpy,
      cambiarEstadoProveedor: cambiarEstadoProveedorServiceSpy,
      registrarEntrada: registrarEntradaServiceSpy,
      registrarSalida: registrarSalidaServiceSpy,
      validarDisponibilidadStock: validarDisponibilidadStockSpy,
    };

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
      .useValue(mockRepo)
      .overrideProvider(getRepositoryToken(CategoriaMaterial))
      .useValue({})
      .overrideProvider(getRepositoryToken(Proveedor))
      .useValue({})
      .overrideProvider(getRepositoryToken(MovimientoInventario))
      .useValue({})
      .overrideProvider(getRepositoryToken(DocumentoMovimientoInventario))
      .useValue({})
      .overrideProvider(getRepositoryToken(SolicitudMaterial))
      .useValue({})
      .overrideProvider(getRepositoryToken(DetalleSolicitudMaterial))
      .useValue({})
      .overrideProvider(getRepositoryToken(Averia))
      .useValue({})
      .overrideProvider(InventarioService)
      .useValue(mockInventarioService)
      .compile();

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
    controller = moduleRef.get<InventarioController>(InventarioController);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Unidad: Controlador', () => {
    it('debe estar definido el controlador', () => {
      expect(controller).toBeDefined();
    });

    it('debe delegar el registro de material al servicio', async () => {
      const dto: CreateMaterialDto = {
        nombre: 'Codo PVC 1/2"',
        unidadMedida: 'Unidad',
        stockMinimo: 15,
      };

      const result = await controller.create(dto);

      expect(createServiceSpy).toHaveBeenCalledWith(dto);
      expect(result.id).toBe(1);
      expect(result.nombre).toBe('Codo PVC 1/2"');
      expect(result.stockActual).toBe(0);
    });

    it('debe delegar la consulta de materiales al servicio', async () => {
      const query: QueryMaterialesDto = { page: 2, limit: 5 };
      const result = await controller.findAll(query);

      expect(findAllServiceSpy).toHaveBeenCalledWith(query);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(5);
      expect(result.data).toHaveLength(1);
    });

    it('debe delegar la consulta de detalle (GET by ID) al servicio', async () => {
      const result = await controller.findOne(1);

      expect(findOneServiceSpy).toHaveBeenCalledWith(1);
      expect(result.id).toBe(1);
      expect(result.nombre).toBe('Tubo PVC 1/2 pulgada');
    });

    it('debe delegar la actualización completa (PUT) al servicio', async () => {
      const dto: UpdateMaterialDto = {
        nombre: 'Codo PVC 1/2" Reforzado',
        unidadMedida: 'Unidad',
      };

      const result = await controller.updatePut(3, dto);

      expect(updateServiceSpy).toHaveBeenCalledWith(3, dto);
      expect(result.id).toBe(3);
      expect(result.nombre).toBe('Codo PVC 1/2" Reforzado');
    });

    it('debe delegar la actualización parcial (PATCH) al servicio', async () => {
      const dto: UpdateMaterialDto = {
        stockMinimo: 20,
      };

      const result = await controller.updatePatch(3, dto);

      expect(updateServiceSpy).toHaveBeenCalledWith(3, dto);
      expect(result.id).toBe(3);
    });

    it('debe delegar el cambio de estado al servicio', async () => {
      const dto: CambiarEstadoMaterialDto = { activo: false };

      const result = await controller.cambiarEstado(3, dto);

      expect(cambiarEstadoServiceSpy).toHaveBeenCalledWith(3, false);
      expect(result.id).toBe(3);
      expect(result.activo).toBe(false);
    });

    it('debe delegar el registro de entradas físicas al servicio con el usuario autenticado', async () => {
      const dto: RegistrarEntradaDto = {
        idMaterial: 1,
        cantidad: 15,
        observacion: 'Ingreso inicial',
      };
      const user = {
        userId: '2',
        email: 'admin@sigasj.cr',
        role: Role.ADMINISTRADORA,
      };

      const result = await controller.registrarEntrada(dto, user);

      expect(registrarEntradaServiceSpy).toHaveBeenCalledWith(dto, user);
      expect(result.stockActual).toBe(35);
    });

    it('debe delegar el registro de salidas físicas al servicio con el usuario autenticado', async () => {
      const dto = {
        idMaterial: 1,
        cantidad: 5,
        observacion: 'Reparación de fuga',
      };
      const user = {
        userId: '3',
        email: 'fontanero@sigasj.cr',
        role: Role.FONTANERO,
      };

      const result = await controller.registrarSalida(dto, user);

      expect(registrarSalidaServiceSpy).toHaveBeenCalledWith(dto, user);
      expect(result.stockActual).toBe(25);
    });

    it('debe delegar la verificación de disponibilidad de stock al servicio', async () => {
      const result = await controller.validarDisponibilidad(1, 4);

      expect(validarDisponibilidadStockSpy).toHaveBeenCalledWith(1, 4);
      expect(result.esValido).toBe(true);
      expect(result.stockFinal).toBe(6);
    });
  });

  describe('Integración HTTP: POST /api/v1/inventario/materiales', () => {
    const validPayload = {
      nombre: 'Tubo PVC 1/2 pulgada',
      descripcion: 'Tubo para conducción de agua potable',
      unidadMedida: 'Tubo',
      ubicacion: 'Bodega Principal - Pasillo 2',
      stockMinimo: 10,
    };

    it('rechaza con 401 Unauthorized si no se envía token JWT', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .send(validPayload);

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 403 Forbidden si el rol es FONTANERO', async () => {
      const token = signAs(Role.FONTANERO);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload);

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('rechaza con 403 Forbidden si el rol es SECRETARIA', async () => {
      const token = signAs(Role.SECRETARIA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload);

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('permite el registro con 201 Created cuando el rol es ADMINISTRADORA', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send(validPayload);

      expect(response.status).toBe(HttpStatus.CREATED);
      const body = response.body as MaterialResponseBody;
      expect(body).toHaveProperty('id');
      expect(body.nombre).toBe('Tubo PVC 1/2 pulgada');
      expect(body.unidadMedida).toBe('Tubo');
      expect(body.stockActual).toBe(0);
      expect(body.activo).toBe(true);
    });

    it('rechaza con 400 Bad Request cuando faltan campos obligatorios', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          descripcion: 'Falta nombre y unidadMedida',
        });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('rechaza con 400 Bad Request si se envían propiedades no permitidas en whitelist', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validPayload,
          stockActual: 50,
        });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('permite registrar material enviando idCategoria o categoriaId', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...validPayload,
          idCategoria: 2,
        });

      expect(response.status).toBe(HttpStatus.CREATED);
      expect(createServiceSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          idCategoria: 2,
        }),
      );
    });
  });

  describe('Integración HTTP: GET /api/v1/inventario/materiales', () => {
    it('rechaza con 401 Unauthorized si no se envía token JWT', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/inventario/materiales',
      );

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 403 Forbidden si el rol no es parte del personal autorizado', async () => {
      const token = signAs('ABONADO');

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('permite la consulta a ADMINISTRADORA con 200 OK y estructura paginada', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales?page=1&limit=10')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.OK);
      const body = response.body as MaterialesPaginadosResponse;
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('page');
      expect(body).toHaveProperty('limit');
      expect(body).toHaveProperty('totalPages');
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('permite la consulta a SECRETARIA con 200 OK para formularios de solicitudes', async () => {
      const token = signAs(Role.SECRETARIA);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.OK);
    });

    it('permite la consulta a FONTANERO con 200 OK para formularios de campo y averías', async () => {
      const token = signAs(Role.FONTANERO);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales?activo=true')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.OK);
    });

    it('permite filtrar materiales por idCategoria en query params', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales?idCategoria=2')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.OK);
      expect(findAllServiceSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          idCategoria: 2,
        }),
      );
    });
  });

  describe('Integración HTTP: GET /api/v1/inventario/materiales/:id', () => {
    it('rechaza con 401 Unauthorized si no se envía token JWT', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/inventario/materiales/1',
      );

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 403 Forbidden si el rol no está autorizado', async () => {
      const token = signAs('ABONADO');

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales/1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('permite la consulta a ADMINISTRADORA con 200 OK y devuelve el detalle completo', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales/1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.OK);
      const body = response.body as MaterialResponseBody;
      expect(body.id).toBe(1);
      expect(body.nombre).toBe('Tubo PVC 1/2 pulgada');
      expect(body.stockActual).toBe(30);
      expect(body.activo).toBe(true);
    });

    it('permite la consulta a SECRETARIA con 200 OK para detalles y solicitudes', async () => {
      const token = signAs(Role.SECRETARIA);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales/1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.OK);
    });

    it('permite la consulta a FONTANERO con 200 OK para órdenes de campo', async () => {
      const token = signAs(Role.FONTANERO);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales/1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.OK);
    });

    it('rechaza con 400 Bad Request si el parámetro ID no es numérico', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales/no_es_numero')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('retorna 404 Not Found si el material solicitado no existe', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales/999')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('Integración HTTP: PUT /api/v1/inventario/materiales/:id', () => {
    const updatePayload = {
      nombre: 'Tubo PVC 1/2 pulgada Clase 10',
      descripcion: 'Actualizado para soportar mayor presión',
      unidadMedida: 'Tubo',
      ubicacion: 'Bodega Principal - Estante B',
      stockMinimo: 15,
      activo: true,
    };

    it('rechaza con 401 Unauthorized si no se envía token JWT', async () => {
      const response = await request(app.getHttpServer())
        .put('/api/v1/inventario/materiales/1')
        .send(updatePayload);

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 403 Forbidden si el rol es FONTANERO', async () => {
      const token = signAs(Role.FONTANERO);

      const response = await request(app.getHttpServer())
        .put('/api/v1/inventario/materiales/1')
        .set('Authorization', `Bearer ${token}`)
        .send(updatePayload);

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('rechaza con 403 Forbidden si el rol es SECRETARIA', async () => {
      const token = signAs(Role.SECRETARIA);

      const response = await request(app.getHttpServer())
        .put('/api/v1/inventario/materiales/1')
        .set('Authorization', `Bearer ${token}`)
        .send(updatePayload);

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('permite la actualización completa con 200 OK cuando el rol es ADMINISTRADORA', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .put('/api/v1/inventario/materiales/1')
        .set('Authorization', `Bearer ${token}`)
        .send(updatePayload);

      expect(response.status).toBe(HttpStatus.OK);
      const body = response.body as MaterialResponseBody;
      expect(body.id).toBe(1);
      expect(body.nombre).toBe('Tubo PVC 1/2 pulgada Clase 10');
      expect(body.stockActual).toBe(30); // Preservado
    });

    it('rechaza con 400 Bad Request si el parámetro ID no es numérico', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .put('/api/v1/inventario/materiales/invalido')
        .set('Authorization', `Bearer ${token}`)
        .send(updatePayload);

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('rechaza con 400 Bad Request si se intenta modificar stockActual (prohibido por whitelist)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .put('/api/v1/inventario/materiales/1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...updatePayload,
          stockActual: 100,
        });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Integración HTTP: PATCH /api/v1/inventario/materiales/:id', () => {
    it('rechaza con 401 Unauthorized si no se envía token JWT', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/materiales/1')
        .send({ stockMinimo: 20 });

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 403 Forbidden si el rol es FONTANERO', async () => {
      const token = signAs(Role.FONTANERO);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/materiales/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ stockMinimo: 20 });

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('rechaza con 403 Forbidden si el rol es SECRETARIA', async () => {
      const token = signAs(Role.SECRETARIA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/materiales/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ stockMinimo: 20 });

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('permite la actualización parcial con 200 OK cuando el rol es ADMINISTRADORA', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/materiales/1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ubicacion: 'Bodega Central - Estante 4',
          stockMinimo: 12,
        });

      expect(response.status).toBe(HttpStatus.OK);
      const body = response.body as MaterialResponseBody;
      expect(body.id).toBe(1);
    });

    it('permite desvincular la categoría enviando idCategoria: null', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/materiales/1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          idCategoria: null,
        });

      expect(response.status).toBe(HttpStatus.OK);
      expect(updateServiceSpy).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          idCategoria: null,
        }),
      );
    });

    it('rechaza con 400 Bad Request si se intenta alterar stockActual en PATCH (prohibido por whitelist)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/materiales/1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stockActual: 80,
        });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('rechaza con 400 Bad Request si el valor enviado no cumple las restricciones', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/materiales/1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          stockMinimo: -10,
        });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Integración HTTP: PATCH /api/v1/inventario/materiales/:id/estado', () => {
    it('rechaza con 401 Unauthorized si no se envía token JWT', async () => {
      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/materiales/1/estado')
        .send({ activo: false });

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 403 Forbidden si el rol es FONTANERO', async () => {
      const token = signAs(Role.FONTANERO);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/materiales/1/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('rechaza con 403 Forbidden si el rol es SECRETARIA', async () => {
      const token = signAs(Role.SECRETARIA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/materiales/1/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('permite desactivar un material con 200 OK cuando el rol es ADMINISTRADORA', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/materiales/1/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });

      expect(response.status).toBe(HttpStatus.OK);
      const body = response.body as MaterialResponseBody;
      expect(body.id).toBe(1);
      expect(body.activo).toBe(false);
      expect(cambiarEstadoServiceSpy).toHaveBeenCalledWith(1, false);
    });

    it('permite reactivar un material con 200 OK enviando el texto "Activo"', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/materiales/1/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: 'Activo' });

      expect(response.status).toBe(HttpStatus.OK);
      const body = response.body as MaterialResponseBody;
      expect(body.id).toBe(1);
      expect(body.activo).toBe(true);
      expect(cambiarEstadoServiceSpy).toHaveBeenCalledWith(1, true);
    });

    it('rechaza con 400 Bad Request si el parámetro ID no es numérico', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/materiales/id_invalido/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('rechaza con 400 Bad Request si el valor de estado no es válido', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/materiales/1/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: 'valor_invalido' });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('retorna 404 Not Found si el material a actualizar no existe', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/materiales/999/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });

      expect(response.status).toBe(HttpStatus.NOT_FOUND);
    });
  });

  /* =========================================================================
   * INTEGRACIÓN HTTP: CATEGORÍAS DE MATERIALES
   * ========================================================================= */

  describe('Integración HTTP: POST /api/v1/inventario/categorias', () => {
    it('permite el registro de una categoría con rol ADMINISTRADORA (201)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/categorias')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Tuberías y Mangueras',
          descripcion: 'Líneas principales',
        });

      expect(response.status).toBe(HttpStatus.CREATED);
      expect(response.body).toHaveProperty('id');
      const bodyCreated = response.body as CategoriaResponseBody;
      expect(bodyCreated.nombre).toBe('Tuberías y Mangueras');
      expect(bodyCreated.activo).toBe(true);
    });

    it('rechaza con 403 Forbidden si un FONTANERO o SECRETARIA intenta registrar una categoría', async () => {
      const tokenFontanero = signAs(Role.FONTANERO);
      const resFontanero = await request(app.getHttpServer())
        .post('/api/v1/inventario/categorias')
        .set('Authorization', `Bearer ${tokenFontanero}`)
        .send({ nombre: 'Categoría No Permitida' });

      expect(resFontanero.status).toBe(HttpStatus.FORBIDDEN);

      const tokenSecretaria = signAs(Role.SECRETARIA);
      const resSecretaria = await request(app.getHttpServer())
        .post('/api/v1/inventario/categorias')
        .set('Authorization', `Bearer ${tokenSecretaria}`)
        .send({ nombre: 'Categoría No Permitida' });

      expect(resSecretaria.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('rechaza con 401 Unauthorized sin token JWT', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/categorias')
        .send({ nombre: 'Sin Auth' });

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 400 Bad Request si el nombre falta o está en blanco', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/categorias')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: '   ' });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Integración HTTP: GET /api/v1/inventario/categorias', () => {
    it('permite a ADMINISTRADORA, SECRETARIA y FONTANERO listar categorías (200 OK)', async () => {
      for (const role of [
        Role.ADMINISTRADORA,
        Role.SECRETARIA,
        Role.FONTANERO,
      ]) {
        const token = signAs(role);

        const response = await request(app.getHttpServer())
          .get('/api/v1/inventario/categorias')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(HttpStatus.OK);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('total');
      }
    });

    it('rechaza con 401 Unauthorized sin token', async () => {
      const response = await request(app.getHttpServer()).get(
        '/api/v1/inventario/categorias',
      );

      expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 403 Forbidden a roles no autorizados (ej. ABONADO)', async () => {
      const token = signAs('ABONADO');

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/categorias')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });
  });

  describe('Integración HTTP: GET /api/v1/inventario/categorias/:id', () => {
    it('retorna el detalle de una categoría para ADMINISTRADORA (200 OK)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/categorias/1')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.OK);
      const bodyDetail = response.body as CategoriaResponseBody;
      expect(bodyDetail.id).toBe(1);
    });

    it('retorna 404 Not Found si la categoría no existe', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/categorias/999')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.NOT_FOUND);
    });

    it('retorna 400 Bad Request si el ID no es numérico', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .get('/api/v1/inventario/categorias/abc')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('Integración HTTP: PATCH y PUT /api/v1/inventario/categorias/:id', () => {
    it('permite modificar la categoría a la ADMINISTRADORA (200 OK)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const responsePatch = await request(app.getHttpServer())
        .patch('/api/v1/inventario/categorias/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Tuberías PVC de Presión' });

      expect(responsePatch.status).toBe(HttpStatus.OK);
      const bodyPatch = responsePatch.body as CategoriaResponseBody;
      expect(bodyPatch.nombre).toBe('Tuberías PVC de Presión');

      const responsePut = await request(app.getHttpServer())
        .put('/api/v1/inventario/categorias/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Tuberías PVC de Presión', descripcion: 'Nueva desc' });

      expect(responsePut.status).toBe(HttpStatus.OK);
    });

    it('rechaza con 403 Forbidden a FONTANERO en actualización de categorías', async () => {
      const token = signAs(Role.FONTANERO);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/categorias/1')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Modificación No Autorizada' });

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('retorna 404 Not Found si la categoría a modificar no existe', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/categorias/999')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Inexistente' });

      expect(response.status).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('Integración HTTP: PATCH /api/v1/inventario/categorias/:id/estado', () => {
    it('permite a ADMINISTRADORA desactivar una categoría (200 OK)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/categorias/1/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });

      expect(response.status).toBe(HttpStatus.OK);
      const bodyDesactivada = response.body as CategoriaResponseBody;
      expect(bodyDesactivada.activo).toBe(false);
    });

    it('permite a ADMINISTRADORA reactivar una categoría con formato textual "Activo" (200 OK)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/categorias/1/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: 'Activo' });

      expect(response.status).toBe(HttpStatus.OK);
      const bodyReactivada = response.body as CategoriaResponseBody;
      expect(bodyReactivada.activo).toBe(true);
    });

    it('rechaza con 403 Forbidden si FONTANERO intenta cambiar estado', async () => {
      const token = signAs(Role.FONTANERO);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/categorias/1/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });

      expect(response.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('rechaza con 400 Bad Request si el valor de estado es inválido', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/categorias/1/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: 'desconocido' });

      expect(response.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('retorna 404 Not Found si la categoría a cambiar estado no existe', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .patch('/api/v1/inventario/categorias/999/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });

      expect(response.status).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('Integración HTTP: Endpoints de Proveedores', () => {
    it('POST /api/v1/inventario/proveedores — permite registro a ADMINISTRADORA (201)', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/proveedores')
        .set('Authorization', `Bearer ${token}`)
        .send({
          nombre: 'Ferretería El Lagar',
          razonSocial: 'El Lagar S.A.',
          identificacion: '3-101-123456',
          telefono: '2680-1122',
          correo: 'ventas@ellagar.cr',
        });

      expect(response.status).toBe(HttpStatus.CREATED);
      expect(response.body.id).toBe(1);
      expect(response.body.nombre).toBe('Ferretería El Lagar');
    });

    it('POST /api/v1/inventario/proveedores — rechaza con 403 a FONTANERO y SECRETARIA', async () => {
      const tokenFontanero = signAs(Role.FONTANERO);
      const tokenSecretaria = signAs(Role.SECRETARIA);

      const resFontanero = await request(app.getHttpServer())
        .post('/api/v1/inventario/proveedores')
        .set('Authorization', `Bearer ${tokenFontanero}`)
        .send({ nombre: 'Proveedor Intruso' });

      expect(resFontanero.status).toBe(HttpStatus.FORBIDDEN);

      const resSecretaria = await request(app.getHttpServer())
        .post('/api/v1/inventario/proveedores')
        .set('Authorization', `Bearer ${tokenSecretaria}`)
        .send({ nombre: 'Proveedor Intruso' });

      expect(resSecretaria.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('POST /api/v1/inventario/proveedores — rechaza con 400 si falta el nombre o el correo es inválido', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const resFaltaNombre = await request(app.getHttpServer())
        .post('/api/v1/inventario/proveedores')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(resFaltaNombre.status).toBe(HttpStatus.BAD_REQUEST);

      const resCorreoInvalido = await request(app.getHttpServer())
        .post('/api/v1/inventario/proveedores')
        .set('Authorization', `Bearer ${token}`)
        .send({ nombre: 'Valido', correo: 'no_es_un_correo' });

      expect(resCorreoInvalido.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('GET /api/v1/inventario/proveedores — permite consulta a ADMINISTRADORA, SECRETARIA y FONTANERO (200 OK)', async () => {
      const tokenAdmin = signAs(Role.ADMINISTRADORA);
      const tokenSec = signAs(Role.SECRETARIA);
      const tokenFont = signAs(Role.FONTANERO);

      const resAdmin = await request(app.getHttpServer())
        .get('/api/v1/inventario/proveedores')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(resAdmin.status).toBe(HttpStatus.OK);
      expect(resAdmin.body.data).toBeDefined();

      const resSec = await request(app.getHttpServer())
        .get('/api/v1/inventario/proveedores')
        .set('Authorization', `Bearer ${tokenSec}`);

      expect(resSec.status).toBe(HttpStatus.OK);

      const resFont = await request(app.getHttpServer())
        .get('/api/v1/inventario/proveedores')
        .set('Authorization', `Bearer ${tokenFont}`);

      expect(resFont.status).toBe(HttpStatus.OK);
    });

    it('GET /api/v1/inventario/proveedores — rechaza con 401 sin token y 403 a un rol no autorizado', async () => {
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

    it('GET /api/v1/inventario/proveedores/:id — retorna detalle para personal autorizado y 404 si no existe', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const resOk = await request(app.getHttpServer())
        .get('/api/v1/inventario/proveedores/1')
        .set('Authorization', `Bearer ${token}`);

      expect(resOk.status).toBe(HttpStatus.OK);
      expect(resOk.body.id).toBe(1);

      const resNotFound = await request(app.getHttpServer())
        .get('/api/v1/inventario/proveedores/999')
        .set('Authorization', `Bearer ${token}`);

      expect(resNotFound.status).toBe(HttpStatus.NOT_FOUND);

      const resBadId = await request(app.getHttpServer())
        .get('/api/v1/inventario/proveedores/abc')
        .set('Authorization', `Bearer ${token}`);

      expect(resBadId.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('PATCH /api/v1/inventario/proveedores/:id — permite actualizar a ADMINISTRADORA y rechaza a otros roles', async () => {
      const tokenAdmin = signAs(Role.ADMINISTRADORA);
      const tokenFont = signAs(Role.FONTANERO);

      const resOk = await request(app.getHttpServer())
        .patch('/api/v1/inventario/proveedores/1')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ telefono: '2680-9999' });

      expect(resOk.status).toBe(HttpStatus.OK);

      const resForb = await request(app.getHttpServer())
        .patch('/api/v1/inventario/proveedores/1')
        .set('Authorization', `Bearer ${tokenFont}`)
        .send({ telefono: '2680-9999' });

      expect(resForb.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('PATCH /api/v1/inventario/proveedores/:id/estado — permite desactivar y reactivar a ADMINISTRADORA', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const resDesactivar = await request(app.getHttpServer())
        .patch('/api/v1/inventario/proveedores/1/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });

      expect(resDesactivar.status).toBe(HttpStatus.OK);
      expect(resDesactivar.body.activo).toBe(false);

      const resReactivar = await request(app.getHttpServer())
        .patch('/api/v1/inventario/proveedores/1/estado')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: 'Activo' });

      expect(resReactivar.status).toBe(HttpStatus.OK);
      expect(resReactivar.body.activo).toBe(true);
    });
  });

  describe('Integración HTTP: POST /api/v1/inventario/entradas', () => {
    const validEntradaPayload = {
      idMaterial: 1,
      cantidad: 15,
      observacion: 'Compra según factura F-4589',
    };

    it('rechaza con 401 Unauthorized si no se envía token JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .send(validEntradaPayload);

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 403 Forbidden si el rol es FONTANERO', async () => {
      const token = signAs(Role.FONTANERO);

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send(validEntradaPayload);

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('rechaza con 403 Forbidden si el rol es SECRETARIA', async () => {
      const token = signAs(Role.SECRETARIA);

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send(validEntradaPayload);

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('rechaza con 403 Forbidden a un rol sin permisos como ABONADO', async () => {
      const token = signAs('ABONADO');

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send(validEntradaPayload);

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('permite registrar una entrada física con 201 Created al rol ADMINISTRADORA', async () => {
      const token = signAs(Role.ADMINISTRADORA, '2');

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send(validEntradaPayload);

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body).toHaveProperty('movimiento');
      expect(res.body).toHaveProperty('material');
      expect(res.body.stockAnterior).toBe(20);
      expect(res.body.stockActual).toBe(35);
      expect(res.body.movimiento.tipo).toBe('ENTRADA');
      expect(res.body.movimiento.cantidad).toBe(15);
    });

    it('permite registrar una entrada enviando materialId como alias de idMaterial', async () => {
      const token = signAs(Role.ADMINISTRADORA, '2');

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({ materialId: 1, cantidad: 10 });

      expect(res.status).toBe(HttpStatus.CREATED);
    });

    it('rechaza con 400 Bad Request si la cantidad es menor o igual a 0', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: 1, cantidad: 0 });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('rechaza con 400 Bad Request si la cantidad no es un número entero', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: 1, cantidad: 5.5 });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('rechaza con 400 Bad Request si faltan campos obligatorios', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('retorna 404 Not Found si el material especificado no existe', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/entradas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: 999, cantidad: 5 });

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('Integración HTTP: POST /api/v1/inventario/salidas', () => {
    it('rechaza con 401 Unauthorized si no se envía token JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .send({ idMaterial: 1, cantidad: 5 });

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 403 Forbidden si el rol es SECRETARIA', async () => {
      const token = signAs(Role.SECRETARIA);

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: 1, cantidad: 5 });

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('rechaza con 403 Forbidden a un rol sin permisos como ABONADO', async () => {
      const token = signAs('ABONADO');

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: 1, cantidad: 5 });

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('permite registrar una salida física con 201 Created al rol FONTANERO', async () => {
      const token = signAs(Role.FONTANERO, '3');

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          idMaterial: 1,
          cantidad: 5,
          observacion: 'Material utilizado en reparación de fuga sector 1',
        });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.stockActual).toBe(25);
      expect(res.body.movimiento.tipo).toBe('SALIDA');
    });

    it('permite registrar una salida física con 201 Created al rol ADMINISTRADORA', async () => {
      const token = signAs(Role.ADMINISTRADORA, '2');

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({
          idMaterial: 1,
          cantidad: 2,
        });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.stockActual).toBe(28);
    });

    it('permite registrar una salida enviando materialId como alias de idMaterial', async () => {
      const token = signAs(Role.FONTANERO, '3');

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ materialId: 1, cantidad: 4 });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.stockActual).toBe(26);
    });

    it('permite asociar una avería mediante idAveria o averiaId', async () => {
      const token = signAs(Role.FONTANERO, '3');

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: 1, cantidad: 3, averiaId: 12 });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.movimiento.idAveria).toBe(12);
    });

    it('permite asociar una solicitud mediante idSolicitud o solicitudId', async () => {
      const token = signAs(Role.FONTANERO, '3');

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: 1, cantidad: 2, solicitudId: 8 });

      expect(res.status).toBe(HttpStatus.CREATED);
      expect(res.body.movimiento.idSolicitud).toBe(8);
    });

    it('rechaza con 400 Bad Request si la cantidad es menor o igual a 0', async () => {
      const token = signAs(Role.FONTANERO, '3');

      const resCero = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: 1, cantidad: 0 });

      expect(resCero.status).toBe(HttpStatus.BAD_REQUEST);

      const resNegativo = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: 1, cantidad: -5 });

      expect(resNegativo.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('rechaza con 400 Bad Request si la cantidad no es un número entero', async () => {
      const token = signAs(Role.FONTANERO, '3');

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: 1, cantidad: 3.14 });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('rechaza con 400 Bad Request si faltan campos obligatorios', async () => {
      const token = signAs(Role.FONTANERO, '3');

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('rechaza con 400 Bad Request si el frontend intenta enviar un fontaneroId manipulable (forbidNonWhitelisted)', async () => {
      const token = signAs(Role.FONTANERO, '3');

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: 1, cantidad: 5, fontaneroId: 99 });

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(JSON.stringify(res.body)).toContain(
        'property fontaneroId should not exist',
      );
    });

    it('retorna 404 Not Found si el material especificado no existe', async () => {
      const token = signAs(Role.FONTANERO, '3');

      const res = await request(app.getHttpServer())
        .post('/api/v1/inventario/salidas')
        .set('Authorization', `Bearer ${token}`)
        .send({ idMaterial: 999, cantidad: 5 });

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('Integración HTTP: GET /api/v1/inventario/materiales/:id/disponibilidad', () => {
    it('rechaza con 401 Unauthorized si no se envía token JWT', async () => {
      const res = await request(app.getHttpServer()).get(
        '/api/v1/inventario/materiales/1/disponibilidad?cantidad=4',
      );

      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    });

    it('rechaza con 403 Forbidden si el rol es un abonado u otro no autorizado', async () => {
      const token = signAs('ABONADO');

      const res = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales/1/disponibilidad?cantidad=4')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(HttpStatus.FORBIDDEN);
    });

    it('permite a FONTANERO verificar disponibilidad con 200 OK', async () => {
      const token = signAs(Role.FONTANERO);

      const res = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales/1/disponibilidad?cantidad=4')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.esValido).toBe(true);
      expect(res.body.stockFinal).toBe(6);
    });

    it('permite a ADMINISTRADORA verificar disponibilidad con 200 OK', async () => {
      const token = signAs(Role.ADMINISTRADORA);

      const res = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales/1/disponibilidad?cantidad=10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.esValido).toBe(true);
      expect(res.body.stockFinal).toBe(0);
      expect(res.body.esAgotamientoTotal).toBe(true);
    });

    it('rechaza con 400 Bad Request si la cantidad solicitada supera el stock disponible', async () => {
      const token = signAs(Role.FONTANERO);

      const res = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales/1/disponibilidad?cantidad=15')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
      expect(res.body.message).toContain('Stock insuficiente');
    });

    it('rechaza con 400 Bad Request si el parámetro ID no es numérico', async () => {
      const token = signAs(Role.FONTANERO);

      const res = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales/invalido/disponibilidad?cantidad=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    });

    it('retorna 404 Not Found si el material no existe', async () => {
      const token = signAs(Role.FONTANERO);

      const res = await request(app.getHttpServer())
        .get('/api/v1/inventario/materiales/999/disponibilidad?cantidad=2')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
    });
  });
});
