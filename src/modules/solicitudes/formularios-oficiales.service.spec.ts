import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';
import { FormularioOficial } from './entities/formulario-oficial.entity';
import { TipoSolicitud } from './entities/tipo-solicitud.entity';
import {
  FormulariosOficialesService,
  UploadedPdfFile,
} from './formularios-oficiales.service';

describe('FormulariosOficialesService', () => {
  let service: FormulariosOficialesService;
  let formularioRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let tipoSolicitudRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
  };

  const pdfBufferValido = Buffer.from('%PDF-1.4\n%...\n%%EOF');

  const fileValido: UploadedPdfFile = {
    originalname: 'formulario-arreglo-pago.pdf',
    mimetype: 'application/pdf',
    size: pdfBufferValido.length,
    buffer: pdfBufferValido,
  };

  const mockTiposOficiales: TipoSolicitud[] = [
    {
      id: 1,
      nombre: 'Solicitud de Arreglo de Pago Domiciliar',
      descripcion: 'Convenio de pago',
      slug: TipoSolicitudSlug.ARREGLO_PAGO,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      nombre: 'Cambio de Nombre del Titular del Servicio',
      descripcion: 'Traspaso de servicio',
      slug: TipoSolicitudSlug.CAMBIO_TITULAR,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 3,
      nombre: 'Constancia de Infraestructura Frente a Linderos de un Inmueble',
      descripcion: 'Constancia linderos',
      slug: TipoSolicitudSlug.INFRAESTRUCTURA_LINDEROS,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 4,
      nombre: 'Solicitud de Afiliación',
      descripcion: 'Afiliación',
      slug: TipoSolicitudSlug.AFILIACION,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 5,
      nombre: 'Constancia de Disponibilidad de Servicios',
      descripcion: 'Disponibilidad',
      slug: TipoSolicitudSlug.DISPONIBILIDAD_SERVICIOS,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 6,
      nombre: 'Constancia de Servicio Existente',
      descripcion: 'Servicio existente',
      slug: TipoSolicitudSlug.SERVICIO_EXISTENTE,
      activo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(async () => {
    formularioRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest
        .fn()
        .mockImplementation((val) => Promise.resolve({ id: 10, ...val })),
      create: jest.fn().mockImplementation((val) => val),
    };

    tipoSolicitudRepo = {
      find: jest.fn().mockResolvedValue(mockTiposOficiales),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FormulariosOficialesService,
        {
          provide: getRepositoryToken(FormularioOficial),
          useValue: formularioRepo,
        },
        {
          provide: getRepositoryToken(TipoSolicitud),
          useValue: tipoSolicitudRepo,
        },
      ],
    }).compile();

    service = module.get<FormulariosOficialesService>(
      FormulariosOficialesService,
    );
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('listarFormulariosOficialesAdmin', () => {
    it('debe devolver exactamente los 6 trámites oficiales con su estado de PDF', async () => {
      const tiposConFormulario = mockTiposOficiales.map((tipo, idx) => ({
        ...tipo,
        formularioOficial:
          idx === 0
            ? {
                id: 1,
                tipoSolicitudId: 1,
                nombreArchivoOriginal: 'arreglo.pdf',
                tamano: 50000,
                fechaCarga: new Date('2026-10-20'),
              }
            : null,
      }));

      tipoSolicitudRepo.find.mockResolvedValue(tiposConFormulario);

      const resultado = await service.listarFormulariosOficialesAdmin();

      expect(resultado).toHaveLength(6);
      expect(resultado[0].tienePdf).toBe(true);
      expect(resultado[0].nombreArchivo).toBe('arreglo.pdf');
      expect(resultado[1].tienePdf).toBe(false);
      expect(resultado[1].nombreArchivo).toBeNull();
    });
  });

  describe('validarArchivoPdf', () => {
    it('debe aceptar un PDF auténtico con cabecera %PDF-', () => {
      expect(() => service.validarArchivoPdf(fileValido)).not.toThrow();
    });

    it('debe rechazar archivo vacío o sin buffer', () => {
      expect(() =>
        service.validarArchivoPdf({
          ...fileValido,
          buffer: Buffer.from([]),
          size: 0,
        }),
      ).toThrow(BadRequestException);
    });

    it('debe rechazar extensión distinta a .pdf (HTML, JPG, PNG, etc.)', () => {
      expect(() =>
        service.validarArchivoPdf({
          ...fileValido,
          originalname: 'documento.html',
        }),
      ).toThrow(BadRequestException);

      expect(() =>
        service.validarArchivoPdf({
          ...fileValido,
          originalname: 'foto.jpg',
        }),
      ).toThrow(BadRequestException);
    });

    it('debe rechazar MIME distinto a application/pdf', () => {
      expect(() =>
        service.validarArchivoPdf({
          ...fileValido,
          mimetype: 'text/html',
        }),
      ).toThrow(BadRequestException);
    });

    it('debe rechazar archivo falsamente renombrado a .pdf sin firma mágica %PDF-', () => {
      const falsoPdf = Buffer.from('<html><body>Contenido falso</body></html>');
      expect(() =>
        service.validarArchivoPdf({
          ...fileValido,
          buffer: falsoPdf,
          size: falsoPdf.length,
        }),
      ).toThrow(BadRequestException);
    });

    it('debe rechazar archivo que supere el tamaño máximo permitido', () => {
      expect(() =>
        service.validarArchivoPdf({
          ...fileValido,
          size: 15 * 1024 * 1024,
          buffer: Buffer.alloc(15 * 1024 * 1024),
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('subirOReemplazarPdf', () => {
    it('debe subir exitosamente un PDF para un trámite oficial sin PDF previo', async () => {
      tipoSolicitudRepo.findOne.mockResolvedValue({
        id: 1,
        slug: TipoSolicitudSlug.ARREGLO_PAGO,
        nombre: 'Solicitud de Arreglo de Pago Domiciliar',
      });

      const res = await service.subirOReemplazarPdf(1, fileValido);

      expect(res.tipoSolicitudId).toBe(1);
      expect(res.tienePdf).toBe(true);
      expect(res.nombreArchivo).toBe('formulario-arreglo-pago.pdf');
      expect(formularioRepo.save).toHaveBeenCalled();
    });

    it('debe reemplazar de forma segura un PDF existente eliminando el anterior del disco', async () => {
      const archivoAnteriorInterno = 'anterior-test.pdf';
      const rutaAnterior = join(
        process.cwd(),
        'uploads',
        'formularios-oficiales',
        archivoAnteriorInterno,
      );
      writeFileSync(rutaAnterior, '%PDF-1.4\nold file');

      tipoSolicitudRepo.findOne.mockResolvedValue({
        id: 1,
        slug: TipoSolicitudSlug.ARREGLO_PAGO,
        nombre: 'Solicitud de Arreglo de Pago Domiciliar',
        formularioOficial: {
          id: 1,
          tipoSolicitudId: 1,
          nombreArchivoOriginal: 'viejo.pdf',
          nombreArchivoInterno: archivoAnteriorInterno,
          tamano: 200,
        },
      });

      const res = await service.subirOReemplazarPdf(1, fileValido);

      expect(res.tienePdf).toBe(true);
      expect(res.nombreArchivo).toBe('formulario-arreglo-pago.pdf');
      expect(existsSync(rutaAnterior)).toBe(false);
    });

    it('debe lanzar NotFoundException si el tipo de solicitud no existe', async () => {
      tipoSolicitudRepo.findOne.mockResolvedValue(null);

      await expect(
        service.subirOReemplazarPdf(999, fileValido),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar BadRequestException si el trámite no corresponde a los 6 oficiales', async () => {
      tipoSolicitudRepo.findOne.mockResolvedValue({
        id: 7,
        slug: 'tramite-no-oficial',
      });

      await expect(service.subirOReemplazarPdf(7, fileValido)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('obtenerStreamDescargaPublica', () => {
    it('debe lanzar NotFoundException si el trámite no existe', async () => {
      tipoSolicitudRepo.findOne.mockResolvedValue(null);

      await expect(
        service.obtenerStreamDescargaPublica('slug-inexistente'),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe lanzar NotFoundException con mensaje controlado si el trámite no tiene PDF configurado', async () => {
      tipoSolicitudRepo.findOne.mockResolvedValue({
        id: 1,
        slug: 'arreglo-pago',
        formularioOficial: null,
      });
      formularioRepo.findOne.mockResolvedValue(null);

      await expect(
        service.obtenerStreamDescargaPublica('arreglo-pago'),
      ).rejects.toThrow(
        'El formulario oficial todavía no se encuentra disponible.',
      );
    });

    it('debe retornar el stream con headers correctos si el archivo existe físicamente', async () => {
      const nombreInterno = 'test-download.pdf';
      const ruta = join(
        process.cwd(),
        'uploads',
        'formularios-oficiales',
        nombreInterno,
      );
      writeFileSync(ruta, '%PDF-1.4\nStream content');

      tipoSolicitudRepo.findOne.mockResolvedValue({
        id: 1,
        slug: 'arreglo-pago',
        formularioOficial: {
          id: 1,
          tipoSolicitudId: 1,
          nombreArchivoOriginal: 'arreglo-descarga.pdf',
          nombreArchivoInterno: nombreInterno,
        },
      });

      try {
        const result =
          await service.obtenerStreamDescargaPublica('arreglo-pago');
        expect(result.streamableFile).toBeDefined();
        expect(result.filename).toBe('arreglo-descarga.pdf');
        result.streamableFile.getStream().destroy();
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (existsSync(ruta)) {
          try {
            unlinkSync(ruta);
          } catch {
            // ignore
          }
        }
      }
    });
  });
});
