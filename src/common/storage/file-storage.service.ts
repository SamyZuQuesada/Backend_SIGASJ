import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';

const GALLERY_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const GALLERY_MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class FileStorageService implements OnModuleInit {
  private readonly logger = new Logger(FileStorageService.name);
  private readonly uploadsRoot: string;
  private readonly galeriaDir: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadsRoot = this.configService.get<string>('environment.uploadsRoot')!;
    this.galeriaDir = join(this.uploadsRoot, 'galeria');
  }

  async onModuleInit(): Promise<void> {
    await mkdir(this.galeriaDir, { recursive: true });
    this.logger.log(`Directorio de galería listo: ${this.galeriaDir}`);
  }

  assertGalleryImage(file: Express.Multer.File): void {
    if (!GALLERY_ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        'Solo se permiten imágenes JPG, PNG o WebP.',
      );
    }

    if (file.size > GALLERY_MAX_BYTES) {
      throw new BadRequestException('La imagen no puede superar 5 MB.');
    }
  }

  async saveGalleryImage(file: Express.Multer.File): Promise<string> {
    this.assertGalleryImage(file);

    const extension = this.extensionForMime(file.mimetype, file.originalname);
    const filename = `${randomUUID()}${extension}`;
    const absolutePath = join(this.galeriaDir, filename);

    await writeFile(absolutePath, file.buffer);

    return `/uploads/galeria/${filename}`;
  }

  async deleteByPublicUrl(publicUrl: string): Promise<void> {
    const relativePath = this.toRelativeUploadPath(publicUrl);
    if (!relativePath) {
      return;
    }

    const absolutePath = join(process.cwd(), relativePath);

    try {
      await unlink(absolutePath);
    } catch (error) {
      this.logger.warn(
        `No se pudo eliminar archivo ${absolutePath}: ${String(error)}`,
      );
    }
  }

  private extensionForMime(mimetype: string, originalname: string): string {
    switch (mimetype) {
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      default:
        return extname(originalname) || '.bin';
    }
  }

  private toRelativeUploadPath(publicUrl: string): string | null {
    if (!publicUrl.startsWith('/uploads/')) {
      return null;
    }

    return publicUrl.replace(/^\//, '');
  }
}
