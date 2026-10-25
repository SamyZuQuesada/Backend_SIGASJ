import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { TipoSolicitudSlug, TIPOS_SOLICITUD_SEED } from '../../common/enums/tipo-solicitud-slug.enum';
import { FormularioOficial } from './entities/formulario-oficial.entity';
import { TipoSolicitud } from './entities/tipo-solicitud.entity';
import { Solicitud } from './entities/solicitud.entity';
import { FormulariosOficialesService, UploadedPdfFile } from './formularios-oficiales.service';
import { FormulariosOficialesController } from './formularios-oficiales.controller';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

describe('Integración y Criterios de Aceptación: Formularios Oficiales Descargables (Cards 1 a 6)', () => {
  let service: FormulariosOficialesService;
  let controller: FormulariosOficialesController;

  const storageDir = path.join(process.cwd(), 'uploads', 'formularios-oficiales');

  // Catálogo simulado de los 6 tipos oficiales
  const mockTipos: TipoSolicitud[] = TIPOS_SOLICITUD_SEED.map((seed, index) => {
    const tipo = new TipoSolicitud();
    tipo.id = index + 1;
    tipo.nombre = seed.nombre;
    tipo.slug = seed.slug;
    tipo.descripcion = seed.descripcion;
    tipo.activo = true;
    tipo.createdAt = new Date('2026-10-20T00:00:00Z');
    tipo.updatedAt = new Date('2026-10-20T00:00:00Z');
    return tipo;
  });

  // 6 Formularios correspondientes 1:1 a los trámites oficiales
  const mockFormularios: FormularioOficial[] = mockTipos.map((tipo) => {
    const form = new FormularioOficial();
    form.id = tipo.id;
    form.tipoSolicitudId = tipo.id;
    form.tipoSolicitud = tipo;
    form.nombreArchivoOriginal = `${tipo.slug}-oficial.pdf`;
    form.nombreArchivoInterno = `mock-uuid-${tipo.id}.pdf`;
    form.mimeType = 'application/pdf';
    form.tamano = 150000 + tipo.id * 1000;
    form.ubicacionArchivo = `formularios-oficiales/${form.nombreArchivoInterno}`;
    form.fechaCarga = new Date('2026-10-21T01:00:00Z');
    form.createdAt = new Date('2026-10-21T01:00:00Z');
    form.updatedAt = new Date('2026-10-21T01:00:00Z');
    tipo.formularioOficial = form;
    return form;
  });

  let fakeDbFormularios: FormularioOficial[] = [];
  let fakeDbSolicitudes: Solicitud[] = [];

  const tipoRepoMock = {
    find: jest.fn().mockImplementation(async () => mockTipos),
    findOne: jest.fn().mockImplementation(async ({ where }) => {
      if (where.id) return mockTipos.find((t) => t.id === where.id) || null;
      if (where.slug) return mockTipos.find((t) => t.slug === where.slug) || null;
      return null;
    }),
  };

  const formularioRepoMock = {
    find: jest.fn().mockImplementation(async () => fakeDbFormularios),
    findOne: jest.fn().mockImplementation(async ({ where }) => {
      if (where.tipoSolicitudId) {
        return fakeDbFormularios.find((f) => f.tipoSolicitudId === where.tipoSolicitudId) || null;
      }
      return null;
    }),
    create: jest.fn().mockImplementation((dto) => Object.assign(new FormularioOficial(), dto)),
    save: jest.fn().mockImplementation(async (entity) => {
      const idx = fakeDbFormularios.findIndex((f) => f.tipoSolicitudId === entity.tipoSolicitudId);
      if (idx >= 0) {
        fakeDbFormularios[idx] = entity;
      } else {
        fakeDbFormularios.push(entity);
      }
      return entity;
    }),
  };

  const solicitudRepoMock = {
    count: jest.fn().mockImplementation(async () => fakeDbSolicitudes.length),
    find: jest.fn().mockImplementation(async () => fakeDbSolicitudes),
    save: jest.fn().mockImplementation(async (s) => s),
  };

  beforeAll(() => {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
  });

  beforeEach(async () => {
    fakeDbFormularios = [...mockFormularios];
    fakeDbSolicitudes = [
      { id: 101, codigoSeguimiento: 'SOL-2026-000001', tipoSolicitudId: 1 } as Solicitud,
      { id: 102, codigoSeguimiento: 'SOL-2026-000002', tipoSolicitudId: 2 } as Solicitud,
    ];

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FormulariosOficialesController],
      providers: [
        FormulariosOficialesService,
        {
          provide: getRepositoryToken(TipoSolicitud),
          useValue: tipoRepoMock,
        },
        {
          provide: getRepositoryToken(FormularioOficial),
          useValue: formularioRepoMock,
        },
        {
          provide: getRepositoryToken(Solicitud),
          useValue: solicitudRepoMock,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    service = module.get<FormulariosOficialesService>(FormulariosOficialesService);
    controller = module.get<FormulariosOficialesController>(FormulariosOficialesController);
  });

  describe('Criterio 1: Los seis tipos de trámite tienen documento asociado 1:1', () => {
    it('debe listar exactamente 6 trámites y todos con PDF vigente configurado y urlDescarga', async () => {
      const listado = await controller.listarFormulariosPublicos();

      expect(listado).toHaveLength(6);

      const slugsRecibidos = listado.map((f) => f.slug);
      expect(slugsRecibidos).toEqual([
        TipoSolicitudSlug.ARREGLO_PAGO,
        TipoSolicitudSlug.CAMBIO_TITULAR,
        TipoSolicitudSlug.INFRAESTRUCTURA_LINDEROS,
        TipoSolicitudSlug.AFILIACION,
        TipoSolicitudSlug.DISPONIBILIDAD_SERVICIOS,
        TipoSolicitudSlug.SERVICIO_EXISTENTE,
      ]);

      for (const item of listado) {
        expect(item.tienePdf).toBe(true);
        expect(item.nombreArchivo).toMatch(/\.pdf$/i);
        expect(item.tamano).toBeGreaterThan(0);
        expect(item.urlDescarga).toBe(`/solicitudes/${item.slug}/formulario-oficial`);
      }
    });

    it('cada documento corresponde exactamente a su tipo de solicitud oficial', async () => {
      const listado = await service.listarFormulariosOficialesAdmin();

      const arreglo = listado.find((l) => l.slug === TipoSolicitudSlug.ARREGLO_PAGO);
      expect(arreglo?.tipoSolicitudId).toBe(1);
      expect(arreglo?.nombreArchivo).toContain('arreglo-pago');

      const cambioTitular = listado.find((l) => l.slug === TipoSolicitudSlug.CAMBIO_TITULAR);
      expect(cambioTitular?.tipoSolicitudId).toBe(2);
      expect(cambioTitular?.nombreArchivo).toContain('cambio-titular');

      const infra = listado.find((l) => l.slug === TipoSolicitudSlug.INFRAESTRUCTURA_LINDEROS);
      expect(infra?.tipoSolicitudId).toBe(3);
      expect(infra?.nombreArchivo).toContain('infraestructura-linderos');

      const afiliacion = listado.find((l) => l.slug === TipoSolicitudSlug.AFILIACION);
      expect(afiliacion?.tipoSolicitudId).toBe(4);
      expect(afiliacion?.nombreArchivo).toContain('afiliacion');

      const disp = listado.find((l) => l.slug === TipoSolicitudSlug.DISPONIBILIDAD_SERVICIOS);
      expect(disp?.tipoSolicitudId).toBe(5);
      expect(disp?.nombreArchivo).toContain('disponibilidad-servicios');

      const constancia = listado.find((l) => l.slug === TipoSolicitudSlug.SERVICIO_EXISTENTE);
      expect(constancia?.tipoSolicitudId).toBe(6);
      expect(constancia?.nombreArchivo).toContain('servicio-existente');
    });
  });

  describe('Criterio 2: Descargar el formulario no crea ningún registro de solicitud', () => {
    it('la descarga de un formulario no invoca persistencia de Solicitud ni altera la cantidad previa', async () => {
      const initialSolicitudesCount = fakeDbSolicitudes.length;

      // Crear archivo temporal real en el storage para la prueba de stream
      const tempFilename = 'mock-temp-descarga.pdf';
      const tempPath = path.join(storageDir, tempFilename);
      fs.writeFileSync(tempPath, Buffer.from('%PDF-1.4 test stream content'));

      // Asignar al primer trámite
      mockTipos[0].formularioOficial!.nombreArchivoInterno = tempFilename;

      try {
        const streamResult = await service.obtenerStreamDescargaPublica(TipoSolicitudSlug.ARREGLO_PAGO);
        expect(streamResult.streamableFile).toBeDefined();
        expect(streamResult.filename).toBe('arreglo-pago-oficial.pdf');

        // Consumir el stream para cerrar el descriptor de archivo
        const stream = streamResult.streamableFile.getStream();
        await new Promise((resolve) => {
          stream.on('data', () => {});
          stream.on('end', resolve);
          stream.on('close', resolve);
        });

        // Confirmar que no se llamó a guardar solicitudes ni se crearon registros
        expect(solicitudRepoMock.save).not.toHaveBeenCalled();
        expect(fakeDbSolicitudes.length).toBe(initialSolicitudesCount);
      } finally {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
    });
  });

  describe('Criterio 3: Evitar enlaces rotos y validar existencia física', () => {
    it('retorna NotFoundException limpia si el slug no corresponde a ningún trámite', async () => {
      await expect(service.obtenerStreamDescargaPublica('slug-desconocido')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('retorna NotFoundException controlada si el registro existe en BD pero el archivo físico no está en disco', async () => {
      mockTipos[0].formularioOficial!.nombreArchivoInterno = 'archivo-inexistente-12345.pdf';

      await expect(
        service.obtenerStreamDescargaPublica(TipoSolicitudSlug.ARREGLO_PAGO),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Criterio 4: Preparar reemplazo del archivo vigente sin alterar solicitudes registradas', () => {
    it('permite reemplazar el documento oficial con uno nuevo manteniendo metadatos y preservando solicitudes', async () => {
      const solicitudesAntes = [...fakeDbSolicitudes];
      const bufferNuevo = Buffer.from('%PDF-1.4 contenido nuevo v2 para reemplazo de trámite oficial');

      const nuevoPdfFile: UploadedPdfFile = {
        fieldname: 'file',
        originalname: 'Nuevo_Formulario_Arreglo_Pago_v2.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: bufferNuevo.length,
        buffer: bufferNuevo,
      };

      const resultado = await service.subirOReemplazarPdf(1, nuevoPdfFile);

      expect(resultado.tipoSolicitudId).toBe(1);
      expect(resultado.tienePdf).toBe(true);
      expect(resultado.nombreArchivo).toBe('Nuevo_Formulario_Arreglo_Pago_v2.pdf');
      expect(resultado.tamano).toBe(bufferNuevo.length);
      expect(resultado.urlDescarga).toBe('/solicitudes/arreglo-pago/formulario-oficial');

      // Las solicitudes registradas siguen existiendo intactas
      expect(fakeDbSolicitudes).toEqual(solicitudesAntes);

      // Limpiar archivo creado en disco por subirOReemplazarPdf
      const nuevoFormulario = fakeDbFormularios.find((f) => f.tipoSolicitudId === 1);
      if (nuevoFormulario) {
        const filePath = path.join(storageDir, path.basename(nuevoFormulario.nombreArchivoInterno));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    });

    it('rechaza reemplazar con un archivo no PDF (por ejemplo, ejecutable o HTML)', async () => {
      const archivoInvalido: UploadedPdfFile = {
        fieldname: 'file',
        originalname: 'script.exe',
        encoding: '7bit',
        mimetype: 'application/octet-stream',
        size: 2048,
        buffer: Buffer.from('MZ... exe content'),
      };

      await expect(service.subirOReemplazarPdf(1, archivoInvalido)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
