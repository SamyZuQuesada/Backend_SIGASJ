import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreateCategoriaDto } from './dto/create-categoria.dto';
import { CreateMaterialDto } from './dto/create-material.dto';
import { QueryMaterialesDto } from './dto/query-materiales.dto';
import { UpdateCategoriaDto } from './dto/update-categoria.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { CategoriaMaterial } from './entities/categoria-material.entity';
import { Material } from './entities/material.entity';
import { InventarioService } from './inventario.service';

describe('InventarioService — Catálogo de Materiales y Categorías', () => {
  let service: InventarioService;
  let qbWhereSpy: jest.Mock;
  let qbAndWhereSpy: jest.Mock;
  let qbLeftJoinAndSelectSpy: jest.Mock;
  let qbOrderBySpy: jest.Mock;
  let qbAddOrderBySpy: jest.Mock;
  let qbSkipSpy: jest.Mock;
  let qbTakeSpy: jest.Mock;
  let qbGetOneSpy: jest.Mock;
  let qbGetManyAndCountSpy: jest.Mock;
  let repoCreateSpy: jest.Mock;
  let repoSaveSpy: jest.Mock;
  let repoFindOneSpy: jest.Mock;
  let createQueryBuilderSpy: jest.Mock;

  let catQbWhereSpy: jest.Mock;
  let catQbAndWhereSpy: jest.Mock;
  let catQbOrderBySpy: jest.Mock;
  let catQbSkipSpy: jest.Mock;
  let catQbTakeSpy: jest.Mock;
  let catQbGetOneSpy: jest.Mock;
  let catQbGetManyAndCountSpy: jest.Mock;
  let catRepoCreateSpy: jest.Mock;
  let catRepoSaveSpy: jest.Mock;
  let catRepoFindOneSpy: jest.Mock;
  let catCreateQueryBuilderSpy: jest.Mock;

  beforeEach(async () => {
    qbWhereSpy = jest.fn().mockReturnThis();
    qbAndWhereSpy = jest.fn().mockReturnThis();
    qbLeftJoinAndSelectSpy = jest.fn().mockReturnThis();
    qbOrderBySpy = jest.fn().mockReturnThis();
    qbAddOrderBySpy = jest.fn().mockReturnThis();
    qbSkipSpy = jest.fn().mockReturnThis();
    qbTakeSpy = jest.fn().mockReturnThis();
    qbGetOneSpy = jest.fn().mockResolvedValue(null);
    qbGetManyAndCountSpy = jest.fn().mockResolvedValue([[], 0]);

    const mockQb = {
      where: qbWhereSpy,
      andWhere: qbAndWhereSpy,
      leftJoinAndSelect: qbLeftJoinAndSelectSpy,
      orderBy: qbOrderBySpy,
      addOrderBy: qbAddOrderBySpy,
      skip: qbSkipSpy,
      take: qbTakeSpy,
      getOne: qbGetOneSpy,
      getManyAndCount: qbGetManyAndCountSpy,
    };

    createQueryBuilderSpy = jest.fn().mockReturnValue(mockQb);
    repoCreateSpy = jest
      .fn()
      .mockImplementation((data: Partial<Material>) => data);
    repoSaveSpy = jest
      .fn()
      .mockImplementation((data: Partial<Material>) =>
        Promise.resolve({ id: 1, ...data } as Material),
      );
    repoFindOneSpy = jest.fn().mockResolvedValue(null);

    const mockRepo = {
      createQueryBuilder: createQueryBuilderSpy,
      create: repoCreateSpy,
      save: repoSaveSpy,
      findOne: repoFindOneSpy,
    };

    catQbWhereSpy = jest.fn().mockReturnThis();
    catQbAndWhereSpy = jest.fn().mockReturnThis();
    catQbOrderBySpy = jest.fn().mockReturnThis();
    catQbSkipSpy = jest.fn().mockReturnThis();
    catQbTakeSpy = jest.fn().mockReturnThis();
    catQbGetOneSpy = jest.fn().mockResolvedValue(null);
    catQbGetManyAndCountSpy = jest.fn().mockResolvedValue([[], 0]);

    const mockCatQb = {
      where: catQbWhereSpy,
      andWhere: catQbAndWhereSpy,
      orderBy: catQbOrderBySpy,
      skip: catQbSkipSpy,
      take: catQbTakeSpy,
      getOne: catQbGetOneSpy,
      getManyAndCount: catQbGetManyAndCountSpy,
    };

    catCreateQueryBuilderSpy = jest.fn().mockReturnValue(mockCatQb);
    catRepoCreateSpy = jest
      .fn()
      .mockImplementation((data: Partial<CategoriaMaterial>) => data);
    catRepoSaveSpy = jest
      .fn()
      .mockImplementation((data: Partial<CategoriaMaterial>) =>
        Promise.resolve({ id: 1, ...data } as CategoriaMaterial),
      );
    catRepoFindOneSpy = jest.fn().mockResolvedValue(null);

    const mockCatRepo = {
      createQueryBuilder: catCreateQueryBuilderSpy,
      create: catRepoCreateSpy,
      save: catRepoSaveSpy,
      findOne: catRepoFindOneSpy,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventarioService,
        {
          provide: getRepositoryToken(Material),
          useValue: mockRepo,
        },
        {
          provide: getRepositoryToken(CategoriaMaterial),
          useValue: mockCatRepo,
        },
      ],
    }).compile();

    service = module.get<InventarioService>(InventarioService);
  });

  it('debe estar definido el servicio', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('debe registrar un material exitosamente con stockActual = 0 y activo = true', async () => {
      const dto: CreateMaterialDto = {
        nombre: 'Tubo PVC 1/2 pulgada',
        descripcion: 'Tubo de presión para agua potable',
        unidadMedida: 'Tubo',
        ubicacion: 'Bodega Principal',
        stockMinimo: 10,
      };

      const result = await service.create(dto);

      expect(createQueryBuilderSpy).toHaveBeenCalledWith('material');
      expect(qbWhereSpy).toHaveBeenCalledWith(
        'LOWER(TRIM(material.nombre)) = LOWER(:nombre)',
        { nombre: 'Tubo PVC 1/2 pulgada' },
      );
      expect(repoCreateSpy).toHaveBeenCalledWith({
        nombre: 'Tubo PVC 1/2 pulgada',
        descripcion: 'Tubo de presión para agua potable',
        unidadMedida: 'Tubo',
        ubicacion: 'Bodega Principal',
        stockMinimo: 10,
        stockActual: 0, // No genera entrada física
        activo: true,
        idCategoria: null,
        categoria: null,
      });
      expect(result.id).toBe(1);
      expect(result.stockActual).toBe(0);
      expect(result.activo).toBe(true);
    });

    it('debe aplicar default stockMinimo = 0 si no se especifica', async () => {
      const dto: CreateMaterialDto = {
        nombre: 'Cinta teflón',
        unidadMedida: 'Rollo',
      };

      const result = await service.create(dto);

      expect(repoCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Cinta teflón',
          stockMinimo: 0,
          stockActual: 0,
          activo: true,
        }),
      );
      expect(result.stockMinimo).toBe(0);
      expect(result.stockActual).toBe(0);
    });

    it('debe lanzar ConflictException si ya existe un material con el mismo nombre', async () => {
      qbGetOneSpy.mockResolvedValueOnce({
        id: 99,
        nombre: 'Tubo PVC 1/2 pulgada',
      });

      const dto: CreateMaterialDto = {
        nombre: '  Tubo PVC 1/2 pulgada  ',
        unidadMedida: 'Tubo',
      };

      await expect(service.create(dto)).rejects.toThrow(
        'Ya existe un material registrado con el nombre "Tubo PVC 1/2 pulgada"',
      );
      expect(repoSaveSpy).not.toHaveBeenCalled();
    });

    it('debe lanzar InternalServerErrorException ante fallos inesperados de persistencia', async () => {
      repoSaveSpy.mockRejectedValueOnce(
        new Error('Conexión con BD interrumpida'),
      );

      const dto: CreateMaterialDto = {
        nombre: 'Material con fallo',
        unidadMedida: 'Unidad',
      };

      await expect(service.create(dto)).rejects.toThrow(
        'No se pudo registrar el material en el catálogo de inventario',
      );
    });

    it('debe asignar exitosamente una categoría activa existente al crear', async () => {
      const categoriaActiva: CategoriaMaterial = {
        id: 3,
        nombre: 'Tuberías',
        descripcion: 'Tubos y tuberías',
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        validar: jest.fn(),
      };
      catRepoFindOneSpy.mockResolvedValueOnce(categoriaActiva);

      const dto: CreateMaterialDto = {
        nombre: 'Tubo PEAD 1 pulgada',
        unidadMedida: 'Tubo',
        idCategoria: 3,
      };

      const result = await service.create(dto);

      expect(catRepoFindOneSpy).toHaveBeenCalledWith({ where: { id: 3 } });
      expect(repoCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Tubo PEAD 1 pulgada',
          idCategoria: 3,
          categoria: categoriaActiva,
        }),
      );
      expect(result.idCategoria).toBe(3);
    });

    it('debe lanzar NotFoundException si la categoría asignada al crear no existe', async () => {
      catRepoFindOneSpy.mockResolvedValueOnce(null);

      const dto: CreateMaterialDto = {
        nombre: 'Tubo PEAD 1 pulgada',
        unidadMedida: 'Tubo',
        idCategoria: 999,
      };

      await expect(service.create(dto)).rejects.toThrow(
        'La categoría con ID 999 no existe',
      );
      expect(repoSaveSpy).not.toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException si la categoría asignada al crear se encuentra inactiva', async () => {
      catRepoFindOneSpy.mockResolvedValueOnce({
        id: 4,
        nombre: 'Categoría Antigua',
        activo: false,
      });

      const dto: CreateMaterialDto = {
        nombre: 'Tubo Especial',
        unidadMedida: 'Tubo',
        idCategoria: 4,
      };

      await expect(service.create(dto)).rejects.toThrow(
        'No se puede asignar una categoría inactiva a un nuevo material',
      );
      expect(repoSaveSpy).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('debe retornar listado paginado con valores por defecto', async () => {
      const mockMateriales: Material[] = [
        {
          id: 1,
          nombre: 'Adaptador macho PVC 1/2"',
          descripcion: null,
          unidadMedida: 'Unidad',
          ubicacion: 'Estante A',
          stockMinimo: 10,
          stockActual: 20,
          activo: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          validar: jest.fn(),
        },
        {
          id: 2,
          nombre: 'Codo 90 PVC 1/2"',
          descripcion: null,
          unidadMedida: 'Unidad',
          ubicacion: 'Estante A',
          stockMinimo: 5,
          stockActual: 15,
          activo: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          validar: jest.fn(),
        },
      ];

      qbGetManyAndCountSpy.mockResolvedValueOnce([mockMateriales, 2]);

      const query: QueryMaterialesDto = {};
      const result = await service.findAll(query);

      expect(createQueryBuilderSpy).toHaveBeenCalledWith('material');
      expect(qbOrderBySpy).toHaveBeenCalledWith('material.nombre', 'ASC');
      expect(qbAddOrderBySpy).toHaveBeenCalledWith('material.id', 'ASC');
      expect(qbSkipSpy).toHaveBeenCalledWith(0);
      expect(qbTakeSpy).toHaveBeenCalledWith(10);
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(1);
    });

    it('debe manejar correctamente una lista vacía sin errores', async () => {
      qbGetManyAndCountSpy.mockResolvedValueOnce([[], 0]);

      const query: QueryMaterialesDto = { page: 1, limit: 10 };
      const result = await service.findAll(query);

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('debe aplicar filtro por nombre cuando se proporcione', async () => {
      qbGetManyAndCountSpy.mockResolvedValueOnce([[], 0]);

      const query: QueryMaterialesDto = { nombre: '  Tubo  ' };
      await service.findAll(query);

      expect(qbAndWhereSpy).toHaveBeenCalledWith(
        'LOWER(material.nombre) LIKE LOWER(:nombre)',
        { nombre: '%Tubo%' },
      );
    });

    it('debe aplicar filtro por estado activo cuando se solicite únicamente activos', async () => {
      qbGetManyAndCountSpy.mockResolvedValueOnce([[], 0]);

      const query: QueryMaterialesDto = { activo: true };
      await service.findAll(query);

      expect(qbAndWhereSpy).toHaveBeenCalledWith('material.activo = :activo', {
        activo: true,
      });
    });

    it('debe aplicar filtro por estado activo cuando se soliciten inactivos', async () => {
      qbGetManyAndCountSpy.mockResolvedValueOnce([[], 0]);

      const query: QueryMaterialesDto = { activo: false };
      await service.findAll(query);

      expect(qbAndWhereSpy).toHaveBeenCalledWith('material.activo = :activo', {
        activo: false,
      });
    });

    it('debe calcular correctamente el desplazamiento (skip) para páginas posteriores', async () => {
      qbGetManyAndCountSpy.mockResolvedValueOnce([[], 25]);

      const query: QueryMaterialesDto = { page: 3, limit: 5 };
      const result = await service.findAll(query);

      expect(qbSkipSpy).toHaveBeenCalledWith(10); // (3 - 1) * 5
      expect(qbTakeSpy).toHaveBeenCalledWith(5);
      expect(result.totalPages).toBe(5); // 25 / 5
    });

    it('debe aplicar filtro por idCategoria cuando se proporcione', async () => {
      qbGetManyAndCountSpy.mockResolvedValueOnce([[], 0]);

      const query: QueryMaterialesDto = { idCategoria: 2 };
      await service.findAll(query);

      expect(qbAndWhereSpy).toHaveBeenCalledWith(
        'material.idCategoria = :idCategoria',
        { idCategoria: 2 },
      );
    });

    it('debe incluir la relación leftJoinAndSelect con categoria', async () => {
      qbGetManyAndCountSpy.mockResolvedValueOnce([[], 0]);

      await service.findAll({});

      expect(qbLeftJoinAndSelectSpy).toHaveBeenCalledWith(
        'material.categoria',
        'categoria',
      );
    });

    it('debe lanzar InternalServerErrorException si la consulta falla', async () => {
      qbGetManyAndCountSpy.mockRejectedValueOnce(
        new Error('Fallo de SQL Server'),
      );

      const query: QueryMaterialesDto = {};
      await expect(service.findAll(query)).rejects.toThrow(
        'No se pudo consultar el catálogo de materiales',
      );
    });
  });

  describe('findOne', () => {
    it('debe retornar el detalle de un material existente por su ID', async () => {
      const mockMaterial: Material = {
        id: 1,
        nombre: 'Tubo PVC 1/2 pulgada',
        descripcion: 'Tubo para conducción de agua potable',
        unidadMedida: 'Tubo',
        ubicacion: 'Bodega Principal - Pasillo 2',
        stockMinimo: 10,
        stockActual: 40,
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        validar: jest.fn(),
      };

      repoFindOneSpy.mockResolvedValueOnce(mockMaterial);

      const result = await service.findOne(1);

      expect(repoFindOneSpy).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: { categoria: true },
      });
      expect(result.id).toBe(1);
      expect(result.nombre).toBe('Tubo PVC 1/2 pulgada');
      expect(result.stockActual).toBe(40);
    });

    it('debe lanzar NotFoundException si el material no existe', async () => {
      repoFindOneSpy.mockResolvedValueOnce(null);

      await expect(service.findOne(999)).rejects.toThrow(
        'Material con ID 999 no encontrado',
      );
    });

    it('debe lanzar InternalServerErrorException ante un fallo inesperado de base de datos', async () => {
      repoFindOneSpy.mockRejectedValueOnce(new Error('Conexión perdida'));

      await expect(service.findOne(1)).rejects.toThrow(
        'No se pudo consultar el detalle del material',
      );
    });
  });

  describe('update', () => {
    const existingMaterial: Material = {
      id: 5,
      nombre: 'Tubo PVC 1/2 pulgada',
      descripcion: 'Descripción inicial',
      unidadMedida: 'Tubo',
      ubicacion: 'Bodega 1',
      stockMinimo: 10,
      stockActual: 35, // Existencia física previa
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      validar: jest.fn(),
    };

    it('debe lanzar NotFoundException si el material a actualizar no existe', async () => {
      repoFindOneSpy.mockResolvedValueOnce(null);

      const dto: UpdateMaterialDto = { nombre: 'Nuevo nombre' };
      await expect(service.update(999, dto)).rejects.toThrow(
        'Material con ID 999 no encontrado',
      );
      expect(repoSaveSpy).not.toHaveBeenCalled();
    });

    it('debe lanzar ConflictException si el nuevo nombre colisiona con otro material existente', async () => {
      repoFindOneSpy.mockResolvedValueOnce({ ...existingMaterial });
      qbGetOneSpy.mockResolvedValueOnce({
        id: 12,
        nombre: 'Tubo PVC 3/4 pulgada',
      });

      const dto: UpdateMaterialDto = {
        nombre: '  Tubo PVC 3/4 pulgada  ',
      };

      await expect(service.update(5, dto)).rejects.toThrow(
        'Ya existe otro material registrado con el nombre "Tubo PVC 3/4 pulgada"',
      );
      expect(qbWhereSpy).toHaveBeenCalledWith('material.id != :id', { id: 5 });
      expect(qbAndWhereSpy).toHaveBeenCalledWith(
        'LOWER(TRIM(material.nombre)) = LOWER(:nombre)',
        { nombre: 'Tubo PVC 3/4 pulgada' },
      );
      expect(repoSaveSpy).not.toHaveBeenCalled();
    });

    it('debe permitir actualizar el mismo material manteniendo su propio nombre sin lanzar conflicto', async () => {
      repoFindOneSpy.mockResolvedValueOnce({ ...existingMaterial });
      // qbGetOne returns null because query builder checks material.id != :id
      qbGetOneSpy.mockResolvedValueOnce(null);

      const dto: UpdateMaterialDto = {
        nombre: 'Tubo PVC 1/2 pulgada',
        descripcion: 'Descripción actualizada',
      };

      const result = await service.update(5, dto);

      expect(repoSaveSpy).toHaveBeenCalled();
      expect(result.nombre).toBe('Tubo PVC 1/2 pulgada');
      expect(result.descripcion).toBe('Descripción actualizada');
    });

    it('debe actualizar los campos permitidos y mantener INMUTABLE el stockActual (regla crítica)', async () => {
      repoFindOneSpy.mockResolvedValueOnce({ ...existingMaterial });

      const dto: UpdateMaterialDto = {
        nombre: 'Tubo PVC 1/2 pulgada Premium',
        descripcion: 'Nueva descripción detallada',
        unidadMedida: 'Tira',
        ubicacion: 'Bodega 2 - Pasillo B',
        stockMinimo: 25,
        activo: false,
      };

      const result = await service.update(5, dto);

      expect(repoSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 5,
          nombre: 'Tubo PVC 1/2 pulgada Premium',
          descripcion: 'Nueva descripción detallada',
          unidadMedida: 'Tira',
          ubicacion: 'Bodega 2 - Pasillo B',
          stockMinimo: 25,
          stockActual: 35, // ¡No se modifica!
          activo: false,
        }),
      );
      expect(result.stockActual).toBe(35);
    });

    it('debe convertir campos opcionales vacíos a null al actualizar', async () => {
      repoFindOneSpy.mockResolvedValueOnce({ ...existingMaterial });

      const dto: UpdateMaterialDto = {
        descripcion: '   ',
        ubicacion: '   ',
      };

      await service.update(5, dto);

      expect(repoSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          descripcion: null,
          ubicacion: null,
        }),
      );
    });

    it('debe permitir reasignar a otra categoría activa', async () => {
      repoFindOneSpy.mockResolvedValueOnce({
        ...existingMaterial,
        idCategoria: 1,
      });
      const nuevaCategoria: CategoriaMaterial = {
        id: 2,
        nombre: 'Accesorios',
        descripcion: null,
        activo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        validar: jest.fn(),
      };
      catRepoFindOneSpy.mockResolvedValueOnce(nuevaCategoria);

      const dto: UpdateMaterialDto = { idCategoria: 2 };
      const result = await service.update(5, dto);

      expect(catRepoFindOneSpy).toHaveBeenCalledWith({ where: { id: 2 } });
      expect(repoSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 5,
          idCategoria: 2,
          categoria: nuevaCategoria,
        }),
      );
      expect(result.idCategoria).toBe(2);
    });

    it('debe desvincular la categoría si idCategoria se envía como null', async () => {
      repoFindOneSpy.mockResolvedValueOnce({
        ...existingMaterial,
        idCategoria: 3,
      });

      const dto: UpdateMaterialDto = { idCategoria: null };
      const result = await service.update(5, dto);

      expect(catRepoFindOneSpy).not.toHaveBeenCalled();
      expect(repoSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 5,
          idCategoria: null,
          categoria: null,
        }),
      );
      expect(result.idCategoria).toBeNull();
    });

    it('debe lanzar NotFoundException si la nueva categoría a asignar no existe', async () => {
      repoFindOneSpy.mockResolvedValueOnce({
        ...existingMaterial,
        idCategoria: 1,
      });
      catRepoFindOneSpy.mockResolvedValueOnce(null);

      const dto: UpdateMaterialDto = { idCategoria: 999 };
      await expect(service.update(5, dto)).rejects.toThrow(
        'La categoría con ID 999 no existe',
      );
      expect(repoSaveSpy).not.toHaveBeenCalled();
    });

    it('debe lanzar BadRequestException si la nueva categoría a asignar se encuentra inactiva', async () => {
      repoFindOneSpy.mockResolvedValueOnce({
        ...existingMaterial,
        idCategoria: 1,
      });
      catRepoFindOneSpy.mockResolvedValueOnce({
        id: 4,
        nombre: 'Categoría Inactiva',
        activo: false,
      });

      const dto: UpdateMaterialDto = { idCategoria: 4 };
      await expect(service.update(5, dto)).rejects.toThrow(
        'No se puede asignar una categoría inactiva a un material',
      );
      expect(repoSaveSpy).not.toHaveBeenCalled();
    });

    it('debe permitir guardar manteniendo la misma categoría sin revalidar ni lanzar error aunque esté inactiva', async () => {
      repoFindOneSpy.mockResolvedValueOnce({
        ...existingMaterial,
        idCategoria: 4,
      });

      const dto: UpdateMaterialDto = {
        idCategoria: 4,
        stockMinimo: 15,
      };
      await service.update(5, dto);

      expect(catRepoFindOneSpy).not.toHaveBeenCalled();
      expect(repoSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 5,
          idCategoria: 4,
          stockMinimo: 15,
        }),
      );
    });

    it('debe lanzar InternalServerErrorException si la persistencia falla inesperadamente', async () => {
      repoFindOneSpy.mockResolvedValueOnce({ ...existingMaterial });
      repoSaveSpy.mockRejectedValueOnce(new Error('Falla en la base de datos'));

      const dto: UpdateMaterialDto = { stockMinimo: 50 };

      await expect(service.update(5, dto)).rejects.toThrow(
        'No se pudo actualizar el material en el catálogo de inventario',
      );
    });
  });

  describe('cambiarEstado', () => {
    const activeMaterial: Material = {
      id: 7,
      nombre: 'Válvula de compuerta 2"',
      descripcion: 'Para líneas principales',
      unidadMedida: 'Unidad',
      ubicacion: 'Bodega 1',
      stockMinimo: 5,
      stockActual: 18,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      validar: jest.fn(),
    };

    it('debe desactivar un material activo preservando sus existencias e historial', async () => {
      repoFindOneSpy.mockResolvedValueOnce({ ...activeMaterial });

      const result = await service.cambiarEstado(7, false);

      expect(repoSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 7,
          activo: false,
          stockActual: 18, // Sin modificaciones físicas
        }),
      );
      expect(result.activo).toBe(false);
    });

    it('debe reactivar un material inactivo exitosamente', async () => {
      const inactiveMaterial = {
        ...activeMaterial,
        activo: false,
      } as Material;
      repoFindOneSpy.mockResolvedValueOnce(inactiveMaterial);

      const result = await service.cambiarEstado(7, true);

      expect(repoSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 7,
          activo: true,
          stockActual: 18,
        }),
      );
      expect(result.activo).toBe(true);
    });

    it('debe lanzar NotFoundException si el material a cambiar de estado no existe', async () => {
      repoFindOneSpy.mockResolvedValueOnce(null);

      await expect(service.cambiarEstado(999, false)).rejects.toThrow(
        'Material con ID 999 no encontrado',
      );
      expect(repoSaveSpy).not.toHaveBeenCalled();
    });

    it('debe lanzar InternalServerErrorException si la persistencia falla inesperadamente', async () => {
      repoFindOneSpy.mockResolvedValueOnce({ ...activeMaterial });
      repoSaveSpy.mockRejectedValueOnce(new Error('Fallo de conexión'));

      await expect(service.cambiarEstado(7, false)).rejects.toThrow(
        'No se pudo actualizar el estado del material',
      );
    });
  });

  /* =========================================================================
   * PRUEBAS UNITARIAS: OPERACIONES DE CATEGORÍAS DE MATERIALES
   * ========================================================================= */

  describe('createCategoria', () => {
    const dto: CreateCategoriaDto = {
      nombre: '  Tuberías  ',
      descripcion: '  Líneas principales de distribución  ',
    };

    it('debe registrar una categoría exitosamente sanitizando y con activo=true', async () => {
      catQbGetOneSpy.mockResolvedValueOnce(null);

      const result = await service.createCategoria(dto);

      expect(catRepoCreateSpy).toHaveBeenCalledWith({
        nombre: 'Tuberías',
        descripcion: '  Líneas principales de distribución  ',
        activo: true,
      });
      expect(catRepoSaveSpy).toHaveBeenCalled();
      expect(result.id).toBe(1);
    });

    it('debe lanzar ConflictException si ya existe una categoría con el mismo nombre', async () => {
      catQbGetOneSpy.mockResolvedValueOnce({
        id: 5,
        nombre: 'Tuberías',
        activo: true,
      });

      await expect(service.createCategoria(dto)).rejects.toThrow(
        'Ya existe una categoría registrada con el nombre "Tuberías"',
      );
      expect(catRepoSaveSpy).not.toHaveBeenCalled();
    });

    it('debe lanzar InternalServerErrorException si la persistencia falla', async () => {
      catQbGetOneSpy.mockResolvedValueOnce(null);
      catRepoSaveSpy.mockRejectedValueOnce(new Error('Fallo de base de datos'));

      await expect(service.createCategoria(dto)).rejects.toThrow(
        'No se pudo registrar la categoría de materiales',
      );
    });
  });

  describe('findAllCategorias', () => {
    it('debe consultar categorías con valores por defecto de paginación', async () => {
      const mockList = [
        { id: 1, nombre: 'Accesorios', activo: true },
        { id: 2, nombre: 'Tuberías', activo: true },
      ] as CategoriaMaterial[];

      catQbGetManyAndCountSpy.mockResolvedValueOnce([mockList, 2]);

      const result = await service.findAllCategorias();

      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.data).toHaveLength(2);
      expect(catQbOrderBySpy).toHaveBeenCalledWith('categoria.nombre', 'ASC');
    });

    it('debe aplicar filtro por estado activo', async () => {
      catQbGetManyAndCountSpy.mockResolvedValueOnce([[], 0]);

      await service.findAllCategorias({ activo: true });

      expect(catQbAndWhereSpy).toHaveBeenCalledWith(
        'categoria.activo = :activo',
        { activo: true },
      );
    });

    it('debe aplicar filtro por nombre de categoría (coincidencia parcial)', async () => {
      catQbGetManyAndCountSpy.mockResolvedValueOnce([[], 0]);

      await service.findAllCategorias({ nombre: 'Válvula' });

      expect(catQbAndWhereSpy).toHaveBeenCalledWith(
        'LOWER(categoria.nombre) LIKE LOWER(:nombre)',
        { nombre: '%Válvula%' },
      );
    });

    it('debe lanzar InternalServerErrorException si la consulta falla', async () => {
      catQbGetManyAndCountSpy.mockRejectedValueOnce(new Error('Fallo'));

      await expect(service.findAllCategorias()).rejects.toThrow(
        'No se pudo obtener el listado de categorías',
      );
    });
  });

  describe('findOneCategoria', () => {
    it('debe retornar la categoría si existe', async () => {
      const mockCat = {
        id: 3,
        nombre: 'Herramientas',
        descripcion: null,
        activo: true,
      } as CategoriaMaterial;
      catRepoFindOneSpy.mockResolvedValueOnce(mockCat);

      const result = await service.findOneCategoria(3);

      expect(result).toEqual(mockCat);
      expect(catRepoFindOneSpy).toHaveBeenCalledWith({ where: { id: 3 } });
    });

    it('debe lanzar NotFoundException si no existe', async () => {
      catRepoFindOneSpy.mockResolvedValueOnce(null);

      await expect(service.findOneCategoria(99)).rejects.toThrow(
        'No se encontró la categoría de materiales con el ID 99',
      );
    });
  });

  describe('updateCategoria', () => {
    const existingCat = {
      id: 2,
      nombre: 'Tubería PVC',
      descripcion: 'Para conducción',
      activo: true,
    } as CategoriaMaterial;

    it('debe actualizar el nombre y descripción si no colisiona', async () => {
      catRepoFindOneSpy.mockResolvedValueOnce({ ...existingCat });
      catQbGetOneSpy.mockResolvedValueOnce(null); // Sin colisión

      const dto: UpdateCategoriaDto = {
        nombre: '  Tubería PVC Reforzada  ',
        descripcion: '  Actualizada  ',
      };

      const result = await service.updateCategoria(2, dto);

      expect(catRepoSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 2,
          nombre: 'Tubería PVC Reforzada',
          descripcion: 'Actualizada',
        }),
      );
      expect(result.id).toBe(2);
    });

    it('debe lanzar ConflictException si el nuevo nombre ya lo usa otra categoría', async () => {
      catRepoFindOneSpy.mockResolvedValueOnce({ ...existingCat });
      catQbGetOneSpy.mockResolvedValueOnce({
        id: 9,
        nombre: 'Tuberías PEAD',
      });

      const dto: UpdateCategoriaDto = {
        nombre: 'Tuberías PEAD',
      };

      await expect(service.updateCategoria(2, dto)).rejects.toThrow(
        'Ya existe otra categoría registrada con el nombre "Tuberías PEAD"',
      );
      expect(catRepoSaveSpy).not.toHaveBeenCalled();
    });

    it('no debe validar duplicidad si el nombre no cambia', async () => {
      catRepoFindOneSpy.mockResolvedValueOnce({ ...existingCat });

      const dto: UpdateCategoriaDto = {
        descripcion: 'Nueva descripción solamente',
      };

      await service.updateCategoria(2, dto);

      expect(catCreateQueryBuilderSpy).not.toHaveBeenCalled();
      expect(catRepoSaveSpy).toHaveBeenCalled();
    });
  });

  describe('cambiarEstadoCategoria', () => {
    const cat = {
      id: 4,
      nombre: 'Válvulas',
      activo: true,
    } as CategoriaMaterial;

    it('debe desactivar la categoría sin eliminarla físicamente', async () => {
      catRepoFindOneSpy.mockResolvedValueOnce({ ...cat });

      const result = await service.cambiarEstadoCategoria(4, false);

      expect(catRepoSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 4,
          activo: false,
        }),
      );
      expect(result.activo).toBe(false);
    });

    it('debe reactivar una categoría inactiva', async () => {
      catRepoFindOneSpy.mockResolvedValueOnce({ ...cat, activo: false });

      const result = await service.cambiarEstadoCategoria(4, true);

      expect(catRepoSaveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 4,
          activo: true,
        }),
      );
      expect(result.activo).toBe(true);
    });

    it('debe lanzar NotFoundException si la categoría a cambiar estado no existe', async () => {
      catRepoFindOneSpy.mockResolvedValueOnce(null);

      await expect(service.cambiarEstadoCategoria(999, false)).rejects.toThrow(
        'No se encontró la categoría de materiales con el ID 999',
      );
      expect(catRepoSaveSpy).not.toHaveBeenCalled();
    });
  });
});
