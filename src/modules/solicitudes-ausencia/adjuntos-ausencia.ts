import { mkdirSync, writeFileSync } from 'fs';
import { basename, join } from 'path';
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

export type DocumentoAusenciaVisible = {
  id: number;
  nombreOriginal: string;
  tipoArchivo: string;
  rutaReferenciaArchivo: string;
  tamanio: number;
  fechaCarga: Date;
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

export const rutaApiEvidenciaAusencia = (
  solicitudId: number,
  filename: string,
): string =>
  `/api/v1/fontanero/solicitudes-ausencia/${solicitudId}/documentos/${filename}`;

export const filenameDeRutaEvidencia = (ruta: string): string =>
  basename(ruta.split('?')[0] ?? '');

export const normalizarRutaEvidenciaAusencia = (
  solicitudId: number,
  ruta: string,
): string => {
  const filename = filenameDeRutaEvidencia(ruta);
  if (!filename || filename.includes('..')) {
    return ruta;
  }
  const api = rutaApiEvidenciaAusencia(solicitudId, filename);
  if (ruta.startsWith(api) || ruta.includes(`/documentos/${filename}`)) {
    return api;
  }
  const uploads = `/uploads/solicitudes-ausencia/${solicitudId}/`;
  if (ruta.startsWith(uploads) || ruta === filename) {
    return api;
  }
  return ruta;
};

export const documentosDesdeAdjuntosJson = (
  solicitudId: number,
  adjuntosJson: string | null | undefined,
  fallbackFecha: Date,
): DocumentoAusenciaVisible[] => {
  if (!adjuntosJson?.trim()) {
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(adjuntosJson);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.flatMap((item, index) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    const rec = item as Record<string, unknown>;
    const ruta =
      typeof rec.rutaReferenciaArchivo === 'string'
        ? rec.rutaReferenciaArchivo
        : '';
    if (!ruta) {
      return [];
    }
    return [
      {
        id: -(index + 1),
        nombreOriginal:
          typeof rec.nombreOriginal === 'string' && rec.nombreOriginal.trim()
            ? rec.nombreOriginal
            : 'evidencia',
        tipoArchivo:
          typeof rec.tipoArchivo === 'string' ? rec.tipoArchivo : 'application/octet-stream',
        rutaReferenciaArchivo: normalizarRutaEvidenciaAusencia(
          solicitudId,
          ruta,
        ),
        tamanio: typeof rec.tamanio === 'number' ? rec.tamanio : 0,
        fechaCarga: fallbackFecha,
      },
    ];
  });
};

export const fusionarDocumentosAusencia = (
  solicitudId: number,
  documentos: Array<{
    id: number;
    nombreOriginal: string;
    tipoArchivo: string;
    rutaReferenciaArchivo: string;
    tamanio: number;
    fechaCarga: Date;
  }>,
  adjuntosJson: string | null | undefined,
  fallbackFecha: Date,
): DocumentoAusenciaVisible[] => {
  const fromRelation = documentos.map((documento) => ({
    id: documento.id,
    nombreOriginal: documento.nombreOriginal,
    tipoArchivo: documento.tipoArchivo,
    rutaReferenciaArchivo: normalizarRutaEvidenciaAusencia(
      solicitudId,
      documento.rutaReferenciaArchivo,
    ),
    tamanio: documento.tamanio,
    fechaCarga: documento.fechaCarga,
  }));
  const seen = new Set(
    fromRelation.map((doc) => filenameDeRutaEvidencia(doc.rutaReferenciaArchivo)),
  );
  const extra = documentosDesdeAdjuntosJson(
    solicitudId,
    adjuntosJson,
    fallbackFecha,
  ).filter((doc) => {
    const name = filenameDeRutaEvidencia(doc.rutaReferenciaArchivo);
    if (!name || seen.has(name)) {
      return false;
    }
    seen.add(name);
    return true;
  });
  return [...fromRelation, ...extra];
};
