import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
import { TipoActividadFontaneroCodigo } from '../../common/enums/tipo-actividad-fontanero-codigo.enum';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import {
  deleteActividadDocument,
  type ActividadDocumentFile,
} from '../../common/media/public-media';
import { ActividadesFontaneroService } from './actividades-fontanero.service';
import { ActividadFontanero } from './entities/actividad-fontanero.entity';
import type { DocumentoActividadFontanero } from './entities/documento-actividad-fontanero.entity';
import type { TipoActividadFontanero } from './entities/tipo-actividad-fontanero.entity';

const user: AuthenticatedUser = {
  userId: 'fontanero-1',
  email: 'fontanero@asada.test',
  role: 'FONTANERO',
  name: 'Fontanero',
};

const pdf: ActividadDocumentFile = {
  originalname: 'incapacidad.pdf',
  mimetype: 'application/pdf',
  buffer: Buffer.from('%PDF-1.7 comprobante'),
  size: Buffer.byteLength('%PDF-1.7 comprobante'),
};

describe('ActividadesFontaneroService - documentos', () => {
  const actividad = {
    id: 123456789,
    fontaneroId: user.userId,
    tipoActividad: null,
  } as ActividadFontanero;

  const createService = (
    found: ActividadFontanero | null,
    save: jest.Mock = jest.fn(),
  ) => {
    const createDocument = jest.fn(
      (value: DocumentoActividadFontanero) => value,
    );
    const actividadRepository = {
      findOne: jest.fn().mockResolvedValue(found),
    } as unknown as Repository<ActividadFontanero>;
    const documentoRepository = {
      create: createDocument,
      save,
    } as unknown as Repository<DocumentoActividadFontanero>;

    return {
      service: new ActividadesFontaneroService(
        actividadRepository,
        {} as Repository<TipoActividadFontanero>,
        documentoRepository,
      ),
      documentoRepository,
      createDocument,
    };
  };

  it('no permite asociar un documento a una actividad inexistente', async () => {
    const { service } = createService(null);
    await expect(
      service.adjuntarDocumento(1, pdf, user),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('no permite adjuntar documentos a una actividad ajena', async () => {
    const { service } = createService({
      ...actividad,
      fontaneroId: 'otro-fontanero',
    });
    await expect(
      service.adjuntarDocumento(actividad.id, pdf, user),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('elimina el archivo físico si falla el registro de metadatos', async () => {
    const save = jest.fn().mockRejectedValue(new Error('base no disponible'));
    const { service, createDocument } = createService(actividad, save);

    await expect(
      service.adjuntarDocumento(actividad.id, pdf, user),
    ).rejects.toThrow('base no disponible');

    const createdDocument = createDocument.mock.calls[0]?.[0];
    expect(createdDocument).toBeDefined();
    const reference = createdDocument.rutaReferenciaArchivo;
    const filePath = join(
      process.cwd(),
      'uploads',
      'actividades-fontanero',
      String(actividad.id),
      basename(reference),
    );
    expect(existsSync(filePath)).toBe(false);
  });

  it('registra actividad y documentos en una única transacción', async () => {
    const tipo = {
      id: 6,
      codigo: TipoActividadFontaneroCodigo.INCAPACIDAD_VACACIONES,
      nombre: 'Incapacidad o vacaciones',
      activo: true,
    } as TipoActividadFontanero;
    // Se asigna después porque el callback transaccional referencia al propio mock.
    // eslint-disable-next-line prefer-const
    let manager: EntityManager;
    const transaction = jest.fn((callback: (value: EntityManager) => unknown) =>
      Promise.resolve(callback(manager)),
    );
    const create = jest.fn(
      (_target: unknown, value: Record<string, unknown>) => value,
    );
    const saveEntity = jest.fn(
      (target: unknown, value: Record<string, unknown>) => {
        if (target === ActividadFontanero) {
          return {
            ...value,
            id: actividad.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
        return {
          ...value,
          id: 1,
          fechaCarga: new Date(),
        };
      },
    );
    manager = {
      transaction,
      create,
      save: saveEntity,
    } as unknown as EntityManager;
    const actividadRepository = {
      manager,
      create: jest.fn((value: Record<string, unknown>) => value),
    } as unknown as Repository<ActividadFontanero>;
    const tipoRepository = {
      findOneBy: jest.fn().mockResolvedValue(tipo),
    } as unknown as Repository<TipoActividadFontanero>;
    const service = new ActividadesFontaneroService(
      actividadRepository,
      tipoRepository,
      {} as Repository<DocumentoActividadFontanero>,
    );

    const result = await service.registrar(
      {
        tipoActividadId: tipo.id,
        fechaActividad: '2026-09-07',
        titulo: 'Incapacidad médica',
      },
      user,
      [pdf],
    );

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(result.documentos).toHaveLength(1);
    const responseDocument = result.documentos?.[0];
    expect(responseDocument).toBeDefined();
    expect(responseDocument).toMatchObject({
      actividadId: actividad.id,
      nombreOriginal: pdf.originalname,
      tipoArchivo: pdf.mimetype,
      tamanio: pdf.size,
    });
    deleteActividadDocument(
      actividad.id,
      responseDocument.rutaReferenciaArchivo,
    );
  });
});
