import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { EstadoProyecto } from '../../common/enums/estado-proyecto.enum';
import {
  deletePhysicalMediaFile,
  saveProyectoImage,
  UploadedImageFile,
} from '../../common/media/public-media';
import { ImagenProyecto } from './entities/imagen-proyecto.entity';
import { Proyecto } from './entities/proyecto.entity';
import { ProyectosService } from './proyectos.service';

describe('Proyectos - Gestión de Imágenes (Unit Tests)', () => {
  let service: ProyectosService;
  let proyectoRepo: any;
  let imagenRepo: any;

  const mockFile = (
    originalname = 'test.png',
    mimetype = 'image/png',
    size = 1024,
  ): UploadedImageFile => ({
    originalname,
    mimetype,
    size,
    buffer: Buffer.from('fake-image-binary-data'),
  });

  beforeEach(async () => {
    proyectoRepo = {
      create: jest.fn((dto) => ({ id: 10, ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: 10, ...entity })),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
      merge: jest.fn((entity, changes) => Object.assign(entity, changes)),
    };

    imagenRepo = {
      create: jest.fn((dto) => ({ id: 100, ...dto })),
      save: jest.fn((entity) => Promise.resolve({ id: 100, ...entity })),
      findOne: jest.fn(),
      remove: jest.fn((entity) => Promise.resolve(entity)),
      update: jest.fn(() => Promise.resolve()),
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProyectosService,
        {
          provide: getRepositoryToken(Proyecto),
          useValue: proyectoRepo,
        },
        {
          provide: getRepositoryToken(ImagenProyecto),
          useValue: imagenRepo,
        },
      ],
    }).compile();

    service = module.get<ProyectosService>(ProyectosService);
  });

  describe('Validación y almacenamiento de imágenes (PublicMedia)', () => {
    it('permite guardar imágenes de tipo JPEG, PNG, WebP y GIF', () => {
      const types = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      types.forEach((mimetype) => {
        const file = mockFile('pic', mimetype, 100);
        const url = saveProyectoImage(1, file, 'cover');
        expect(url).toContain('/api/v1/public/media/proyectos/1_cover_');

        // Limpiar archivo creado en disco
        deletePhysicalMediaFile(url);
      });
    });

    it('rechaza tipos MIME no permitidos', () => {
      const file = mockFile('doc.pdf', 'application/pdf', 100);
      expect(() => saveProyectoImage(1, file, 'cover')).toThrow(
        BadRequestException,
      );
      expect(() => saveProyectoImage(1, file, 'cover')).toThrow(
        'Solo se permiten imágenes JPG, PNG, WebP o GIF.',
      );
    });

    it('rechaza archivos mayores a 5 MB con mensaje exacto', () => {
      const file = mockFile('large.png', 'image/png', 5 * 1024 * 1024 + 1);
      expect(() => saveProyectoImage(1, file, 'cover')).toThrow(
        BadRequestException,
      );
      expect(() => saveProyectoImage(1, file, 'cover')).toThrow(
        'El archivo supera el tamaño máximo permitido (5 MB).',
      );
    });

    it('elimina correctamente un archivo físico', () => {
      const file = mockFile('temp.png', 'image/png', 100);
      const url = saveProyectoImage(99, file, 'cover');

      const relativePath = url.substring('/api/v1/public/media/'.length);
      const filePath = join(process.cwd(), 'uploads', relativePath);
      expect(existsSync(filePath)).toBe(true);

      deletePhysicalMediaFile(url);
      expect(existsSync(filePath)).toBe(false);
    });
  });

  describe('Imagen Principal en Proyecto', () => {
    it('asigna imagen principal al crear proyecto si se adjunta archivo', async () => {
      const file = mockFile('cover.png', 'image/png', 500);

      const result = await service.create(
        { nombre: 'Nuevo Proyecto' },
        undefined,
        file,
      );

      expect(proyectoRepo.save).toHaveBeenCalledTimes(2);
      expect(result.imagenPrincipal).toContain(
        '/api/v1/public/media/proyectos/10_cover_',
      );

      deletePhysicalMediaFile(result.imagenPrincipal);
    });

    it('reemplaza la portada anterior al actualizar proyecto y elimina el archivo físico anterior', async () => {
      const oldFile = mockFile('old.jpg', 'image/jpeg', 200);
      const oldUrl = saveProyectoImage(10, oldFile, 'cover');

      const proyectoExistente: Partial<Proyecto> = {
        id: 10,
        nombre: 'Proyecto Existente',
        imagenPrincipal: oldUrl,
        activo: true,
        estado: EstadoProyecto.EN_PROCESO,
        imagenes: [],
      };

      proyectoRepo.findOne.mockResolvedValue(proyectoExistente);

      // Mock para findOneAdmin / loadAdminById
      jest.spyOn(service as any, 'loadAdminById').mockResolvedValue({
        ...proyectoExistente,
        imagenPrincipal: '/api/v1/public/media/proyectos/10_cover_new.png',
      });

      const newFile = mockFile('new.png', 'image/png', 300);
      await service.updateAdmin(10, {}, undefined, newFile);

      // Verificar que el archivo antiguo fue eliminado físicamente
      const relativePath = oldUrl.substring('/api/v1/public/media/'.length);
      const filePath = join(process.cwd(), 'uploads', relativePath);
      expect(existsSync(filePath)).toBe(false);
    });

    it('elimina la portada al enviar removeImagenPrincipal=true', async () => {
      const oldFile = mockFile('cover.jpg', 'image/jpeg', 200);
      const oldUrl = saveProyectoImage(10, oldFile, 'cover');

      const proyectoExistente: Partial<Proyecto> = {
        id: 10,
        nombre: 'Proyecto Con Portada',
        imagenPrincipal: oldUrl,
        activo: true,
        estado: EstadoProyecto.EN_PROCESO,
        imagenes: [],
      };

      proyectoRepo.findOne.mockResolvedValue(proyectoExistente);

      jest.spyOn(service as any, 'loadAdminById').mockResolvedValue({
        ...proyectoExistente,
        imagenPrincipal: null,
      });

      const updated = await service.updateAdmin(
        10,
        { removeImagenPrincipal: true },
        undefined,
      );

      expect(updated.imagenPrincipal).toBeNull();
      const relativePath = oldUrl.substring('/api/v1/public/media/'.length);
      const filePath = join(process.cwd(), 'uploads', relativePath);
      expect(existsSync(filePath)).toBe(false);
    });

    it('remueve la portada mediante removeImagenPrincipal', async () => {
      const oldFile = mockFile('cover.jpg', 'image/jpeg', 200);
      const oldUrl = saveProyectoImage(10, oldFile, 'cover');

      const proyectoExistente: Partial<Proyecto> = {
        id: 10,
        nombre: 'Proyecto Con Portada',
        imagenPrincipal: oldUrl,
        activo: true,
        estado: EstadoProyecto.EN_PROCESO,
        imagenes: [],
      };

      proyectoRepo.findOne.mockResolvedValue(proyectoExistente);
      jest.spyOn(service as any, 'loadAdminById').mockResolvedValue({
        ...proyectoExistente,
        imagenPrincipal: null,
      });

      const res = await service.removeImagenPrincipal(10);
      expect(res.imagenPrincipal).toBeNull();
    });
  });

  describe('Galería de Fotografías Adicionales', () => {
    it('agrega una fotografía a la galería del proyecto', async () => {
      const proyectoExistente: Partial<Proyecto> = {
        id: 10,
        nombre: 'Proyecto Galería',
        imagenes: [],
      };

      proyectoRepo.findOne.mockResolvedValue(proyectoExistente);

      const qbMock = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ max: 2 }),
      };
      imagenRepo.createQueryBuilder.mockReturnValue(qbMock);

      jest.spyOn(service as any, 'loadAdminById').mockResolvedValue({
        ...proyectoExistente,
        imagenes: [
          {
            id: 100,
            url: '/api/v1/public/media/proyectos/10_galeria_123.png',
            descripcion: 'Foto adicional 1',
            orden: 3,
            createdAt: new Date(),
          },
        ],
      });

      const file = mockFile('foto.png', 'image/png', 200);
      const res = await service.addImagenGaleria(
        10,
        { descripcion: 'Foto adicional 1' },
        file,
      );

      expect(imagenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          descripcion: 'Foto adicional 1',
          orden: 3,
        }),
      );
      expect(res.imagenes).toHaveLength(1);

      deletePhysicalMediaFile(imagenRepo.create.mock.results[0].value.url);
    });

    it('agrega varias fotografías a la galería calculando ordenes secuenciales', async () => {
      const proyectoExistente: Partial<Proyecto> = {
        id: 10,
        nombre: 'Proyecto Varias Fotos',
        imagenes: [],
      };
      proyectoRepo.findOne.mockResolvedValue(proyectoExistente);

      const qbMock1 = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ max: null }),
      };
      imagenRepo.createQueryBuilder.mockReturnValue(qbMock1);

      jest.spyOn(service as any, 'loadAdminById').mockResolvedValue({
        ...proyectoExistente,
        imagenes: [
          { id: 101, url: 'url1', orden: 0 },
          { id: 102, url: 'url2', orden: 1 },
        ],
      });

      const file1 = mockFile('foto1.jpg', 'image/jpeg', 100);
      const file2 = mockFile('foto2.jpg', 'image/jpeg', 100);

      await service.addImagenGaleria(10, { descripcion: 'Foto 1' }, file1);
      expect(imagenRepo.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ orden: 0, descripcion: 'Foto 1' }),
      );

      const qbMock2 = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ max: 0 }),
      };
      imagenRepo.createQueryBuilder.mockReturnValue(qbMock2);

      await service.addImagenGaleria(10, { descripcion: 'Foto 2' }, file2);
      expect(imagenRepo.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ orden: 1, descripcion: 'Foto 2' }),
      );
    });

    it('maneja correctamente un proyecto sin galería devolviendo arreglo vacío', async () => {
      const proyectoExistente: Partial<Proyecto> = {
        id: 10,
        nombre: 'Proyecto Sin Galería',
        imagenes: [],
      };
      proyectoRepo.findOne.mockResolvedValue(proyectoExistente);
      jest.spyOn(service as any, 'loadAdminById').mockResolvedValue({
        ...proyectoExistente,
        imagenes: [],
      });

      const detalle = await service.findOneAdmin(10);
      expect(detalle.imagenes).toBeDefined();
      expect(detalle.imagenes).toEqual([]);
    });


    it('lanza 404 si el proyecto no existe al agregar una fotografía', async () => {
      proyectoRepo.findOne.mockResolvedValue(null);
      const file = mockFile('foto.png', 'image/png', 200);

      await expect(
        service.addImagenGaleria(999, {}, file),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza 400 si no se proporciona archivo de imagen al agregar a la galería', async () => {
      proyectoRepo.findOne.mockResolvedValue({ id: 10 });

      await expect(
        service.addImagenGaleria(10, {}, undefined),
      ).rejects.toThrow(BadRequestException);
    });


    it('elimina una fotografía de la galería y su archivo físico', async () => {
      const photoFile = mockFile('gal.jpg', 'image/jpeg', 200);
      const photoUrl = saveProyectoImage(10, photoFile, 'galeria');

      const proyectoExistente: Partial<Proyecto> = { id: 10 };
      proyectoRepo.findOne.mockResolvedValue(proyectoExistente);

      const imagenExistente = {
        id: 101,
        url: photoUrl,
        proyecto: proyectoExistente,
      };
      imagenRepo.findOne.mockResolvedValue(imagenExistente);

      jest.spyOn(service as any, 'loadAdminById').mockResolvedValue({
        ...proyectoExistente,
        imagenes: [],
      });

      const res = await service.removeImagenGaleria(10, 101);

      expect(imagenRepo.remove).toHaveBeenCalledWith(imagenExistente);
      expect(res.imagenes).toHaveLength(0);

      const relativePath = photoUrl.substring('/api/v1/public/media/'.length);
      const filePath = join(process.cwd(), 'uploads', relativePath);
      expect(existsSync(filePath)).toBe(false);
    });

    it('lanza 404 si la imagen a eliminar no pertenece al proyecto', async () => {
      proyectoRepo.findOne.mockResolvedValue({ id: 10 });
      imagenRepo.findOne.mockResolvedValue(null);

      await expect(service.removeImagenGaleria(10, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('no afecta la imagen principal al retirar una fotografía de la galería', async () => {
      const coverUrl = '/api/v1/public/media/proyectos/10_cover_123.jpg';
      const photoFile = mockFile('gal.jpg', 'image/jpeg', 200);
      const photoUrl = saveProyectoImage(10, photoFile, 'galeria');

      const proyectoExistente: Partial<Proyecto> = {
        id: 10,
        imagenPrincipal: coverUrl,
      };
      proyectoRepo.findOne.mockResolvedValue(proyectoExistente);

      const imagenExistente = {
        id: 101,
        url: photoUrl,
        proyecto: proyectoExistente,
      };
      imagenRepo.findOne.mockResolvedValue(imagenExistente);

      jest.spyOn(service as any, 'loadAdminById').mockResolvedValue({
        ...proyectoExistente,
        imagenPrincipal: coverUrl,
        imagenes: [],
      });

      const res = await service.removeImagenGaleria(10, 101);

      expect(res.imagenPrincipal).toBe(coverUrl);
      deletePhysicalMediaFile(photoUrl);
    });


    it('reordena las imágenes de la galería', async () => {
      proyectoRepo.findOne.mockResolvedValue({ id: 10 });

      jest.spyOn(service as any, 'loadAdminById').mockResolvedValue({
        id: 10,
        nombre: 'Proyecto',
        imagenes: [
          { id: 102, orden: 0 },
          { id: 101, orden: 1 },
        ],
      });

      await service.reordenarImagenesGaleria(10, {
        items: [
          { id: 102, orden: 0 },
          { id: 101, orden: 1 },
        ],
      });

      expect(imagenRepo.update).toHaveBeenCalledWith(
        { id: 102, proyecto: { id: 10 } },
        { orden: 0 },
      );
      expect(imagenRepo.update).toHaveBeenCalledWith(
        { id: 101, proyecto: { id: 10 } },
        { orden: 1 },
      );
    });
  });

  describe('Actualización de Estado del Proyecto (PATCH /admin/proyectos/:id/estado)', () => {
    it('permite actualizar el estado a PENDIENTE, EN_PROCESO y COMPLETADO', async () => {
      const estados = [
        EstadoProyecto.PENDIENTE,
        EstadoProyecto.EN_PROCESO,
        EstadoProyecto.COMPLETADO,
      ];

      for (const estado of estados) {
        const proyectoExistente: Partial<Proyecto> = {
          id: 10,
          nombre: 'Proyecto Estado Test',
          estado: EstadoProyecto.PENDIENTE,
          imagenes: [],
        };
        proyectoRepo.findOne.mockResolvedValue(proyectoExistente);

        const res = await service.updateEstado(10, { estado });
        expect(proyectoRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ estado }),
        );
        expect(res.estado).toBe(estado);
      }
    });

    it('rechaza estados inválidos con 400 Bad Request', async () => {
      await expect(
        service.updateEstado(10, { estado: 'INVALIDO' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza 404 si el proyecto no existe al actualizar el estado', async () => {
      proyectoRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateEstado(999, { estado: EstadoProyecto.COMPLETADO }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Actualización de Visibilidad (PATCH /admin/proyectos/:id/visibilidad)', () => {
    it('permite activar, inactivar y reactivar la visibilidad sin modificar el estado ni eliminar físicamente', async () => {
      const proyectoExistente: Partial<Proyecto> = {
        id: 10,
        nombre: 'Proyecto Visibilidad',
        estado: EstadoProyecto.EN_PROCESO,
        activo: false,
        imagenes: [],
      };
      proyectoRepo.findOne.mockResolvedValue(proyectoExistente);

      // Activar
      let res = await service.updateVisibilidad(10, { activo: true });
      expect(res.activo).toBe(true);
      expect(res.estado).toBe(EstadoProyecto.EN_PROCESO);

      // Inactivar
      res = await service.updateVisibilidad(10, { activo: false });
      expect(res.activo).toBe(false);
      expect(res.estado).toBe(EstadoProyecto.EN_PROCESO);

      // Reactivar
      res = await service.updateVisibilidad(10, { activo: true });
      expect(res.activo).toBe(true);
      expect(res.estado).toBe(EstadoProyecto.EN_PROCESO);
    });

    it('lanza 404 cuando el proyecto a cambiar visibilidad no existe', async () => {
      proyectoRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateVisibilidad(999, { activo: true }),
      ).rejects.toThrow(NotFoundException);
    });

    it('confirma que al filtrar por activo=true los proyectos inactivos se excluyen del listado público', async () => {
      const qbMock = {
        select: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [{ id: 10, nombre: 'Proyecto Público Activo', activo: true }],
          1,
        ]),
      };
      proyectoRepo.createQueryBuilder.mockReturnValue(qbMock);

      const res = await service.findAllAdmin({ activo: true });

      expect(qbMock.andWhere).toHaveBeenCalledWith(
        'proyecto.activo = :activo',
        { activo: true },
      );
      expect(res.data).toHaveLength(1);
      expect(res.data[0].activo).toBe(true);
    });
  });

  describe('Consulta Pública de Proyectos (GET /public/proyectos)', () => {
    it('devuelve únicamente proyectos activos con los campos requeridos para Cards públicas', async () => {
      const qbMock = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 10,
            nombre: 'Proyecto Acueducto Sur',
            imagenPrincipal: '/api/v1/public/media/proyectos/10_cover_1.jpg',
            duracion: '6 meses',
            estado: EstadoProyecto.EN_PROCESO,
            activo: true,
          },
        ]),
      };
      proyectoRepo.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.findAllPublic();

      expect(qbMock.where).toHaveBeenCalledWith('proyecto.activo = :activo', {
        activo: true,
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 10,
        nombre: 'Proyecto Acueducto Sur',
        imagenPrincipal: '/api/v1/public/media/proyectos/10_cover_1.jpg',
        duracion: '6 meses',
        estado: EstadoProyecto.EN_PROCESO,
      });
      // Verificar que no se exponen campos sensibles/administrativos
      expect((result[0] as any).descripcion).toBeUndefined();
      expect((result[0] as any).encargadoRealizacion).toBeUndefined();
    });

    it('devuelve arreglo vacío cuando no existen proyectos activos', async () => {
      const qbMock = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      proyectoRepo.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.findAllPublic();

      expect(result).toEqual([]);
    });
  });
});




