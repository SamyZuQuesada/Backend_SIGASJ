import {
  BadRequestException,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import {
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { basename, extname, join, resolve } from 'path';
import { randomUUID } from 'crypto';

export type PublicMediaFolder =
  'comunicados' | 'galeria' | 'transparencia' | 'proyectos';

export type UploadedImageFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const UPLOAD_ROOT = join(process.cwd(), 'uploads');
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const TRANSPARENCIA_MIME_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

const isAllowedFolder = (folder: string): folder is PublicMediaFolder =>
  folder === 'comunicados' ||
  folder === 'galeria' ||
  folder === 'transparencia' ||
  folder === 'proyectos';

export function normalizeMediaUrl(
  rawUrl: string | null | undefined,
  defaultFolder: PublicMediaFolder = 'galeria',
): string | null {
  if (!rawUrl) return null;
  let url = rawUrl.trim();
  if (!url) return null;

  // URLs externas absolutas (http/https) se preservan
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  // Convertir barras invertidas de Windows a barras estándar
  url = url.replace(/\\/g, '/');

  // Si contiene una ruta absoluta de Windows/servidor con 'uploads/'
  const uploadsIdx = url.toLowerCase().indexOf('uploads/');
  if (uploadsIdx !== -1) {
    const cleanSub = url
      .substring(uploadsIdx + 'uploads/'.length)
      .replace(/^\/+/, '');
    return `/uploads/${cleanSub}`;
  }

  // Si empieza con prefijo legado de controlador /api/v1/public/media/
  const mediaPrefix = '/api/v1/public/media/';
  if (url.startsWith(mediaPrefix)) {
    return `/uploads/${url.substring(mediaPrefix.length)}`;
  }
  const shortMediaPrefix = '/public/media/';
  if (url.startsWith(shortMediaPrefix)) {
    return `/uploads/${url.substring(shortMediaPrefix.length)}`;
  }

  // Si empieza con /api/v1/uploads/
  const apiUploadsPrefix = '/api/v1/uploads/';
  if (url.startsWith(apiUploadsPrefix)) {
    return `/uploads/${url.substring(apiUploadsPrefix.length)}`;
  }

  // Si era un seed antiguo tipo /images/tanque.jpg o /images/oficina.jpg
  if (url.startsWith('/images/')) {
    const filename = url.substring('/images/'.length);
    return `/uploads/${defaultFolder}/${filename}`;
  }

  // Si ya empieza con /uploads/
  if (url.startsWith('/uploads/')) {
    return url;
  }

  // Si empieza con una barra pero sin uploads
  if (url.startsWith('/')) {
    const clean = url.replace(/^\/+/, '');
    if (
      clean.startsWith('galeria/') ||
      clean.startsWith('comunicados/') ||
      clean.startsWith('proyectos/') ||
      clean.startsWith('transparencia/')
    ) {
      return `/uploads/${clean}`;
    }
    return `/uploads/${defaultFolder}/${clean}`;
  }

  // Si es un nombre relativo
  if (
    url.startsWith('galeria/') ||
    url.startsWith('comunicados/') ||
    url.startsWith('proyectos/') ||
    url.startsWith('transparencia/')
  ) {
    return `/uploads/${url}`;
  }

  return `/uploads/${defaultFolder}/${url}`;
}

export function savePublicImage(
  folder: PublicMediaFolder,
  file: UploadedImageFile,
): string {
  const extension = ALLOWED_MIME_TYPES[file.mimetype];

  if (!extension) {
    throw new BadRequestException(
      'Solo se permiten imágenes JPG, PNG, WebP o GIF.',
    );
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new BadRequestException(
      'El archivo supera el tamaño máximo permitido (5 MB).',
    );
  }

  const directory = join(UPLOAD_ROOT, folder);
  mkdirSync(directory, { recursive: true });

  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  writeFileSync(join(directory, filename), file.buffer);

  return `/uploads/${folder}/${filename}`;
}

export function saveProyectoImage(
  proyectoId: number,
  file: UploadedImageFile,
  prefix: 'cover' | 'galeria' = 'cover',
): string {
  const extension = ALLOWED_MIME_TYPES[file.mimetype];

  if (!extension) {
    throw new BadRequestException(
      'Solo se permiten imágenes JPG, PNG, WebP o GIF.',
    );
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new BadRequestException(
      'El archivo supera el tamaño máximo permitido (5 MB).',
    );
  }

  const folder: PublicMediaFolder = 'proyectos';
  const directory = join(UPLOAD_ROOT, folder);
  mkdirSync(directory, { recursive: true });

  const filename = `${proyectoId}_${prefix}_${Date.now()}_${randomUUID().slice(0, 8)}${extension}`;
  writeFileSync(join(directory, filename), file.buffer);

  return `/api/v1/public/media/${folder}/${filename}`;
}

export function deletePhysicalMediaFile(
  publicUrl: string | null | undefined,
): void {
  if (!publicUrl) return;

  const normalized = normalizeMediaUrl(publicUrl);
  if (!normalized || !normalized.startsWith('/uploads/')) return;

  const relativePath = normalized.substring('/uploads/'.length);
  const parts = relativePath.split('/');
  if (parts.length !== 2) return;

  const [folder, filename] = parts;
  const safeName = basename(filename);
  if (!safeName || safeName !== filename || safeName.includes('..')) return;

  const filePath = join(UPLOAD_ROOT, folder, safeName);
  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath);
    } catch {
      // Ignorar errores al eliminar si el archivo no se encuentra o está en uso
    }
  }
}

export function savePublicDocument(
  folder: 'transparencia',
  file: UploadedImageFile,
): string {
  const extension = TRANSPARENCIA_MIME_TYPES[file.mimetype];

  if (!extension) {
    throw new BadRequestException('Solo se permiten archivos PDF, JPG o PNG.');
  }

  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new BadRequestException('El archivo no puede superar 10 MB.');
  }

  const directory = join(UPLOAD_ROOT, folder);
  mkdirSync(directory, { recursive: true });

  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  writeFileSync(join(directory, filename), file.buffer);

  return `/api/v1/public/media/${folder}/${filename}`;
}

export function streamPublicMedia(
  folder: string,
  filename: string,
): StreamableFile {
  if (!isAllowedFolder(folder)) {
    throw new NotFoundException();
  }

  const safeName = basename(filename);
  if (!safeName || safeName !== filename || safeName.includes('..')) {
    throw new NotFoundException();
  }

  const filePath = join(UPLOAD_ROOT, folder, safeName);
  if (!existsSync(filePath)) {
    throw new NotFoundException();
  }

  const extension = extname(safeName).toLowerCase();
  const mimeType =
    extension === '.pdf'
      ? 'application/pdf'
      : extension === '.png'
        ? 'image/png'
        : extension === '.webp'
          ? 'image/webp'
          : extension === '.gif'
            ? 'image/gif'
            : 'image/jpeg';

  return new StreamableFile(createReadStream(filePath), {
    type: mimeType,
    disposition: `inline; filename="${safeName}"`,
  });
}

export type ActividadDocumentFile = UploadedImageFile;

const ACTIVIDAD_DOCUMENT_MIME_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

export const MAX_ACTIVIDAD_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_ACTIVIDAD_DOCUMENT_FILES = 5;

const ACTIVIDAD_DOCUMENT_EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

const hasExpectedSignature = (mimetype: string, buffer: Buffer): boolean => {
  if (mimetype === 'application/pdf') {
    return (
      buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-'
    );
  }
  if (mimetype === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    );
  }
  if (mimetype === 'image/jpeg') {
    return (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    );
  }
  return false;
};

export function validateActividadDocument(
  file: ActividadDocumentFile | undefined,
): asserts file is ActividadDocumentFile {
  if (!file?.buffer || file.buffer.length === 0) {
    throw new BadRequestException('Debe adjuntar un archivo.');
  }

  if (!file.originalname || file.originalname.length > 255) {
    throw new BadRequestException(
      'El nombre original del archivo no es válido.',
    );
  }

  const expectedExtension = ACTIVIDAD_DOCUMENT_MIME_TYPES[file.mimetype];
  const suppliedExtension = extname(file.originalname).toLowerCase();
  const allowedExtensions = ACTIVIDAD_DOCUMENT_EXTENSIONS[file.mimetype];

  if (!expectedExtension || !allowedExtensions?.includes(suppliedExtension)) {
    throw new BadRequestException(
      'Solo se permiten archivos PDF, JPG o PNG con una extensión válida.',
    );
  }

  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    throw new BadRequestException('El tamaño del archivo no es válido.');
  }

  if (file.size !== file.buffer.length) {
    throw new BadRequestException(
      'El tamaño declarado del archivo no coincide con su contenido.',
    );
  }

  if (file.size > MAX_ACTIVIDAD_DOCUMENT_BYTES) {
    throw new BadRequestException('El archivo no puede superar 10 MB.');
  }

  if (!hasExpectedSignature(file.mimetype, file.buffer)) {
    throw new BadRequestException(
      'El contenido del archivo no coincide con su formato declarado.',
    );
  }
}

/**
 * Guarda un documento asociado a una actividad del fontanero.
 * Acepta PDF, JPG o PNG. Máximo 10 MB.
 * Devuelve la ruta de referencia relativa persistida en base de datos.
 */
export function saveActividadDocument(
  actividadId: number,
  file: ActividadDocumentFile,
): { rutaReferenciaArchivo: string; filename: string } {
  validateActividadDocument(file);
  const extension = ACTIVIDAD_DOCUMENT_MIME_TYPES[file.mimetype];

  const folder = join(
    UPLOAD_ROOT,
    'actividades-fontanero',
    String(actividadId),
  );
  mkdirSync(folder, { recursive: true });

  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  writeFileSync(join(folder, filename), file.buffer);

  const rutaReferenciaArchivo = `/uploads/actividades-fontanero/${actividadId}/${filename}`;
  return { rutaReferenciaArchivo, filename };
}

function actividadDocumentFilename(
  actividadId: number,
  rutaReferenciaArchivo: string,
): string | null {
  const prefixes = [
    `/uploads/actividades-fontanero/${actividadId}/`,
    `/api/v1/uploads/actividades-fontanero/${actividadId}/`,
    `/api/v1/fontanero/actividades/${actividadId}/documentos/`,
  ];
  const prefix = prefixes.find((value) =>
    rutaReferenciaArchivo.startsWith(value),
  );
  if (!prefix) return null;
  return rutaReferenciaArchivo.substring(prefix.length);
}

export function deleteActividadDocument(
  actividadId: number,
  rutaReferenciaArchivo: string,
): void {
  const filename = actividadDocumentFilename(
    actividadId,
    rutaReferenciaArchivo,
  );
  if (!filename) return;
  const safeName = basename(filename);
  if (!safeName || safeName !== filename || safeName.includes('..')) return;

  const filePath = join(
    UPLOAD_ROOT,
    'actividades-fontanero',
    String(actividadId),
    safeName,
  );
  if (existsSync(filePath)) unlinkSync(filePath);
}

/**
 * Evidencia de SolicitudAusencia. PDF/JPG/PNG, máx. 10 MB.
 * Carpeta: uploads/solicitudes-ausencia/<id>/
 */
export function saveAusenciaDocument(
  solicitudId: number,
  file: ActividadDocumentFile,
): { rutaReferenciaArchivo: string; filename: string } {
  validateActividadDocument(file);
  const extension = ACTIVIDAD_DOCUMENT_MIME_TYPES[file.mimetype];

  const folder = join(UPLOAD_ROOT, 'solicitudes-ausencia', String(solicitudId));
  mkdirSync(folder, { recursive: true });

  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  writeFileSync(join(folder, filename), file.buffer);

  const rutaReferenciaArchivo = `/api/v1/fontanero/solicitudes-ausencia/${solicitudId}/documentos/${filename}`;
  return { rutaReferenciaArchivo, filename };
}

export function deleteAusenciaDocument(
  solicitudId: number,
  rutaReferenciaArchivo: string,
): void {
  const prefix = `/api/v1/fontanero/solicitudes-ausencia/${solicitudId}/documentos/`;
  if (!rutaReferenciaArchivo.startsWith(prefix)) return;

  const filename = rutaReferenciaArchivo.substring(prefix.length);
  const safeName = basename(filename);
  if (!safeName || safeName !== filename || safeName.includes('..')) return;

  const filePath = join(
    UPLOAD_ROOT,
    'solicitudes-ausencia',
    String(solicitudId),
    safeName,
  );
  if (existsSync(filePath)) unlinkSync(filePath);
}

export function getAusenciaDocumentFilePath(
  solicitudId: number,
  filename: string,
): { absolutePath: string; mimeType: string } {
  const safeName = basename(filename);
  if (!safeName || safeName !== filename || safeName.includes('..')) {
    throw new BadRequestException('Nombre de archivo inválido.');
  }

  const absolutePath = join(
    UPLOAD_ROOT,
    'solicitudes-ausencia',
    String(solicitudId),
    safeName,
  );
  if (!existsSync(absolutePath)) {
    throw new NotFoundException('Archivo de evidencia no encontrado.');
  }

  const ext = extname(safeName).toLowerCase();
  const mimeType =
    ext === '.pdf'
      ? 'application/pdf'
      : ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : 'application/octet-stream';

  return { absolutePath, mimeType };
}

export type MovimientoDocumentFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export const MAX_MOVIMIENTO_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB

const MOVIMIENTO_DOCUMENT_MIME_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const MOVIMIENTO_DOCUMENT_EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

export function validateMovimientoDocument(
  file: MovimientoDocumentFile | undefined,
): asserts file is MovimientoDocumentFile {
  if (!file?.buffer || file.buffer.length === 0) {
    throw new BadRequestException('Debe adjuntar un archivo de respaldo.');
  }

  if (!file.originalname || file.originalname.length > 255) {
    throw new BadRequestException(
      'El nombre original del archivo no es válido o excede 255 caracteres.',
    );
  }

  const expectedExtension = MOVIMIENTO_DOCUMENT_MIME_TYPES[file.mimetype];
  const suppliedExtension = extname(file.originalname).toLowerCase();
  const allowedExtensions = MOVIMIENTO_DOCUMENT_EXTENSIONS[file.mimetype];

  if (!expectedExtension || !allowedExtensions?.includes(suppliedExtension)) {
    throw new BadRequestException(
      'Solo se permiten archivos PDF, JPG, PNG o WebP con una extensión válida.',
    );
  }

  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    throw new BadRequestException('El tamaño del archivo no es válido.');
  }

  if (file.size !== file.buffer.length) {
    throw new BadRequestException(
      'El tamaño declarado del archivo no coincide con su contenido.',
    );
  }

  if (file.size > MAX_MOVIMIENTO_DOCUMENT_BYTES) {
    throw new BadRequestException(
      'El archivo de respaldo no puede superar 10 MB.',
    );
  }

  // Comprobación de cabeceras binarias (magic numbers)
  const isWebp =
    file.mimetype === 'image/webp' &&
    file.buffer.length >= 12 &&
    file.buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    file.buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (!hasExpectedSignature(file.mimetype, file.buffer) && !isWebp) {
    throw new BadRequestException(
      'El contenido del archivo no coincide con su formato declarado.',
    );
  }
}

/**
 * Guarda un documento de respaldo (factura, recibo, guía de entrega) asociado a un movimiento de inventario.
 * Guarda en uploads/movimientos-inventario/<idMovimiento>/<timestamp>-<uuid>.<ext>.
 * Devuelve la ruta relativa persistible y el nombre de archivo seguro.
 */
export function saveMovimientoDocument(
  movimientoId: number,
  file: MovimientoDocumentFile,
): { rutaReferenciaArchivo: string; filename: string } {
  validateMovimientoDocument(file);
  const extension = MOVIMIENTO_DOCUMENT_MIME_TYPES[file.mimetype];

  const folder = join(
    UPLOAD_ROOT,
    'movimientos-inventario',
    String(movimientoId),
  );
  mkdirSync(folder, { recursive: true });

  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  writeFileSync(join(folder, filename), file.buffer);

  const rutaReferenciaArchivo = `/api/v1/inventario/movimientos/${movimientoId}/documentos/${filename}`;
  return { rutaReferenciaArchivo, filename };
}

/**
 * Elimina físicamente el archivo guardado de un movimiento (usado en rollback ante fallos en BD o borrado).
 */
export function deleteMovimientoDocument(
  movimientoId: number,
  rutaReferenciaArchivo: string,
): void {
  const prefix = `/api/v1/inventario/movimientos/${movimientoId}/documentos/`;
  if (!rutaReferenciaArchivo.startsWith(prefix)) return;

  const filename = rutaReferenciaArchivo.substring(prefix.length);
  const safeName = basename(filename);
  if (!safeName || safeName !== filename || safeName.includes('..')) return;

  const filePath = join(
    UPLOAD_ROOT,
    'movimientos-inventario',
    String(movimientoId),
    safeName,
  );
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

/**
 * Retorna la ruta física absoluta de un documento de movimiento previa verificación
 * de seguridad para evitar path traversal (..). Lanza NotFoundException si no existe.
 */
export function getMovimientoDocumentFilePath(
  movimientoId: number,
  filename: string,
): { absolutePath: string; mimeType: string } {
  const safeName = basename(filename);
  if (!safeName || safeName !== filename || safeName.includes('..')) {
    throw new BadRequestException('Nombre de archivo inválido.');
  }

  const filePath = join(
    UPLOAD_ROOT,
    'movimientos-inventario',
    String(movimientoId),
    safeName,
  );

  if (!existsSync(filePath)) {
    throw new NotFoundException('Documento no encontrado en el servidor.');
  }

  const ext = extname(safeName).toLowerCase();
  let mimeType = 'application/octet-stream';
  if (ext === '.pdf') mimeType = 'application/pdf';
  else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
  else if (ext === '.png') mimeType = 'image/png';
  else if (ext === '.webp') mimeType = 'image/webp';

  return { absolutePath: filePath, mimeType };
}

/* =========================================================================
 * DOCUMENTOS DE SOLICITUDES DIGITALES PÚBLICAS
 * ========================================================================= */

export type SolicitudDocumentFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export const MAX_SOLICITUD_DOCUMENT_BYTES = 10 * 1024 * 1024;

const SOLICITUD_DOCUMENT_MIME_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

const SOLICITUD_DOCUMENT_EXTENSIONS: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

const DANGEROUS_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.bash',
  '.ps1',
  '.msi',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.wsf',
  '.wsh',
  '.scr',
  '.dll',
  '.com',
  '.pif',
  '.application',
  '.gadget',
  '.hta',
  '.cpl',
  '.msc',
  '.jar',
  '.apk',
  '.bin',
  '.app',
  '.deb',
  '.rpm',
  '.php',
  '.phtml',
  '.py',
  '.rb',
  '.pl',
  '.cgi',
]);

const EXECUTABLE_SIGNATURES: Array<{
  name: string;
  match: (buffer: Buffer) => boolean;
}> = [
  // DOS / Windows PE executable ('MZ')
  {
    name: 'Windows/DOS Executable',
    match: (b) => b.length >= 2 && b[0] === 0x4d && b[1] === 0x5a,
  },
  // Linux ELF executable
  {
    name: 'Linux ELF Executable',
    match: (b) =>
      b.length >= 4 &&
      b[0] === 0x7f &&
      b[1] === 0x45 &&
      b[2] === 0x4c &&
      b[3] === 0x46,
  },
  // Mach-O executable
  {
    name: 'Mach-O Executable',
    match: (b) =>
      b.length >= 4 &&
      ((b[0] === 0xfe &&
        b[1] === 0xed &&
        b[2] === 0xfa &&
        (b[3] === 0xce || b[3] === 0xcf)) ||
        (b[0] === 0xce && b[1] === 0xfa && b[2] === 0xed && b[3] === 0xfe) ||
        (b[0] === 0xcf && b[1] === 0xfa && b[2] === 0xed && b[3] === 0xfe)),
  },
  // Java class bytecode
  {
    name: 'Java Bytecode',
    match: (b) =>
      b.length >= 4 &&
      b[0] === 0xca &&
      b[1] === 0xfe &&
      b[2] === 0xba &&
      b[3] === 0xbe,
  },
  // Shell script with shebang ('#!')
  {
    name: 'Script',
    match: (b) => b.length >= 2 && b[0] === 0x23 && b[1] === 0x21,
  },
];

export function validateSolicitudDocument(
  file: SolicitudDocumentFile | undefined,
): asserts file is SolicitudDocumentFile {
  if (!file?.buffer || file.buffer.length === 0) {
    throw new BadRequestException('Debe adjuntar un archivo.');
  }

  if (!file.originalname || file.originalname.length > 255) {
    throw new BadRequestException(
      'El nombre original del archivo no es válido o excede 255 caracteres.',
    );
  }

  // Prevención de path traversal y caracteres peligrosos en el nombre de archivo
  if (
    file.originalname.includes('..') ||
    file.originalname.includes('/') ||
    file.originalname.includes('\\') ||
    file.originalname.includes('\0')
  ) {
    throw new BadRequestException(
      'El nombre original del archivo contiene caracteres o secuencias no permitidas.',
    );
  }

  // Detección y rechazo de ejecutables o doble extensión maliciosa
  const lowerOriginal = file.originalname.toLowerCase();
  const nameSegments = lowerOriginal.split('.');
  for (let i = 1; i < nameSegments.length; i++) {
    const segmentExt = `.${nameSegments[i]}`;
    if (DANGEROUS_EXTENSIONS.has(segmentExt)) {
      throw new BadRequestException(
        'No se permiten archivos ejecutables o con extensiones potencialmente peligrosas.',
      );
    }
  }

  const expectedExtension = SOLICITUD_DOCUMENT_MIME_TYPES[file.mimetype];
  const suppliedExtension = extname(lowerOriginal);
  const allowedExtensions = SOLICITUD_DOCUMENT_EXTENSIONS[file.mimetype];

  if (!expectedExtension || !allowedExtensions?.includes(suppliedExtension)) {
    throw new BadRequestException(
      'Solo se permiten archivos PDF, JPG o PNG con una extensión válida.',
    );
  }

  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    throw new BadRequestException('El tamaño del archivo no es válido.');
  }

  if (file.size !== file.buffer.length) {
    throw new BadRequestException(
      'El tamaño declarado del archivo no coincide con su contenido.',
    );
  }

  if (file.size > MAX_SOLICITUD_DOCUMENT_BYTES) {
    throw new BadRequestException('El archivo no puede superar 10 MB.');
  }

  // Rechazo de firmas de ejecutables (incluso si se disfraza la extensión)
  for (const sig of EXECUTABLE_SIGNATURES) {
    if (sig.match(file.buffer)) {
      throw new BadRequestException(
        'El contenido del archivo corresponde a un formato ejecutable no permitido.',
      );
    }
  }

  // Validación estricta del MIME real contra los magic bytes del contenido
  if (!hasExpectedSignature(file.mimetype, file.buffer)) {
    throw new BadRequestException(
      'El contenido del archivo no coincide con su formato declarado.',
    );
  }
}

/**
 * Guarda un adjunto pendiente de reclamo en
 * uploads/solicitudes/pendientes/<timestamp>-<uuid>.<ext>.
 * Evita colisiones y sobrescrituras usando timestamp + UUID.
 */
export function saveSolicitudDocumentPending(file: SolicitudDocumentFile): {
  rutaReferenciaArchivo: string;
  filename: string;
  absolutePath: string;
} {
  validateSolicitudDocument(file);
  const suppliedExt = extname(file.originalname).toLowerCase();
  const extension =
    suppliedExt === '.jpeg'
      ? '.jpeg'
      : SOLICITUD_DOCUMENT_MIME_TYPES[file.mimetype];
  const folder = join(UPLOAD_ROOT, 'solicitudes', 'pendientes');
  mkdirSync(folder, { recursive: true });

  // Generación de nombre interno único garantizando ausencia de sobrescrituras
  let filename = `${Date.now()}-${randomUUID()}${extension}`;
  let absolutePath = join(folder, filename);
  while (existsSync(absolutePath)) {
    filename = `${Date.now()}-${randomUUID()}${extension}`;
    absolutePath = join(folder, filename);
  }

  // Verificación estricta contra path traversal
  const resolvedFolder = resolve(folder);
  const resolvedPath = resolve(absolutePath);
  if (!resolvedPath.startsWith(resolvedFolder)) {
    throw new BadRequestException('Ruta de almacenamiento no permitida.');
  }

  writeFileSync(absolutePath, file.buffer);

  return {
    rutaReferenciaArchivo: `/uploads/solicitudes/pendientes/${filename}`,
    filename,
    absolutePath,
  };
}

/**
 * Mueve un adjunto pendiente a la carpeta definitiva de la solicitud.
 * Protege contra path traversal y sobrescrituras.
 */
export function linkSolicitudDocumentFile(
  solicitudId: number,
  pendingRutaReferenciaArchivo: string,
): { rutaReferenciaArchivo: string; filename: string } {
  if (!Number.isSafeInteger(solicitudId) || solicitudId <= 0) {
    throw new BadRequestException('ID de solicitud no válido.');
  }

  const pendingPrefix = '/uploads/solicitudes/pendientes/';
  if (
    !pendingRutaReferenciaArchivo ||
    !pendingRutaReferenciaArchivo.startsWith(pendingPrefix)
  ) {
    throw new BadRequestException(
      'La ruta del documento pendiente no es válida.',
    );
  }

  const pendingName = basename(
    pendingRutaReferenciaArchivo.substring(pendingPrefix.length),
  );
  if (
    !pendingName ||
    pendingName.includes('..') ||
    pendingName.includes('/') ||
    pendingName.includes('\\') ||
    pendingName !== pendingRutaReferenciaArchivo.substring(pendingPrefix.length)
  ) {
    throw new BadRequestException('Nombre de archivo pendiente inválido.');
  }

  const folderPendientes = join(UPLOAD_ROOT, 'solicitudes', 'pendientes');
  const sourcePath = join(folderPendientes, pendingName);

  if (!resolve(sourcePath).startsWith(resolve(folderPendientes))) {
    throw new BadRequestException('Ruta de origen no permitida.');
  }

  if (!existsSync(sourcePath)) {
    throw new NotFoundException(
      'El archivo del documento no existe en el almacenamiento.',
    );
  }

  const targetFolder = join(UPLOAD_ROOT, 'solicitudes', String(solicitudId));
  mkdirSync(targetFolder, { recursive: true });

  // Evitar sobrescrituras en destino si ya existiese un archivo con ese nombre
  let targetName = pendingName;
  let targetPath = join(targetFolder, targetName);
  if (existsSync(targetPath)) {
    const ext = extname(pendingName);
    const base = basename(pendingName, ext);
    targetName = `${base}-${randomUUID().slice(0, 8)}${ext}`;
    targetPath = join(targetFolder, targetName);
  }

  if (!resolve(targetPath).startsWith(resolve(targetFolder))) {
    throw new BadRequestException('Ruta de destino no permitida.');
  }

  try {
    renameSync(sourcePath, targetPath);
  } catch {
    copyFileSync(sourcePath, targetPath);
    if (existsSync(sourcePath)) unlinkSync(sourcePath);
  }

  return {
    rutaReferenciaArchivo: `/uploads/solicitudes/${solicitudId}/${targetName}`,
    filename: targetName,
  };
}

export function deleteSolicitudDocumentFile(
  rutaReferenciaArchivo: string,
): void {
  if (
    !rutaReferenciaArchivo ||
    !rutaReferenciaArchivo.startsWith('/uploads/solicitudes/')
  ) {
    return;
  }
  const relative = rutaReferenciaArchivo.substring('/uploads/'.length);
  const absolutePath = join(UPLOAD_ROOT, ...relative.split('/'));
  const normalizedRoot = join(UPLOAD_ROOT, 'solicitudes');
  if (!resolve(absolutePath).startsWith(resolve(normalizedRoot))) {
    return;
  }
  if (existsSync(absolutePath)) {
    unlinkSync(absolutePath);
  }
}

