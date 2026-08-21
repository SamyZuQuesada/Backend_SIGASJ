import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FileStorageService } from '../../common/storage/file-storage.service';
import { GaleriaService } from './galeria.service';
import { GaleriaFoto } from './entities/galeria-foto.entity';

describe('GaleriaService', () => {
  let service: GaleriaService;
  let find: jest.Mock;
  let findOne: jest.Mock;
  let create: jest.Mock;
  let save: jest.Mock;
  let remove: jest.Mock;
  let saveGalleryImage: jest.Mock;
  let deleteByPublicUrl: jest.Mock;

  const activePhoto: GaleriaFoto = {
    idGaleriaFoto: 1,
    titulo: 'Tanque',
    descripcion: 'Infraestructura',
    imagenUrl: '/uploads/galeria/photo.jpg',
    textoAlternativo: 'Tanque elevado',
    ordenVisualizacion: 0,
    activo: true,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  };

  beforeEach(async () => {
    find = jest.fn();
    findOne = jest.fn();
    create = jest.fn();
    save = jest.fn();
    remove = jest.fn();
    saveGalleryImage = jest.fn();
    deleteByPublicUrl = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GaleriaService,
        {
          provide: getRepositoryToken(GaleriaFoto),
          useValue: { find, findOne, create, save, remove },
        },
        {
          provide: FileStorageService,
          useValue: { saveGalleryImage, deleteByPublicUrl },
        },
      ],
    }).compile();

    service = module.get(GaleriaService);
  });

  it('findPublicas devuelve solo fotos activas en formato público', async () => {
    find.mockResolvedValue([activePhoto]);

    await expect(service.findPublicas()).resolves.toEqual([
      {
        id: '1',
        imageUrl: '/uploads/galeria/photo.jpg',
        altText: 'Tanque elevado',
        title: 'Tanque',
        description: 'Infraestructura',
      },
    ]);

    expect(find).toHaveBeenCalledWith({
      where: { activo: true },
      order: {
        ordenVisualizacion: 'ASC',
        idGaleriaFoto: 'ASC',
      },
    });
  });

  it('create exige imagen', async () => {
    await expect(
      service.create(
        {
          textoAlternativo: 'Alt',
        },
        undefined,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create guarda metadatos y URL de imagen', async () => {
    const file = {
      buffer: Buffer.from('fake'),
      mimetype: 'image/jpeg',
      size: 100,
      originalname: 'foto.jpg',
    } as Express.Multer.File;

    saveGalleryImage.mockResolvedValue('/uploads/galeria/new.jpg');
    create.mockImplementation((payload: GaleriaFoto) => payload);
    save.mockImplementation(async (payload: GaleriaFoto) => ({
      ...payload,
      idGaleriaFoto: 2,
    }));

    await expect(
      service.create(
        {
          titulo: 'Nueva',
          descripcion: 'Desc',
          textoAlternativo: 'Alt nueva',
          ordenVisualizacion: 1,
          activo: true,
        },
        file,
      ),
    ).resolves.toMatchObject({
      id: 2,
      imagenUrl: '/uploads/galeria/new.jpg',
      textoAlternativo: 'Alt nueva',
    });
  });

  it('remove elimina registro y archivo', async () => {
    findOne.mockResolvedValue(activePhoto);
    remove.mockResolvedValue(activePhoto);

    await service.remove(1);

    expect(remove).toHaveBeenCalledWith(activePhoto);
    expect(deleteByPublicUrl).toHaveBeenCalledWith('/uploads/galeria/photo.jpg');
  });

  it('findOneAdmin responde 404 si no existe', async () => {
    findOne.mockResolvedValue(null);

    await expect(service.findOneAdmin(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
