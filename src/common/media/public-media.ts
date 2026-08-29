import {
  BadRequestException,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { basename, extname, join } from 'path';
import { randomUUID } from 'crypto';

export type PublicMediaFolder =
  | 'comunicados'
  | 'galeria'
  | 'transparencia'
  | 'proyectos';

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

  return `/api/v1/public/media/${folder}/${filename}`;
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
  const prefix = '/api/v1/public/media/';
  if (!publicUrl.startsWith(prefix)) return;

  const relativePath = publicUrl.substring(prefix.length);
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

