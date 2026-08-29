import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EstadoProyecto } from '../../common/enums/estado-proyecto.enum';
import { CreateProyectoDto } from './dto/create-proyecto.dto';
import { UpdateProyectoDto } from './dto/update-proyecto.dto';
import { ImagenProyecto } from './entities/imagen-proyecto.entity';
import { Proyecto } from './entities/proyecto.entity';
import { ProyectosService } from './proyectos.service';

const createMemoryRepo = () => {
  const items: Proyecto[] = [];
  let nextId = 1;
  const qb = {
    select: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getOne: jest.fn().mockResolvedValue(null),
  };

  return {
    items,
    qb,
    create: jest.fn((data: Partial<Proyecto>) => ({ ...data }) as Proyecto),
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn((options?: { where?: { id?: number } }) => {
      const found =
        items.find((item) => item.id === options?.where?.id) ?? null;
      return Promise.resolve(
        found ? { ...found, imagenes: found.imagenes ?? [] } : null,
      );
    }),
    merge: jest.fn(
      (entity: Proyecto, ...patches: Array<Partial<Proyecto>>): Proyecto => {
        for (const patch of patches) {
          Object.assign(entity, patch);
        }
        return entity;
      },
    ),
    save: jest.fn((entity: Proyecto) => {
      const now = new Date();
      if (entity.id) {
        const saved: Proyecto = {
          ...entity,
          updatedAt: now,
          imagenes: entity.imagenes ?? [],
        };
        const idx = items.findIndex((item) => item.id === entity.id);
        if (idx >= 0) {
          items[idx] = saved;
        } else {
          items.push(saved);
        }
        return Promise.resolve(saved);
      }

      const saved: Proyecto = {
        ...entity,
        id: nextId++,
        createdAt: now,
        updatedAt: now,
        imagenes: entity.imagenes ?? [],
      };
      items.push(saved);
      return Promise.resolve(saved);
    }),
  };
};

const mockImagenRepo = {

  create: jest.fn((data) => ({ id: 1, ...data })),
  save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
  findOne: jest.fn(),
  remove: jest.fn((data) => Promise.resolve(data)),
  update: jest.fn(() => Promise.resolve()),
  createQueryBuilder: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ max: 0 }),
  })),
};

describe('ProyectosService', () => {
  let service: ProyectosService;
  let repo: ReturnType<typeof createMemoryRepo>;

  beforeEach(async () => {
    repo = createMemoryRepo();
    const module = await Test.createTestingModule({
      providers: [
        ProyectosService,
        { provide: getRepositoryToken(Proyecto), useValue: repo },
        {
          provide: getRepositoryToken(ImagenProyecto),
          useValue: mockImagenRepo,
        },
      ],
    }).compile();

    service = module.get(ProyectosService);
  });


  it('persiste un proyecto válido con visibilidad inicial inactiva', async () => {
    const dto: CreateProyectoDto = {
      nombre: 'Ampliación de Acueducto',
      descripcion: 'Ampliación de la red principal',
      encargadoRealizacion: 'Ing. María Rodríguez',
      duracion: '8 meses',
      estado: EstadoProyecto.EN_PROCESO,
      imagenPrincipal: 'https://ejemplo.com/tanque.jpg',
    };

    const saved = await service.create(dto);

    expect(repo.create).toHaveBeenCalledWith({
      nombre: 'Ampliación de Acueducto',
      descripcion: 'Ampliación de la red principal',
      encargadoRealizacion: 'Ing. María Rodríguez',
      duracion: '8 meses',
      estado: EstadoProyecto.EN_PROCESO,
      imagenPrincipal: 'https://ejemplo.com/tanque.jpg',
      activo: false,
    });
    expect(saved.id).toBeDefined();
    expect(saved.activo).toBe(false);
    expect(saved.estado).toBe(EstadoProyecto.EN_PROCESO);
    expect(saved.createdAt).toBeInstanceOf(Date);
    expect(saved.updatedAt).toBeInstanceOf(Date);
  });

  it('asigna PENDIENTE cuando no se envía estado y no publica el proyecto', async () => {
    const saved = await service.create({
      nombre: 'Tanque de almacenamiento',
    });

    expect(saved.estado).toBe(EstadoProyecto.PENDIENTE);
    expect(saved.activo).toBe(false);
    expect(saved.descripcion).toBeNull();
    expect(saved.encargadoRealizacion).toBeNull();
    expect(saved.duracion).toBeNull();
    expect(saved.imagenPrincipal).toBeNull();
  });

  it('rechaza un estado inválido y no guarda el registro', async () => {
    await expect(
      service.create({
        nombre: 'Proyecto inválido',
        estado: 'Inactivo' as EstadoProyecto,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repo.save).not.toHaveBeenCalled();
  });

  it('ignora campos internos aunque vengan mezclados en el DTO', async () => {
    const dto = {
      nombre: 'Proyecto controlado',
      activo: true,
      id: 99,
    } as CreateProyectoDto & { activo: boolean; id: number };

    await service.create(dto);

    expect(repo.create).toHaveBeenCalledWith(
      expect.not.objectContaining({ id: 99, activo: true }),
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ activo: false, nombre: 'Proyecto controlado' }),
    );
  });

  it('busca por nombre de forma parcial y parametrizada', async () => {
    await service.findAllAdmin({ nombre: 'agua' });

    expect(repo.qb.andWhere).toHaveBeenCalledTimes(1);
    expect(repo.qb.andWhere).toHaveBeenCalledWith(
      'proyecto.nombre LIKE :nombre',
      { nombre: '%agua%' },
    );
  });

  it('ignora el filtro de nombre cuando queda vacío después de trim', async () => {
    await service.findAllAdmin({ nombre: '   ' });

    expect(repo.qb.andWhere).not.toHaveBeenCalled();
  });

  it('consulta administrativa sin filtros no excluye por estado ni visibilidad', async () => {
    const listado = await service.findAllAdmin();

    expect(repo.createQueryBuilder).toHaveBeenCalledWith('proyecto');
    expect(repo.qb.andWhere).not.toHaveBeenCalled();
    expect(repo.qb.skip).toHaveBeenCalledWith(0);
    expect(repo.qb.take).toHaveBeenCalledWith(10);
    expect(listado).toEqual({
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
  });

  it('filtra por estado real sin aplicarlo cuando no viene en la consulta', async () => {
    await service.findAllAdmin({ estado: EstadoProyecto.EN_PROCESO });

    expect(repo.qb.andWhere).toHaveBeenCalledTimes(1);
    expect(repo.qb.andWhere).toHaveBeenCalledWith('proyecto.estado = :estado', {
      estado: EstadoProyecto.EN_PROCESO,
    });
  });

  it('filtra solo proyectos activos cuando activo=true', async () => {
    await service.findAllAdmin({ activo: true });

    expect(repo.qb.andWhere).toHaveBeenCalledTimes(1);
    expect(repo.qb.andWhere).toHaveBeenCalledWith('proyecto.activo = :activo', {
      activo: true,
    });
  });

  it('filtra solo proyectos inactivos cuando activo=false', async () => {
    await service.findAllAdmin({ activo: false });

    expect(repo.qb.andWhere).toHaveBeenCalledTimes(1);
    expect(repo.qb.andWhere).toHaveBeenCalledWith('proyecto.activo = :activo', {
      activo: false,
    });
  });

  it('combina nombre y estado con AND', async () => {
    await service.findAllAdmin({
      nombre: 'agua',
      estado: EstadoProyecto.EN_PROCESO,
    });

    expect(repo.qb.andWhere).toHaveBeenCalledTimes(2);
    expect(repo.qb.andWhere).toHaveBeenCalledWith(
      'proyecto.nombre LIKE :nombre',
      { nombre: '%agua%' },
    );
    expect(repo.qb.andWhere).toHaveBeenCalledWith('proyecto.estado = :estado', {
      estado: EstadoProyecto.EN_PROCESO,
    });
  });

  it('combina nombre y activo con AND', async () => {
    await service.findAllAdmin({
      nombre: 'agua',
      activo: true,
    });

    expect(repo.qb.andWhere).toHaveBeenCalledTimes(2);
    expect(repo.qb.andWhere).toHaveBeenCalledWith(
      'proyecto.nombre LIKE :nombre',
      { nombre: '%agua%' },
    );
    expect(repo.qb.andWhere).toHaveBeenCalledWith('proyecto.activo = :activo', {
      activo: true,
    });
  });

  it('trata estado y activo como filtros independientes', async () => {
    await service.findAllAdmin({
      estado: EstadoProyecto.EN_PROCESO,
      activo: false,
    });

    expect(repo.qb.andWhere).toHaveBeenCalledTimes(2);
    expect(repo.qb.andWhere).toHaveBeenCalledWith('proyecto.estado = :estado', {
      estado: EstadoProyecto.EN_PROCESO,
    });
    expect(repo.qb.andWhere).toHaveBeenCalledWith('proyecto.activo = :activo', {
      activo: false,
    });
  });

  it('rechaza un estado inexistente con 400 y no consulta', async () => {
    await expect(
      service.findAllAdmin({
        estado: 'EN_EJECUCION' as EstadoProyecto,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repo.qb.andWhere).not.toHaveBeenCalled();
  });

  it('aplica filtros combinables y paginación sin forzar activo=true', async () => {
    await service.findAllAdmin({
      nombre: 'acueducto',
      estado: EstadoProyecto.EN_PROCESO,
      activo: false,
      page: 2,
      limit: 10,
    });

    expect(repo.qb.andWhere).toHaveBeenCalledTimes(3);
    expect(repo.qb.andWhere).toHaveBeenCalledWith(
      'proyecto.nombre LIKE :nombre',
      { nombre: '%acueducto%' },
    );
    expect(repo.qb.andWhere).toHaveBeenCalledWith('proyecto.estado = :estado', {
      estado: EstadoProyecto.EN_PROCESO,
    });
    expect(repo.qb.andWhere).toHaveBeenCalledWith('proyecto.activo = :activo', {
      activo: false,
    });
    expect(repo.qb.skip).toHaveBeenCalledWith(10);
    expect(repo.qb.take).toHaveBeenCalledWith(10);
  });

  it('devuelve lista vacía y metadata en una página sin registros, sin 404', async () => {
    repo.qb.getManyAndCount.mockResolvedValueOnce([[], 5]);

    const listado = await service.findAllAdmin({ page: 2, limit: 10 });

    expect(repo.qb.skip).toHaveBeenCalledWith(10);
    expect(repo.qb.take).toHaveBeenCalledWith(10);
    expect(listado).toEqual({
      data: [],
      total: 5,
      page: 2,
      limit: 10,
      totalPages: 1,
    });
  });

  it('consulta el detalle administrativo completo sin filtrar por visibilidad', async () => {
    const saved = await service.create({
      nombre: 'Tanque de almacenamiento',
      descripcion: 'Capacidad de 500 m3',
      encargadoRealizacion: 'Ing. María Rodríguez',
      duracion: '8 meses',
      estado: EstadoProyecto.EN_PROCESO,
      imagenPrincipal: 'https://ejemplo.com/tanque.jpg',
    });
    repo.qb.getOne.mockResolvedValueOnce({
      ...saved,
      imagenes: [],
    });

    const found = await service.findOneAdmin(saved.id);

    expect(repo.createQueryBuilder).toHaveBeenCalledWith('proyecto');
    expect(repo.qb.leftJoinAndSelect).toHaveBeenCalledWith(
      'proyecto.imagenes',
      'imagenes',
    );
    expect(repo.qb.where).toHaveBeenCalledWith('proyecto.id = :id', {
      id: saved.id,
    });
    expect(repo.qb.andWhere).not.toHaveBeenCalled();
    expect(found).toMatchObject({
      id: saved.id,
      nombre: 'Tanque de almacenamiento',
      descripcion: 'Capacidad de 500 m3',
      encargadoRealizacion: 'Ing. María Rodríguez',
      duracion: '8 meses',
      estado: EstadoProyecto.EN_PROCESO,
      imagenPrincipal: 'https://ejemplo.com/tanque.jpg',
      activo: false,
      imagenes: [],
    });
    expect(found.createdAt).toBeInstanceOf(Date);
    expect(found.updatedAt).toBeInstanceOf(Date);
  });

  it('devuelve un proyecto inactivo y uno activo por id, sin exigir activo=true', async () => {
    const inactivo = await service.create({ nombre: 'Obra inactiva' });
    repo.qb.getOne.mockResolvedValueOnce({
      ...inactivo,
      imagenes: [],
    });
    await expect(service.findOneAdmin(inactivo.id)).resolves.toMatchObject({
      id: inactivo.id,
      activo: false,
    });

    const publicado = await service.create({ nombre: 'Obra publicada' });
    publicado.activo = true;
    repo.qb.getOne.mockResolvedValueOnce({
      ...publicado,
      imagenes: [],
    });
    const activo = await service.findOneAdmin(publicado.id);
    expect(activo).toMatchObject({
      id: publicado.id,
      nombre: 'Obra publicada',
      activo: true,
    });

    expect(repo.qb.where.mock.calls).toEqual([
      ['proyecto.id = :id', { id: inactivo.id }],
      ['proyecto.id = :id', { id: publicado.id }],
    ]);
  });

  it('devuelve galería vacía cuando el proyecto no tiene imágenes', async () => {
    const saved = await service.create({ nombre: 'Sin galería' });
    repo.qb.getOne.mockResolvedValueOnce({
      ...saved,
      imagenes: undefined,
    });

    const found = await service.findOneAdmin(saved.id);

    expect(found.imagenes).toEqual([]);
  });

  it('carga las imágenes relacionadas y las ordena por orden e id', async () => {
    const saved = await service.create({ nombre: 'Con galería' });
    const createdAt = new Date();
    const imagenes = [
      {
        id: 2,
        url: 'https://ejemplo.com/b.jpg',
        descripcion: 'Segunda',
        orden: 2,
        createdAt,
        proyecto: saved,
      },
      {
        id: 1,
        url: 'https://ejemplo.com/a.jpg',
        descripcion: 'Primera',
        orden: 1,
        createdAt,
        proyecto: saved,
      },
    ];
    repo.qb.getOne.mockResolvedValueOnce({
      ...saved,
      imagenes,
    });

    const found = await service.findOneAdmin(saved.id);

    expect(repo.qb.leftJoinAndSelect).toHaveBeenCalledWith(
      'proyecto.imagenes',
      'imagenes',
    );
    expect(repo.qb.orderBy).toHaveBeenCalledWith('imagenes.orden', 'ASC');
    expect(repo.qb.addOrderBy).toHaveBeenCalledWith('imagenes.id', 'ASC');
    expect(found.imagenes).toEqual([
      {
        id: 2,
        url: 'https://ejemplo.com/b.jpg',
        descripcion: 'Segunda',
        orden: 2,
        createdAt,
      },
      {
        id: 1,
        url: 'https://ejemplo.com/a.jpg',
        descripcion: 'Primera',
        orden: 1,
        createdAt,
      },
    ]);
    expect(found).not.toHaveProperty('password');
    expect(found).not.toHaveProperty('passwordHash');
    expect(found.imagenes.every((img) => !('proyecto' in img))).toBe(true);
    expect(JSON.stringify(found)).not.toContain('"password"');
  });

  it('lanza 404 cuando el id numérico no existe', async () => {
    await expect(service.findOneAdmin(999)).rejects.toMatchObject({
      status: 404,
      message: 'Proyecto no encontrado',
    });
    expect(repo.qb.where).toHaveBeenCalledWith('proyecto.id = :id', {
      id: 999,
    });
    expect(repo.qb.getOne).toHaveBeenCalled();
  });

  it('actualiza solo la información general enviada', async () => {
    const saved = await service.create({
      nombre: 'Tanque de almacenamiento',
      descripcion: 'Capacidad de 500 m3',
      encargadoRealizacion: 'Ing. María Rodríguez',
      duracion: '8 meses',
      estado: EstadoProyecto.EN_PROCESO,
      imagenPrincipal: 'https://ejemplo.com/tanque.jpg',
    });
    const updated = await service.updateAdmin(saved.id, {
      nombre: 'Nuevo nombre',
    });

    expect(repo.merge).toHaveBeenCalledWith(expect.anything(), {
      nombre: 'Nuevo nombre',
    });
    expect(repo.merge.mock.calls[0][1]).not.toHaveProperty('createdAt');
    expect(repo.merge.mock.calls[0][1]).not.toHaveProperty('updatedAt');
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: saved.id,
        nombre: 'Nuevo nombre',
        descripcion: 'Capacidad de 500 m3',
        encargadoRealizacion: 'Ing. María Rodríguez',
        duracion: '8 meses',
        estado: EstadoProyecto.EN_PROCESO,
        imagenPrincipal: 'https://ejemplo.com/tanque.jpg',
        activo: false,
        createdAt: saved.createdAt,
      }),
    );
    expect(updated.createdAt).toEqual(saved.createdAt);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
      saved.updatedAt.getTime(),
    );
    expect(updated).toMatchObject({
      id: saved.id,
      nombre: 'Nuevo nombre',
      descripcion: 'Capacidad de 500 m3',
      estado: EstadoProyecto.EN_PROCESO,
      imagenPrincipal: 'https://ejemplo.com/tanque.jpg',
      activo: false,
    });
  });

  it('no aplica estado, visibilidad, imagen ni id aunque vengan en el DTO', async () => {
    const saved = await service.create({
      nombre: 'Obra controlada',
      estado: EstadoProyecto.PENDIENTE,
      imagenPrincipal: 'https://ejemplo.com/original.jpg',
    });
    const originalId = saved.id;

    const dto = {
      nombre: 'Nombre autorizado',
      estado: EstadoProyecto.COMPLETADO,
      activo: true,
      visible: true,
      publicado: true,
      id: 999,
      imagenPrincipal: 'https://ejemplo.com/hack.jpg',
      imagenes: [{ url: 'https://ejemplo.com/galeria-hack.jpg' }],
      createdAt: new Date('2020-01-01'),
      updatedAt: new Date('2020-01-01'),
      createdBy: 'usuario-ajeno',
      usuarioModificador: 'usuario-ajeno',
    } as UpdateProyectoDto;

    const updated = await service.updateAdmin(originalId, dto);

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: originalId,
        nombre: 'Nombre autorizado',
        estado: EstadoProyecto.PENDIENTE,
        activo: false,
        imagenPrincipal: 'https://ejemplo.com/original.jpg',
      }),
    );
    expect(repo.save).toHaveBeenCalledWith(
      expect.not.objectContaining({
        estado: EstadoProyecto.COMPLETADO,
        activo: true,
        imagenPrincipal: 'https://ejemplo.com/hack.jpg',
        createdBy: 'usuario-ajeno',
        usuarioModificador: 'usuario-ajeno',
      }),
    );
    expect(updated).toMatchObject({
      id: originalId,
      nombre: 'Nombre autorizado',
      estado: EstadoProyecto.PENDIENTE,
      activo: false,
      imagenPrincipal: 'https://ejemplo.com/original.jpg',
      imagenes: [],
    });
    expect(repo.merge.mock.calls.at(-1)?.[1]).toEqual({
      nombre: 'Nombre autorizado',
    });
  });

  it('lanza 404 al actualizar un id inexistente y no crea ni guarda', async () => {
    const existing = await service.create({ nombre: 'Obra existente' });
    const savesBefore = repo.save.mock.calls.length;
    const mergesBefore = repo.merge.mock.calls.length;
    const countBefore = repo.items.length;

    await expect(
      service.updateAdmin(999, { nombre: 'No debe persistir' }),
    ).rejects.toMatchObject({
      status: 404,
      message: 'Proyecto no encontrado',
    });

    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 999 },
      relations: { imagenes: true },
    });
    expect(repo.merge.mock.calls.length).toBe(mergesBefore);
    expect(repo.save.mock.calls.length).toBe(savesBefore);
    expect(repo.items).toHaveLength(countBefore);
    expect(repo.items[0].id).toBe(existing.id);
    expect(repo.items[0].nombre).toBe('Obra existente');
  });

  it('no sobrescribe descripción, encargado ni duración con undefined', async () => {
    const saved = await service.create({
      nombre: 'Tanque de almacenamiento',
      descripcion: 'Capacidad de 500 m3',
      encargadoRealizacion: 'Ing. María Rodríguez',
      duracion: '8 meses',
    });
    const dto: UpdateProyectoDto = { nombre: 'Solo el nombre' };
    dto.descripcion = undefined;
    dto.encargadoRealizacion = undefined;
    dto.duracion = undefined;

    await service.updateAdmin(saved.id, dto);

    expect(repo.merge).toHaveBeenCalledWith(expect.anything(), {
      nombre: 'Solo el nombre',
    });
    expect(repo.merge.mock.calls[0][1]).not.toHaveProperty('descripcion');
    expect(repo.merge.mock.calls[0][1]).not.toHaveProperty(
      'encargadoRealizacion',
    );
    expect(repo.merge.mock.calls[0][1]).not.toHaveProperty('duracion');
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: 'Solo el nombre',
        descripcion: 'Capacidad de 500 m3',
        encargadoRealizacion: 'Ing. María Rodríguez',
        duracion: '8 meses',
      }),
    );
  });
});
