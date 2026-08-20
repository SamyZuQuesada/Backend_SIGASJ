import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { FileStorageService } from '../../common/storage/file-storage.service';
import {
  CreateGaleriaFotoDto,
  ListGaleriaFotoQueryDto,
  UpdateGaleriaFotoDto,
} from './dto/galeria-foto.dto';
import { GaleriaFoto } from './entities/galeria-foto.entity';
import {
  AdminGaleriaFotoDto,
  PublicGaleriaFotoDto,
  toAdminGaleriaFotoDto,
  toPublicGaleriaFotoDto,
} from './mappers/galeria-foto.mapper';

@Injectable()
export class GaleriaService {
  constructor(
    @InjectRepository(GaleriaFoto)
    private readonly galeriaRepository: Repository<GaleriaFoto>,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async findPublicas(): Promise<PublicGaleriaFotoDto[]> {
    const photos = await this.galeriaRepository.find({
      where: { activo: true },
      order: {
        ordenVisualizacion: 'ASC',
        idGaleriaFoto: 'ASC',
      },
    });

    return photos.map(toPublicGaleriaFotoDto);
  }

  async findAllAdmin(
    filters: ListGaleriaFotoQueryDto,
  ): Promise<AdminGaleriaFotoDto[]> {
    const where: Record<string, unknown> = {};

    if (filters.titulo?.trim()) {
      where.titulo = ILike(`%${filters.titulo.trim()}%`);
    }

    if (filters.activo !== undefined) {
      where.activo = filters.activo;
    }

    const photos = await this.galeriaRepository.find({
      where,
      order: {
        ordenVisualizacion: 'ASC',
        idGaleriaFoto: 'ASC',
      },
    });

    return photos.map(toAdminGaleriaFotoDto);
  }

  async findOneAdmin(idGaleriaFoto: number): Promise<AdminGaleriaFotoDto> {
    const photo = await this.requirePhoto(idGaleriaFoto);
    return toAdminGaleriaFotoDto(photo);
  }

  async create(
    dto: CreateGaleriaFotoDto,
    file: Express.Multer.File | undefined,
  ): Promise<AdminGaleriaFotoDto> {
    if (!file) {
      throw new BadRequestException('La imagen es obligatoria.');
    }

    const imagenUrl = await this.fileStorageService.saveGalleryImage(file);

    const photo = this.galeriaRepository.create({
      titulo: dto.titulo ?? null,
      descripcion: dto.descripcion ?? null,
      imagenUrl,
      textoAlternativo: dto.textoAlternativo.trim(),
      ordenVisualizacion: dto.ordenVisualizacion ?? 0,
      activo: dto.activo ?? true,
    });

    const saved = await this.galeriaRepository.save(photo);
    return toAdminGaleriaFotoDto(saved);
  }

  async update(
    idGaleriaFoto: number,
    dto: UpdateGaleriaFotoDto,
    file?: Express.Multer.File,
  ): Promise<AdminGaleriaFotoDto> {
    const photo = await this.requirePhoto(idGaleriaFoto);
    const previousImageUrl = photo.imagenUrl;

    if (file) {
      photo.imagenUrl = await this.fileStorageService.saveGalleryImage(file);
    }

    if (dto.titulo !== undefined) {
      photo.titulo = dto.titulo;
    }

    if (dto.descripcion !== undefined) {
      photo.descripcion = dto.descripcion;
    }

    if (dto.textoAlternativo !== undefined) {
      photo.textoAlternativo = dto.textoAlternativo.trim();
    }

    if (dto.ordenVisualizacion !== undefined) {
      photo.ordenVisualizacion = dto.ordenVisualizacion;
    }

    if (dto.activo !== undefined) {
      photo.activo = dto.activo;
    }

    const saved = await this.galeriaRepository.save(photo);

    if (file) {
      await this.fileStorageService.deleteByPublicUrl(previousImageUrl);
    }

    return toAdminGaleriaFotoDto(saved);
  }

  async updateActivo(
    idGaleriaFoto: number,
    activo: boolean,
  ): Promise<AdminGaleriaFotoDto> {
    const photo = await this.requirePhoto(idGaleriaFoto);
    photo.activo = activo;
    const saved = await this.galeriaRepository.save(photo);
    return toAdminGaleriaFotoDto(saved);
  }

  async remove(idGaleriaFoto: number): Promise<void> {
    const photo = await this.requirePhoto(idGaleriaFoto);
    await this.galeriaRepository.remove(photo);
    await this.fileStorageService.deleteByPublicUrl(photo.imagenUrl);
  }

  private async requirePhoto(idGaleriaFoto: number): Promise<GaleriaFoto> {
    const photo = await this.galeriaRepository.findOne({
      where: { idGaleriaFoto },
    });

    if (!photo) {
      throw new NotFoundException(
        `Fotografía de galería con ID ${idGaleriaFoto} no encontrada`,
      );
    }

    return photo;
  }
}
