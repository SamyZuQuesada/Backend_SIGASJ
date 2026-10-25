import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import {
  MAX_ACTIVIDAD_DOCUMENT_FILES,
  type ActividadDocumentFile,
  validateActividadDocument,
} from '../../common/media/public-media';

export type AdjuntoSolicitudAusencia = ActividadDocumentFile;

export type AdjuntoSolicitudAusenciaGuardado = {
  nombreOriginal: string;
  tipoArchivo: string;
  rutaReferenciaArchivo: string;
  tamanio: number;
};

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

export const persistirAdjuntosSolicitudAusencia = (
  solicitudId: number,
  archivos: AdjuntoSolicitudAusencia[],
): AdjuntoSolicitudAusenciaGuardado[] => {
  const selected = archivos.slice(0, MAX_ACTIVIDAD_DOCUMENT_FILES);
  const folder = join(
    process.cwd(),
    'uploads',
    'solicitudes-ausencia',
    String(solicitudId),
  );
  mkdirSync(folder, { recursive: true });

  return selected.map((file) => {
    validateActividadDocument(file);
    const extension = MIME_TO_EXT[file.mimetype] ?? '.bin';
    const filename = `${Date.now()}-${randomUUID()}${extension}`;
    writeFileSync(join(folder, filename), file.buffer);
    return {
      nombreOriginal: file.originalname,
      tipoArchivo: file.mimetype,
      rutaReferenciaArchivo: `/uploads/solicitudes-ausencia/${solicitudId}/${filename}`,
      tamanio: file.size,
    };
  });
};
