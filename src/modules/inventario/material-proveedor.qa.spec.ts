import {
  BadRequestException,
  ForbiddenException,
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Role } from '../../common/enums/role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { DocumentoMovimientoInventario } from './entities/documento-movimiento-inventario.entity';
import { Material } from './entities/material.entity';
import { MovimientoInventario } from './entities/movimiento-inventario.entity';
import { Proveedor } from './entities/proveedor.entity';
import { InventarioController } from './inventario.controller';
import { InventarioService } from './inventario.service';

describe('QA Criterios de Aceptación — Relación Material con Proveedores', () => {
  let app: INestApplication;
  let service: InventarioService;
  let currentRole: Role = Role.ADMINISTRADORA;

  const mockProveedorActivo: Proveedor = {
    id: 10,
    nombre: 'Ferretería La Fuente',
    razonSocial: 'La Fuente S.A.',
    identificacion: '3-101-998877',
    telefono: '2680-5544',
    correo: 'ventas@lafuente.cr',
    direccion: 'Nicoya centro',
    personaContacto: 'Manuel Rojas',
    activo: true,
    createdAt: new Date('2026-09-01T00:00:00Z'),
    updatedAt: new Date('2026-09-01T00:00:00Z'),
    validar: jest.fn(),
  };

  const mockProveedorInactivo: Proveedor = {
    id: 20,
    nombre: 'Proveedor Antiguo Inactivo',
    razonSocial: 'Antiguo S.A.',
    identificacion: '3-101-112233',
    telefono: '2680-0000',
    correo: 'inactivo@proveedor.com',
    direccion: 'Santa Cruz',
    personaContacto: 'Ex-Representante',
    activo: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-06-01T00:00:00Z'),
    validar: jest.fn(),
  };

  let mockMaterialRepository: {
    createQueryBuilder: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
  };

  let mockProveedorRepository: {
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  let mockCategoriaRepository: {
    findOne: jest.Mock;
  };

  beforeAll(async () => {
    mockMaterialRepository = {
      createQueryBuilder: jest.fn(),
      create: jest.fn((dto) => ({ id: 100, ...dto })),
      save: jest.fn((mat) => Promise.resolve({ id: 100, ...mat })),
      findOne: jest.fn(),
    };

    mockProveedorRepository = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockCategoriaRepository = {
      findOne: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [InventarioController],
      providers: [
        InventarioService,
        {
          provide: getRepositoryToken(Material),
          useValue: mockMaterialRepository,
        },
        {
          provide: getRepositoryToken(CategoriaMaterial),
          useValue: mockCategoriaRepository,
        },
        {
          provide: getRepositoryToken(Proveedor),
          useValue: mockProveedorRepository,
        },
        {
          provide: getRepositoryToken(MovimientoInventario),
          useValue: {
            create: jest.fn((dto) => dto),
            save: jest.fn((mov) => Promise.resolve({ id: 1, ...mov })),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DocumentoMovimientoInventario),
          useValue: {
            create: jest.fn((dto) => dto),
            save: jest.fn((doc) => Promise.resolve({ id: 1, ...doc })),
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.user = {
            id: 1,
            email: 'admin@asada.cr',
            role: currentRole,
            rol: currentRole,
          };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({
        canActivate: () => {
          if (currentRole !== Role.ADMINISTRADORA) {
            throw new ForbiddenException('Acceso denegado');
          }
          return true;
        },
      })
      .compile();

    service = moduleFixture.get<InventarioService>(InventarioService);
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    currentRole = Role.ADMINISTRADORA;
  });

  describe('1. Registro de materiales con proveedores', () => {
    it('permite registrar un material asociando un proveedor activo existente', async () => {
      mockMaterialRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
      mockProveedorRepository.findOne.mockResolvedValueOnce(
        mockProveedorActivo,
      );

      const dto: CreateMaterialDto = {
        nombre: 'Tubo PVC 1/2" SDR 13.5',
        unidadMedida: 'Tubo',
        stockMinimo: 10,
        idProveedor: 10,
      };

      const result = await service.create(dto);

      expect(mockProveedorRepository.findOne).toHaveBeenCalledWith({
        where: { id: 10 },
      });
      expect(result.idProveedor).toBe(10);
      expect(result.proveedor).toEqual(mockProveedorActivo);
      expect(result.stockActual).toBe(0);
    });

    it('permite registrar material sin proveedor (relación opcional)', async () => {
      mockMaterialRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      const dto: CreateMaterialDto = {
        nombre: 'Cinta Teflón 1/2"',
        unidadMedida: 'Rollo',
      };

      const result = await service.create(dto);

      expect(mockProveedorRepository.findOne).not.toHaveBeenCalled();
      expect(result.idProveedor).toBeNull();
      expect(result.proveedor).toBeNull();
    });

    it('rechaza con NotFoundException si el proveedor asignado no existe', async () => {
      mockMaterialRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
      mockProveedorRepository.findOne.mockResolvedValueOnce(null);

      const dto: CreateMaterialDto = {
        nombre: 'Válvula de compuerta 2"',
        unidadMedida: 'Unidad',
        idProveedor: 999,
      };

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      await expect(service.create(dto)).rejects.toThrow(
        'El proveedor con ID 999 no existe',
      );
    });

    it('rechaza con BadRequestException si el proveedor se encuentra inactivo para nuevas asignaciones', async () => {
      mockMaterialRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
      mockProveedorRepository.findOne.mockResolvedValueOnce(
        mockProveedorInactivo,
      );

      const dto: CreateMaterialDto = {
        nombre: 'Abrazadera 2 pulg',
        unidadMedida: 'Unidad',
        idProveedor: 20,
      };

      await expect(service.create(dto)).rejects.toThrow(
        new BadRequestException(
          'No se puede asignar un proveedor inactivo a un nuevo material',
        ),
      );
    });

    it('permite registrar material utilizando el alias proveedorId para compatibilidad con el frontend', async () => {
      mockMaterialRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
      mockProveedorRepository.findOne.mockResolvedValueOnce(
        mockProveedorActivo,
      );

      const dto: CreateMaterialDto = {
        nombre: 'Tubo PEAD 1/2"',
        unidadMedida: 'Metro',
        proveedorId: 10,
      };

      const result = await service.create(dto);

      expect(mockProveedorRepository.findOne).toHaveBeenCalledWith({
        where: { id: 10 },
      });
      expect(result.idProveedor).toBe(10);
      expect(result.proveedor).toEqual(mockProveedorActivo);
    });
  });

  describe('2. Edición y reasignación de proveedores', () => {
    it('permite cambiar el proveedor a otro proveedor activo existente', async () => {
      const existingMaterial: Material = {
        id: 50,
        nombre: 'Válvula 1/2"',
        descripcion: null,
        unidadMedida: 'Unidad',
        ubicacion: null,
        stockMinimo: 5,
        stockActual: 20,
        activo: true,
        idProveedor: 10,
        proveedor: mockProveedorActivo,
        createdAt: new Date(),
        updatedAt: new Date(),
        validar: jest.fn(),
      };

      mockMaterialRepository.findOne.mockResolvedValueOnce(existingMaterial);

      const nuevoProveedorActivo: Proveedor = {
        ...mockProveedorActivo,
        id: 11,
        nombre: 'Distribuidora Guanacasteca',
        validar: jest.fn(),
      };
      mockProveedorRepository.findOne.mockResolvedValueOnce(
        nuevoProveedorActivo,
      );

      const updateDto: UpdateMaterialDto = {
        idProveedor: 11,
      };

      const result = await service.update(50, updateDto);

      expect(mockProveedorRepository.findOne).toHaveBeenCalledWith({
        where: { id: 11 },
      });
      expect(result.idProveedor).toBe(11);
      expect(result.proveedor).toEqual(nuevoProveedorActivo);
    });

    it('permite desvincular el proveedor de un material enviando idProveedor: null', async () => {
      const existingMaterial: Material = {
        id: 50,
        nombre: 'Válvula 1/2"',
        descripcion: null,
        unidadMedida: 'Unidad',
        ubicacion: null,
        stockMinimo: 5,
        stockActual: 20,
        activo: true,
        idProveedor: 10,
        proveedor: mockProveedorActivo,
        createdAt: new Date(),
        updatedAt: new Date(),
        validar: jest.fn(),
      };

      mockMaterialRepository.findOne.mockResolvedValueOnce(existingMaterial);

      const updateDto: UpdateMaterialDto = {
        idProveedor: null,
      };

      const result = await service.update(50, updateDto);

      expect(mockProveedorRepository.findOne).not.toHaveBeenCalled();
      expect(result.idProveedor).toBeNull();
      expect(result.proveedor).toBeNull();
    });

    it('rechaza si se intenta cambiar a un proveedor inactivo', async () => {
      const existingMaterial: Material = {
        id: 50,
        nombre: 'Válvula 1/2"',
        descripcion: null,
        unidadMedida: 'Unidad',
        ubicacion: null,
        stockMinimo: 5,
        stockActual: 20,
        activo: true,
        idProveedor: 10,
        proveedor: mockProveedorActivo,
        createdAt: new Date(),
        updatedAt: new Date(),
        validar: jest.fn(),
      };

      mockMaterialRepository.findOne.mockResolvedValueOnce(existingMaterial);
      mockProveedorRepository.findOne.mockResolvedValueOnce(
        mockProveedorInactivo,
      );

      const updateDto: UpdateMaterialDto = {
        idProveedor: 20,
      };

      await expect(service.update(50, updateDto)).rejects.toThrow(
        new BadRequestException(
          'No se puede asignar un proveedor inactivo a un material',
        ),
      );
    });

    it('preserva la relación histórica con un proveedor que fue desactivado si no se cambia de proveedor', async () => {
      const existingMaterial: Material = {
        id: 50,
        nombre: 'Válvula 1/2"',
        descripcion: null,
        unidadMedida: 'Unidad',
        ubicacion: null,
        stockMinimo: 5,
        stockActual: 20,
        activo: true,
        idProveedor: 20, // Ya estaba asignado al proveedor inactivo históricamente
        proveedor: mockProveedorInactivo,
        createdAt: new Date(),
        updatedAt: new Date(),
        validar: jest.fn(),
      };

      mockMaterialRepository.findOne.mockResolvedValueOnce(existingMaterial);

      const updateDto: UpdateMaterialDto = {
        idProveedor: 20, // Se mantiene el mismo proveedor histórico
        descripcion: 'Actualización técnica de descripción',
      };

      const result = await service.update(50, updateDto);

      // No debe disparar consulta de validación ni rechazar por inactividad
      expect(mockProveedorRepository.findOne).not.toHaveBeenCalled();
      expect(result.idProveedor).toBe(20);
      expect(result.descripcion).toBe('Actualización técnica de descripción');
    });
  });

  describe('3. Consulta de detalle e inclusión de relación', () => {
    it('retorna el detalle del material incluyendo el proveedor relacionado', async () => {
      const mockMaterialConProveedor: Material = {
        id: 1,
        nombre: 'Tubo PVC 1/2"',
        descripcion: null,
        unidadMedida: 'Tubo',
        ubicacion: 'Bodega 1',
        stockMinimo: 10,
        stockActual: 30,
        activo: true,
        idProveedor: 10,
        proveedor: mockProveedorActivo,
        createdAt: new Date(),
        updatedAt: new Date(),
        validar: jest.fn(),
      };

      mockMaterialRepository.findOne.mockResolvedValueOnce(
        mockMaterialConProveedor,
      );

      const result = await service.findOne(1);

      expect(mockMaterialRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { categoria: true, proveedor: true },
      });
      expect(result.proveedor).toBeDefined();
      expect(result.proveedor?.nombre).toBe('Ferretería La Fuente');
      expect(result.proveedor?.id).toBe(10);
    });

    it('retorna listado de materiales filtrando por idProveedor e incluyendo la relación con proveedor', async () => {
      const mockMaterialConProveedor: Material = {
        id: 1,
        nombre: 'Tubo PVC 1/2"',
        descripcion: null,
        unidadMedida: 'Tubo',
        ubicacion: 'Bodega 1',
        stockMinimo: 10,
        stockActual: 30,
        activo: true,
        idProveedor: 10,
        proveedor: mockProveedorActivo,
        createdAt: new Date(),
        updatedAt: new Date(),
        validar: jest.fn(),
      };

      const qbMock = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest
          .fn()
          .mockResolvedValue([[mockMaterialConProveedor], 1]),
      };
      mockMaterialRepository.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.findAll({ idProveedor: 10 });

      expect(qbMock.leftJoinAndSelect).toHaveBeenCalledWith(
        'material.categoria',
        'categoria',
      );
      expect(qbMock.leftJoinAndSelect).toHaveBeenCalledWith(
        'material.proveedor',
        'proveedor',
      );
      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'material.idProveedor = :idProveedor',
        { idProveedor: 10 },
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].idProveedor).toBe(10);
    });
  });

  describe('4. Integración HTTP y Seguridad por Roles', () => {
    it('permite a ADMINISTRADORA enviar idProveedor vía POST /api/v1/inventario/materiales', async () => {
      mockMaterialRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
      mockProveedorRepository.findOne.mockResolvedValueOnce(
        mockProveedorActivo,
      );

      const response = await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .send({
          nombre: 'Tubo PVC 3/4"',
          unidadMedida: 'Tubo',
          idProveedor: 10,
        })
        .expect(201);

      expect(response.body.idProveedor).toBe(10);
    });

    it('permite desvincular proveedor vía PUT /api/v1/inventario/materiales/:id enviando idProveedor: null', async () => {
      const existingMaterial: Material = {
        id: 15,
        nombre: 'Tubo PVC 3/4"',
        descripcion: null,
        unidadMedida: 'Tubo',
        ubicacion: null,
        stockMinimo: 5,
        stockActual: 10,
        activo: true,
        idProveedor: 10,
        proveedor: mockProveedorActivo,
        createdAt: new Date(),
        updatedAt: new Date(),
        validar: jest.fn(),
      };

      mockMaterialRepository.findOne.mockResolvedValue(existingMaterial);
      mockMaterialRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      const response = await request(app.getHttpServer())
        .put('/api/v1/inventario/materiales/15')
        .send({
          idProveedor: null,
        })
        .expect(200);

      expect(response.body.idProveedor).toBeNull();
    });

    it('rechaza si FONTANERO o SECRETARIA intentan crear material con proveedor (403 Forbidden)', async () => {
      currentRole = Role.FONTANERO;

      await request(app.getHttpServer())
        .post('/api/v1/inventario/materiales')
        .send({
          nombre: 'Tubo PVC 3/4"',
          unidadMedida: 'Tubo',
          idProveedor: 10,
        })
        .expect(403);
    });
  });
});
