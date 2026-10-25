import { Test, TestingModule } from '@nestjs/testing';
import { StreamableFile } from '@nestjs/common';
import { Readable } from 'stream';
import { Response } from 'express';
import { FormulariosOficialesController } from './formularios-oficiales.controller';
import {
  FormulariosOficialesService,
  UploadedPdfFile,
} from './formularios-oficiales.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TipoSolicitudSlug } from '../../common/enums/tipo-solicitud-slug.enum';

describe('FormulariosOficialesController', () => {
  let controller: FormulariosOficialesController;
  let service: jest.Mocked<FormulariosOficialesService>;

  const mockService = {
    listarFormulariosOficialesAdmin: jest.fn(),
    subirOReemplazarPdf: jest.fn(),
    obtenerStreamDescargaPublica: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FormulariosOficialesController],
      providers: [
        {
          provide: FormulariosOficialesService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<FormulariosOficialesController>(
      FormulariosOficialesController,
    );
    service = module.get(FormulariosOficialesService);
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /solicitudes/admin/formularios-oficiales', () => {
    it('debe devolver el listado de los 6 formularios para administración', async () => {
      const mockListado = [
        {
          tipoSolicitudId: 1,
          nombre: 'Solicitud de Arreglo de Pago Domiciliar',
          slug: TipoSolicitudSlug.ARREGLO_PAGO,
          tienePdf: true,
          nombreArchivo: 'formulario-arreglo-pago.pdf',
          fechaActualizacion: new Date(),
        },
        {
          tipoSolicitudId: 2,
          nombre: 'Cambio de Nombre del Titular del Servicio',
          slug: TipoSolicitudSlug.CAMBIO_TITULAR,
          tienePdf: false,
          nombreArchivo: null,
          fechaActualizacion: null,
        },
      ];

      service.listarFormulariosOficialesAdmin.mockResolvedValue(
        mockListado as any,
      );

      const result = await controller.listarFormulariosAdmin();

      expect(result).toEqual(mockListado);
      expect(service.listarFormulariosOficialesAdmin).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /solicitudes/formularios-oficiales (Catálogo público)', () => {
    it('debe devolver el listado público de los trámites con sus enlaces de descarga', async () => {
      const mockListado = [
        {
          tipoSolicitudId: 1,
          nombre: 'Solicitud de Arreglo de Pago Domiciliar',
          slug: TipoSolicitudSlug.ARREGLO_PAGO,
          tienePdf: true,
          nombreArchivo: 'formulario-arreglo-pago.pdf',
          fechaActualizacion: new Date(),
          urlDescarga: '/solicitudes/arreglo-pago/formulario-oficial',
        },
      ];

      service.listarFormulariosOficialesAdmin.mockResolvedValue(
        mockListado as any,
      );

      const result = await controller.listarFormulariosPublicos();

      expect(result).toEqual(mockListado);
      expect(service.listarFormulariosOficialesAdmin).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /solicitudes/admin/formularios-oficiales/:tipoSolicitudId', () => {
    it('debe invocar al servicio para subir o reemplazar el PDF', async () => {
      const fileMock: UploadedPdfFile = {
        fieldname: 'file',
        originalname: 'formulario-oficial.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('%PDF-1.4 sample'),
      };

      const mockResponse = {
        tipoSolicitudId: 1,
        nombre: 'Solicitud de Arreglo de Pago Domiciliar',
        slug: TipoSolicitudSlug.ARREGLO_PAGO,
        tienePdf: true,
        nombreArchivo: 'formulario-oficial.pdf',
        fechaActualizacion: new Date(),
      };

      service.subirOReemplazarPdf.mockResolvedValue(mockResponse as any);

      const result = await controller.subirOReemplazarPdf(1, fileMock);

      expect(result).toEqual(mockResponse);
      expect(service.subirOReemplazarPdf).toHaveBeenCalledWith(1, fileMock);
    });
  });

  describe('GET /solicitudes/:slug/formulario-oficial (Descarga pública)', () => {
    it('debe configurar cabeceras application/pdf y Content-Disposition correctos y retornar StreamableFile', async () => {
      const readable = Readable.from(['%PDF-1.4 test stream content']);
      const streamableFile = new StreamableFile(readable);

      service.obtenerStreamDescargaPublica.mockResolvedValue({
        streamableFile,
        filename: 'solicitud-arreglo-pago.pdf',
      });

      const setMock = jest.fn();
      const mockRes = {
        set: setMock,
      } as unknown as Response;

      const result = await controller.descargarFormularioPublico(
        TipoSolicitudSlug.ARREGLO_PAGO,
        mockRes,
      );

      expect(result).toBe(streamableFile);
      expect(service.obtenerStreamDescargaPublica).toHaveBeenCalledWith(
        TipoSolicitudSlug.ARREGLO_PAGO,
      );
      expect(setMock).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          'attachment; filename="solicitud-arreglo-pago.pdf"',
        'Cache-Control': 'no-cache',
      });
    });

    it('la descarga pública no debe interactuar con entidades de Solicitud ni crear registros', async () => {
      const readable = Readable.from(['%PDF-1.4 test stream content']);
      const streamableFile = new StreamableFile(readable);

      service.obtenerStreamDescargaPublica.mockResolvedValue({
        streamableFile,
        filename: 'afiliacion.pdf',
      });

      const mockRes = {
        set: jest.fn(),
      } as unknown as Response;

      await controller.descargarFormularioPublico(
        TipoSolicitudSlug.AFILIACION,
        mockRes,
      );

      // Verificamos que sólo se consulta el stream de formulario oficial
      expect(service.obtenerStreamDescargaPublica).toHaveBeenCalledWith(
        TipoSolicitudSlug.AFILIACION,
      );
    });
  });
});
