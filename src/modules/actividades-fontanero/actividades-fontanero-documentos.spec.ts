import { BadRequestException, ForbiddenException, NotFoundException, StreamableFile } from '@nestjs/common';
import { Role } from '../../common/enums/role.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ActividadesFontaneroController } from './actividades-fontanero.controller';
import { ActividadesFontaneroService } from './actividades-fontanero.service';
import { ActividadFontanero } from './entities/actividad-fontanero.entity';
import { DocumentoActividadFontanero } from './entities/documento-actividad-fontanero.entity';
import * as mediaBlobStore from '../../common/media/media-blob.store';

describe('ActividadesFontanero - Visualización y Descarga de Documentos de Evidencia Protegidos', () => {
  let service: ActividadesFontaneroService;
  let controller: ActividadesFontaneroController;

  const mockActividadRepo = {
    findOne: jest.fn(),
  };
  const mockTipoRepo = {
    find: jest.fn(),
  };
  const mockDocRepo = {
    save: jest.fn(),
  };
  const mockNotificacionesService = {
    notificarAveriaReportada: jest.fn(),
  };

  const mockAdminUser: AuthenticatedUser = {
    userId: 'admin-uuid-1',
    cedula: '1-1111-1111',
    role: Role.ADMINISTRADORA,
    email: 'admin@asadasj.com',
  };

  const mockFontaneroOwner: AuthenticatedUser = {
    userId: '721516e8-25f0-4fc7-bf98-038c7ef3900b',
    cedula: '2-2222-2222',
    role: Role.FONTANERO,
    email: 'fontanero@asadasj.com',
  };

  const mockFontaneroOther: AuthenticatedUser = {
    userId: 'fontanero-uuid-999',
    cedula: '3-3333-3333',
    role: Role.FONTANERO,
    email: 'otrofontanero@asadasj.com',
  };

  const mockSecretariaUser: AuthenticatedUser = {
    userId: 'secretaria-uuid-1',
    cedula: '4-4444-4444',
    role: Role.SECRETARIA_EJECUTIVA,
    email: 'secretaria@asadasj.com',
  };

  const sampleDoc: DocumentoActividadFontanero = {
    id: 1,
    actividadId: 6,
    nombreOriginal: 'render-logo-png_seeklogo-532232.png',
    tipoArchivo: 'image/png',
    rutaReferenciaArchivo:
      '/uploads/actividades-fontanero/6/1794877087725-281ab9f6-6fa5-4a43-b302-82b568ad0cf3.png',
    tamanio: 6054,
    fechaCarga: new Date(),
    actividad: null as any,
  };

  const sampleActividad: Partial<ActividadFontanero> = {
    id: 6,
    fontaneroId: '721516e8-25f0-4fc7-bf98-038c7ef3900b',
    titulo: 'Control de fugas - Calle Central',
    documentos: [sampleDoc],
    fontanero: {
      idUsuario: 10,
    } as any,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new ActividadesFontaneroService(
      mockActividadRepo as any,
      mockTipoRepo as any,
      mockDocRepo as any,
      mockNotificacionesService as any,
    );

    controller = new ActividadesFontaneroController(service);
  });

  describe('Control de acceso y autorización RBAC', () => {
    it('permite a ADMINISTRADORA ver fotografías de cualquier actividad', async () => {
      mockActividadRepo.findOne.mockResolvedValue(sampleActividad);

      const fakeBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
      jest.spyOn(mediaBlobStore, 'readStoredMedia').mockResolvedValue({
        mime: 'image/png',
        bytes: fakeBytes,
      });

      const result = await service.obtenerArchivoDocumento(
        6,
        '1794877087725-281ab9f6-6fa5-4a43-b302-82b568ad0cf3.png',
        mockAdminUser,
      );

      expect(result).toBeDefined();
      expect(result.buffer).toEqual(fakeBytes);
      expect(result.mimeType).toBe('image/png');
    });

    it('permite a FONTANERO propietario ver fotografías de sus propias actividades', async () => {
      mockActividadRepo.findOne.mockResolvedValue(sampleActividad);

      const fakeBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
      jest.spyOn(mediaBlobStore, 'readStoredMedia').mockResolvedValue({
        mime: 'image/png',
        bytes: fakeBytes,
      });

      const result = await service.obtenerArchivoDocumento(
        6,
        '1794877087725-281ab9f6-6fa5-4a43-b302-82b568ad0cf3.png',
        mockFontaneroOwner,
      );

      expect(result).toBeDefined();
      expect(result.buffer).toEqual(fakeBytes);
      expect(result.documento.id).toBe(1);
    });

    it('permite a FONTANERO propietario validar por idUsuario de la relación fontanero', async () => {
      mockActividadRepo.findOne.mockResolvedValue({
        ...sampleActividad,
        fontaneroId: 'distinto-id',
        fontanero: { idUsuario: 55 },
      });

      const fakeBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      jest.spyOn(mediaBlobStore, 'readStoredMedia').mockResolvedValue({
        mime: 'image/png',
        bytes: fakeBytes,
      });

      const userConIdUsuario: AuthenticatedUser = {
        userId: 'otro-uid',
        idUsuario: 55,
        cedula: '2-2222-2222',
        role: Role.FONTANERO,
        email: 'fontanero@asadasj.com',
      };

      const result = await service.obtenerArchivoDocumento(
        6,
        '1794877087725-281ab9f6-6fa5-4a43-b302-82b568ad0cf3.png',
        userConIdUsuario,
      );

      expect(result).toBeDefined();
      expect(result.buffer).toEqual(fakeBytes);
    });

    it('lanza ForbiddenException si un FONTANERO intenta ver fotos de la actividad de otro fontanero (403)', async () => {
      mockActividadRepo.findOne.mockResolvedValue(sampleActividad);

      await expect(
        service.obtenerArchivoDocumento(
          6,
          '1794877087725-281ab9f6-6fa5-4a43-b302-82b568ad0cf3.png',
          mockFontaneroOther,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza ForbiddenException si SECRETARIA_EJECUTIVA intenta consultar fotografías de fontanero (403)', async () => {
      mockActividadRepo.findOne.mockResolvedValue(sampleActividad);

      await expect(
        service.obtenerArchivoDocumento(
          6,
          '1794877087725-281ab9f6-6fa5-4a43-b302-82b568ad0cf3.png',
          mockSecretariaUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza ForbiddenException si no se provee usuario autenticado', async () => {
      mockActividadRepo.findOne.mockResolvedValue(sampleActividad);

      await expect(
        service.obtenerArchivoDocumento(
          6,
          '1794877087725-281ab9f6-6fa5-4a43-b302-82b568ad0cf3.png',
          undefined,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Validación de parámetros y seguridad contra Path Traversal', () => {
    it('lanza BadRequestException si el id de actividad es inválido o menor a 1', async () => {
      await expect(
        service.obtenerArchivoDocumento(0, 'test.png', mockAdminUser),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.obtenerArchivoDocumento(-5, 'test.png', mockAdminUser),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.obtenerArchivoDocumento(NaN, 'test.png', mockAdminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza nombres de archivo con secuencias de path traversal (.. o barras)', async () => {
      mockActividadRepo.findOne.mockResolvedValue(sampleActividad);

      await expect(
        service.obtenerArchivoDocumento(
          6,
          '../../etc/passwd',
          mockAdminUser,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.obtenerArchivoDocumento(
          6,
          '..\\windows\\win.ini',
          mockAdminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si la actividad no existe en base de datos', async () => {
      mockActividadRepo.findOne.mockResolvedValue(null);

      await expect(
        service.obtenerArchivoDocumento(999, 'test.png', mockAdminUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza NotFoundException si el archivo o documento no pertenece a la actividad', async () => {
      mockActividadRepo.findOne.mockResolvedValue(sampleActividad);

      await expect(
        service.obtenerArchivoDocumento(
          6,
          'archivo-ajeno.png',
          mockAdminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Recuperación de binario desde dbo.ArchivoMedia y tipos MIME', () => {
    it('resuelve el documento por id numérico, nombre original o filename físico', async () => {
      mockActividadRepo.findOne.mockResolvedValue(sampleActividad);

      const fakeBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      jest.spyOn(mediaBlobStore, 'readStoredMedia').mockResolvedValue({
        mime: 'image/png',
        bytes: fakeBytes,
      });

      // Por id numérico del documento ('1')
      const porId = await service.obtenerArchivoDocumento(6, '1', mockAdminUser);
      expect(porId.documento.id).toBe(1);

      // Por nombre original
      const porNombreOriginal = await service.obtenerArchivoDocumento(
        6,
        'render-logo-png_seeklogo-532232.png',
        mockAdminUser,
      );
      expect(porNombreOriginal.documento.id).toBe(1);

      // Por nombre de archivo físico
      const porFisico = await service.obtenerArchivoDocumento(
        6,
        '1794877087725-281ab9f6-6fa5-4a43-b302-82b568ad0cf3.png',
        mockAdminUser,
      );
      expect(porFisico.documento.id).toBe(1);
    });

    it('deduce MIME image/png correctamente cuando se recupera de ArchivoMedia', async () => {
      mockActividadRepo.findOne.mockResolvedValue(sampleActividad);

      jest.spyOn(mediaBlobStore, 'readStoredMedia').mockResolvedValue({
        mime: '',
        bytes: Buffer.from('datos-png'),
      });

      const res = await service.obtenerArchivoDocumento(
        6,
        '1794877087725-281ab9f6-6fa5-4a43-b302-82b568ad0cf3.png',
        mockAdminUser,
      );

      expect(res.mimeType).toBe('image/png');
    });

    it('lanza NotFoundException cuando no se encuentra ni en disco ni en ArchivoMedia', async () => {
      mockActividadRepo.findOne.mockResolvedValue(sampleActividad);
      jest.spyOn(mediaBlobStore, 'readStoredMedia').mockResolvedValue(null);

      await expect(
        service.obtenerArchivoDocumento(
          6,
          '1794877087725-281ab9f6-6fa5-4a43-b302-82b568ad0cf3.png',
          mockAdminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('ActividadesFontaneroController.descargarDocumento', () => {
    it('retorna StreamableFile con los headers de Content-Type y Disposition adecuados', async () => {
      const fakeBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      jest.spyOn(service, 'obtenerArchivoDocumento').mockResolvedValue({
        absolutePath: '',
        buffer: fakeBytes,
        mimeType: 'image/png',
        documento: sampleDoc,
      });

      const streamable = await controller.descargarDocumento(
        6,
        '1794877087725-281ab9f6-6fa5-4a43-b302-82b568ad0cf3.png',
        mockAdminUser,
      );

      expect(streamable).toBeInstanceOf(StreamableFile);
      expect(streamable.options.type).toBe('image/png');
      expect(streamable.options.disposition).toContain('inline');
      expect(streamable.options.disposition).toContain('render-logo-png_seeklogo-532232.png');
    });
  });
});
