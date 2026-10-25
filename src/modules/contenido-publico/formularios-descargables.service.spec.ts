import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { FormularioDescargable } from './entities/formulario-descargable.entity';
import {
  FormulariosDescargablesService,
  MAX_FORMULARIO_DESCARGABLE_PDF_BYTES,
  type UploadedFormularioPdfFile,
} from './formularios-descargables.service';

describe('FormulariosDescargablesService', () => {
  let service: FormulariosDescargablesService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  const storageDir = join(process.cwd(), 'uploads', 'formularios-descargables');

  const pdfBuffer = Buffer.from('%PDF-1.4\n%test\n%%EOF');
  const fileValido = (): UploadedFormularioPdfFile => ({
    originalname: 'solicitud-conexion.pdf',
    mimetype: 'application/pdf',
    size: pdfBuffer.length,
    buffer: pdfBuffer,
  });

  const baseEntity = (
    overrides: Partial<FormularioDescargable> = {},
  ): FormularioDescargable => {
    const now = new Date('2026-10-20T10:00:00.000Z');
    return {
      id: 1,
      nombre: 'Formulario A',
      descripcion: 'Desc A',
      nombreArchivoOriginal: 'a.pdf',
      nombreArchivoInterno: 'interno-a.pdf',
      ubicacionArchivo: 'formularios-descargables/interno-a.pdf',
      activo: false,
      fechaPublicacion: null,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  };

  beforeAll(() => {
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }
  });

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(
        (x: Partial<FormularioDescargable>) => x as FormularioDescargable,
      ),
      save: jest.fn((x: FormularioDescargable) =>
        Promise.resolve({
          ...x,
          id: x.id ?? 10,
          createdAt: x.createdAt ?? new Date('2026-10-25T08:00:00.000Z'),
          updatedAt: new Date('2026-10-25T08:00:00.000Z'),
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormulariosDescargablesService,
        {
          provide: getRepositoryToken(FormularioDescargable),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get(FormulariosDescargablesService);
  });

  describe('listarAdmin', () => {
    it('devuelve activos e inactivos', async () => {
      repo.find.mockResolvedValue([
        baseEntity({ id: 1, nombre: 'A', activo: true }),
        baseEntity({ id: 2, nombre: 'B', activo: false }),
      ]);

      const list = await service.listarAdmin();
      expect(list).toHaveLength(2);
      expect(list.map((r) => r.activo).sort()).toEqual([false, true]);
      expect(list[0]).not.toHaveProperty('nombreArchivoInterno');
      expect(list[0]).not.toHaveProperty('ubicacionArchivo');
    });
  });

  describe('listarPublicos', () => {
    it('consulta únicamente activos y omite campos internos', async () => {
      repo.find.mockResolvedValue([
        baseEntity({ id: 1, nombre: 'Público A', activo: true }),
      ]);

      const list = await service.listarPublicos();
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { activo: true } }),
      );
      expect(list).toHaveLength(1);
      expect(list[0]).toEqual({
        id: 1,
        nombre: 'Público A',
        descripcion: 'Desc A',
        nombreArchivoOriginal: 'a.pdf',
        activo: true,
      });
      expect(list[0]).not.toHaveProperty('createdAt');
      expect(list[0]).not.toHaveProperty('ubicacionArchivo');
    });
  });

  describe('obtenerStreamDescargaPublica', () => {
    it('404 si el formulario no está activo', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.obtenerStreamDescargaPublica(1)).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 1, activo: true },
      });
    });

    it('retorna stream cuando el PDF activo existe en disco', async () => {
      const filePath = join(storageDir, 'interno-a.pdf');
      writeFileSync(filePath, '%PDF-1.4\npublic');
      repo.findOne.mockResolvedValue(baseEntity({ activo: true }));

      try {
        const result = await service.obtenerStreamDescargaPublica(1);
        expect(result.filename).toBe('a.pdf');
        expect(result.streamableFile).toBeDefined();
        result.streamableFile.getStream().destroy();
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (existsSync(filePath)) {
          try {
            unlinkSync(filePath);
          } catch {
            // ignore
          }
        }
      }
    });
  });

  describe('validarArchivoPdf', () => {
    it('acepta PDF real con %PDF-', () => {
      expect(() => service.validarArchivoPdf(fileValido())).not.toThrow();
    });

    it('rechaza ausencia de archivo', () => {
      expect(() => service.validarArchivoPdf(undefined)).toThrow(
        BadRequestException,
      );
    });

    it('rechaza .txt', () => {
      expect(() =>
        service.validarArchivoPdf({
          ...fileValido(),
          originalname: 'nota.txt',
          mimetype: 'text/plain',
          buffer: Buffer.from('hola'),
          size: 4,
        }),
      ).toThrow(BadRequestException);
    });

    it('rechaza imagen .jpg', () => {
      expect(() =>
        service.validarArchivoPdf({
          originalname: 'foto.jpg',
          mimetype: 'image/jpeg',
          buffer: Buffer.from([0xff, 0xd8, 0xff]),
          size: 3,
        }),
      ).toThrow(BadRequestException);
    });

    it('rechaza archivo renombrado a .pdf sin magic bytes', () => {
      const falso = Buffer.from('<html>malware</html>');
      expect(() =>
        service.validarArchivoPdf({
          originalname: 'malware.pdf',
          mimetype: 'application/pdf',
          buffer: falso,
          size: falso.length,
        }),
      ).toThrow(/PDF válido/);
    });

    it('rechaza archivo demasiado grande', () => {
      const grande = Buffer.alloc(
        MAX_FORMULARIO_DESCARGABLE_PDF_BYTES + 1,
        0x25,
      );
      grande.write('%PDF-', 0, 'ascii');
      expect(() =>
        service.validarArchivoPdf({
          originalname: 'grande.pdf',
          mimetype: 'application/pdf',
          buffer: grande,
          size: grande.length,
        }),
      ).toThrow(/tamaño máximo/);
    });
  });

  describe('crear', () => {
    it('persiste registro con PDF y limpia si BD falla', async () => {
      const created = await service.crear(
        { nombre: 'Solicitud de nueva conexión' },
        fileValido(),
      );

      expect(created.nombre).toBe('Solicitud de nueva conexión');
      expect(created.nombreArchivoOriginal).toBe('solicitud-conexion.pdf');
      expect(created.activo).toBe(false);
      expect(repo.save).toHaveBeenCalled();

      expect(repo.save).toHaveBeenCalled();
      const saveCalls = repo.save.mock.calls as [
        FormularioDescargable,
        ...unknown[],
      ][];
      const savedArg = saveCalls[0][0];
      const ruta = join(storageDir, savedArg.nombreArchivoInterno);
      expect(existsSync(ruta)).toBe(true);
      expect(readFileSync(ruta).subarray(0, 5).toString('ascii')).toBe('%PDF-');
      unlinkSync(ruta);
    });

    it('sin PDF → 400 y no guarda', async () => {
      await expect(
        service.crear({ nombre: 'Sin archivo' }, undefined),
      ).rejects.toThrow(BadRequestException);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('compensa archivo huérfano si save falla', async () => {
      repo.save.mockRejectedValueOnce(new Error('DB down'));
      await expect(
        service.crear({ nombre: 'Fallo BD' }, fileValido()),
      ).rejects.toThrow('DB down');

      const recientes = readdirSync(storageDir)
        .filter((f) => f.endsWith('.pdf'))
        .filter((f) => readFileSync(join(storageDir, f)).equals(pdfBuffer));
      expect(recientes).toHaveLength(0);
    });
  });

  describe('actualizarMetadata', () => {
    it('cambia nombre y descripción sin tocar PDF', async () => {
      const entity = baseEntity();
      repo.findOne.mockResolvedValue(entity);

      const res = await service.actualizarMetadata(1, {
        nombre: 'Nombre B',
        descripcion: 'Nueva desc',
      });

      expect(res.nombre).toBe('Nombre B');
      expect(entity.nombreArchivoInterno).toBe('interno-a.pdf');
      expect(entity.ubicacionArchivo).toBe(
        'formularios-descargables/interno-a.pdf',
      );
    });

    it('404 si no existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.actualizarMetadata(999, { nombre: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reemplazarArchivo', () => {
    it('reemplaza PDF-A por PDF-B y elimina el anterior', async () => {
      writeFileSync(join(storageDir, 'interno-a.pdf'), '%PDF-1.4\nold');
      const entity = baseEntity();
      repo.findOne.mockResolvedValue(entity);

      const nuevo = Buffer.from('%PDF-1.4\n%new\n%%EOF');
      const res = await service.reemplazarArchivo(1, {
        originalname: 'nuevo.pdf',
        mimetype: 'application/pdf',
        size: nuevo.length,
        buffer: nuevo,
      });

      expect(res.nombreArchivoOriginal).toBe('nuevo.pdf');
      expect(entity.nombreArchivoInterno).not.toBe('interno-a.pdf');
      expect(existsSync(join(storageDir, 'interno-a.pdf'))).toBe(false);
      const nuevaRuta = join(storageDir, entity.nombreArchivoInterno);
      expect(existsSync(nuevaRuta)).toBe(true);
      unlinkSync(nuevaRuta);
    });

    it('reemplazo inválido conserva referencia anterior', async () => {
      const entity = baseEntity();
      repo.findOne.mockResolvedValue(entity);
      const ubicacionAntes = entity.ubicacionArchivo;
      const internoAntes = entity.nombreArchivoInterno;

      await expect(
        service.reemplazarArchivo(1, {
          originalname: 'fake.pdf',
          mimetype: 'application/pdf',
          buffer: Buffer.from('not-a-pdf'),
          size: 9,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(entity.ubicacionArchivo).toBe(ubicacionAntes);
      expect(entity.nombreArchivoInterno).toBe(internoAntes);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('si BD falla tras upload, conserva PDF anterior y limpia el nuevo', async () => {
      writeFileSync(join(storageDir, 'interno-a.pdf'), '%PDF-1.4\nold');
      const entity = baseEntity();
      repo.findOne.mockResolvedValue(entity);
      repo.save.mockRejectedValueOnce(new Error('DB fail'));

      const nuevo = Buffer.from('%PDF-1.4\n%orphan\n%%EOF');
      await expect(
        service.reemplazarArchivo(1, {
          originalname: 'nuevo.pdf',
          mimetype: 'application/pdf',
          size: nuevo.length,
          buffer: nuevo,
        }),
      ).rejects.toThrow('DB fail');

      expect(entity.nombreArchivoInterno).toBe('interno-a.pdf');
      expect(existsSync(join(storageDir, 'interno-a.pdf'))).toBe(true);
      unlinkSync(join(storageDir, 'interno-a.pdf'));
    });
  });

  describe('cambiarEstado', () => {
    it('activa sin borrar PDF ni registro', async () => {
      const entity = baseEntity({ activo: false });
      repo.findOne.mockResolvedValue(entity);

      const res = await service.cambiarEstado(1, true);
      expect(res.activo).toBe(true);
      expect(entity.nombreArchivoInterno).toBe('interno-a.pdf');
      expect(repo.save).toHaveBeenCalled();
    });

    it('inactiva sin delete/remove', async () => {
      const entity = baseEntity({ activo: true });
      repo.findOne.mockResolvedValue(entity);

      const res = await service.cambiarEstado(1, false);
      expect(res.activo).toBe(false);
      expect(Object.keys(repo)).not.toContain('delete');
      expect(Object.keys(repo)).not.toContain('remove');
    });

    it('reactiva el mismo registro', async () => {
      const entity = baseEntity({ activo: false, id: 5 });
      repo.findOne.mockResolvedValue(entity);
      await service.cambiarEstado(5, true);
      expect(entity.activo).toBe(true);
      expect(entity.id).toBe(5);
    });
  });
});
