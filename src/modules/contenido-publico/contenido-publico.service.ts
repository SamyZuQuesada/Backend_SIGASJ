import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  savePublicDocument,
  savePublicImage,
  type UploadedImageFile,
} from '../../common/media/public-media';
import { withDbRetry } from '../../common/persistence/with-db-retry';
import { CreateGaleriaDto } from './dto/create-galeria.dto';
import { CreateTransparenciaDto } from './dto/create-transparencia.dto';
import { UpdateGaleriaDto } from './dto/update-galeria.dto';
import { UpdateTransparenciaDto } from './dto/update-transparencia.dto';
import { UpdateContactoDto } from './dto/update-contacto.dto';
import { ContactoUbicacion } from './entities/contacto-ubicacion.entity';
import { GaleriaFoto } from './entities/galeria-foto.entity';
import { TransparenciaDocumento } from './entities/transparencia-documento.entity';

export type ContactoRecord = {
  telefono: string;
  email: string;
  direccion: string;
  horarioAtencion: string;
  referenciaUbicacion: string;
  mapaUrl: string;
  latitud: number;
  longitud: number;
  zoomMapa: number;
};

export type GaleriaFotoRecord = {
  id: number;
  titulo: string | null;
  descripcion: string | null;
  url: string;
  textoAlternativo: string;
  ordenVisualizacion: number;
  activa: boolean;
};

export type TransparenciaRecord = {
  id: number;
  nombre: string;
  descripcionBreve: string;
  archivoUrl: string;
  tipoArchivo: string;
  ordenVisualizacion: number;
  activa: boolean;
};

const CONTACTO_SEED: ContactoRecord = {
  telefono: '8560-7584',
  email: 'asadasanjuan24@gmail.com',
  direccion: 'Costado norte de la Plaza de Deportes, San Juan, Santa Cruz.',
  horarioAtencion: 'Lunes a Sábado: 7:00 a.m. a 11:30 a.m.',
  referenciaUbicacion: '',
  mapaUrl: 'https://maps.app.goo.gl/2HtJjfvjTuLqVaFEA',
  latitud: 10.2188017,
  longitud: -85.5565018,
  zoomMapa: 19,
};

const INFORMACION_SEED = {
  asada: 'ASADA San Juan',
  ubicacion: 'Santa Cruz, Guanacaste, Costa Rica',
  mision:
    'Proveer agua potable con calidad, continuidad y compromiso con la comunidad.',
  vision:
    'Ser una ASADA modelo en gestión comunitaria e infraestructura hídrica.',
  historia: 'Servicio de gestión de agua para la comunidad de San Juan.',
};

const inferTipoArchivo = (
  file?: UploadedImageFile,
  fallback = 'pdf',
): string => {
  if (file?.mimetype === 'application/pdf') {
    return 'pdf';
  }
  if (file?.mimetype === 'image/png') {
    return 'png';
  }
  if (file?.originalname?.toLowerCase().endsWith('.jpeg')) {
    return 'jpeg';
  }
  if (file?.mimetype === 'image/jpeg') {
    return 'jpg';
  }
  return fallback;
};

const isActiveFlag = (value: unknown): boolean => {
  if (value === false || value === 0 || value === '0' || value === 'false') {
    return false;
  }

  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(value)) {
    return value.length > 0 && value[0] === 1;
  }

  return value === true || value === 1 || value === '1' || value === 'true';
};

const emptyToNull = (value?: string | null) => {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
};

const toGaleriaRecord = (foto: GaleriaFoto): GaleriaFotoRecord => ({
  id: foto.id,
  titulo: foto.titulo,
  descripcion: foto.descripcion,
  url: foto.url,
  textoAlternativo: foto.textoAlternativo,
  ordenVisualizacion: foto.ordenVisualizacion,
  activa: isActiveFlag(foto.activa),
});

const toTransparenciaRecord = (
  row: TransparenciaDocumento,
): TransparenciaRecord => ({
  id: row.id,
  nombre: row.nombre,
  descripcionBreve: row.descripcionBreve,
  archivoUrl: row.archivoUrl,
  tipoArchivo: row.tipoArchivo,
  ordenVisualizacion: row.ordenVisualizacion,
  activa: isActiveFlag(row.activa),
});

const toContactoRecord = (row: ContactoUbicacion): ContactoRecord => ({
  telefono: row.telefono,
  email: row.email,
  direccion: row.direccion,
  horarioAtencion: row.horarioAtencion,
  referenciaUbicacion: row.referenciaUbicacion ?? '',
  mapaUrl: row.mapaUrl ?? '',
  latitud: Number(row.latitud),
  longitud: Number(row.longitud),
  zoomMapa: Number(row.zoomMapa),
});

@Injectable()
export class ContenidoPublicoService implements OnModuleInit {
  constructor(
    @InjectRepository(ContactoUbicacion)
    private readonly contactoRepo: Repository<ContactoUbicacion>,
    @InjectRepository(GaleriaFoto)
    private readonly galeriaRepo: Repository<GaleriaFoto>,
    @InjectRepository(TransparenciaDocumento)
    private readonly transparenciaRepo: Repository<TransparenciaDocumento>,
  ) {}

  async onModuleInit() {
    await withDbRetry(async () => {
    const contacto = await this.contactoRepo.findOne({ where: { id: 1 } });
    if (!contacto) {
      await this.contactoRepo.save(
        this.contactoRepo.create({
          id: 1,
          ...CONTACTO_SEED,
        }),
      );
    }

    const galleryCount = await this.galeriaRepo.count();
    if (galleryCount === 0) {
      await this.galeriaRepo.save([
        this.galeriaRepo.create({
          titulo: 'Tanque Principal',
          descripcion: 'Infraestructura principal del acueducto comunal.',
          url: '/images/tanque.jpg',
          textoAlternativo: 'Tanque elevado de la ASADA San Juan',
          ordenVisualizacion: 0,
          activa: true,
        }),
        this.galeriaRepo.create({
          titulo: 'Oficina Central',
          descripcion: 'Instalaciones de atención al abonado.',
          url: '/images/oficina.jpg',
          textoAlternativo: 'Oficina central de la ASADA San Juan',
          ordenVisualizacion: 1,
          activa: true,
        }),
      ]);
    }
    });
  }

  getInformacionInstitucional() {
    return INFORMACION_SEED;
  }

  async getContacto() {
    return withDbRetry(async () => {
    const row = await this.contactoRepo.findOne({ where: { id: 1 } });
    return row ? toContactoRecord(row) : CONTACTO_SEED;
    });
  }

  async updateContacto(dto: UpdateContactoDto) {
    return withDbRetry(async () => {
    const current =
      (await this.contactoRepo.findOne({ where: { id: 1 } })) ??
      this.contactoRepo.create({ id: 1, ...CONTACTO_SEED });

    if (dto.telefono !== undefined) current.telefono = dto.telefono.trim();
    if (dto.email !== undefined) current.email = dto.email.trim();
    if (dto.direccion !== undefined) current.direccion = dto.direccion.trim();
    if (dto.horarioAtencion !== undefined) {
      current.horarioAtencion = dto.horarioAtencion.trim();
    }
    if (dto.referenciaUbicacion !== undefined) {
      current.referenciaUbicacion = dto.referenciaUbicacion.trim();
    }
    if (dto.mapaUrl !== undefined) current.mapaUrl = dto.mapaUrl.trim();
    if (dto.latitud !== undefined) current.latitud = dto.latitud;
    if (dto.longitud !== undefined) current.longitud = dto.longitud;
    if (dto.zoomMapa !== undefined) current.zoomMapa = dto.zoomMapa;

    return toContactoRecord(await this.contactoRepo.save(current));
    });
  }

  async getGaleria() {
    return withDbRetry(async () => {
    const items = await this.galeriaRepo.find({
      order: { ordenVisualizacion: 'ASC' },
    });
    return items
      .filter((item) => isActiveFlag(item.activa))
      .map(toGaleriaRecord);
    });
  }

  async getGaleriaAdmin() {
    return withDbRetry(async () => {
    const items = await this.galeriaRepo.find({
      order: { ordenVisualizacion: 'ASC' },
    });
    return items.map(toGaleriaRecord);
    });
  }

  async createGaleria(dto: CreateGaleriaDto, file?: UploadedImageFile) {
    const url = file ? savePublicImage('galeria', file) : dto.url?.trim();
    if (!url) {
      throw new BadRequestException(
        'Debe adjuntar una imagen o indicar su URL.',
      );
    }

    return withDbRetry(async () => {
    const count = await this.galeriaRepo.count();
    const saved = await this.galeriaRepo.save(
      this.galeriaRepo.create({
        titulo: emptyToNull(dto.titulo) ?? null,
        descripcion: emptyToNull(dto.descripcion) ?? null,
        url,
        textoAlternativo:
          dto.textoAlternativo?.trim() ||
          dto.titulo?.trim() ||
          'Fotografía institucional',
        ordenVisualizacion: dto.ordenVisualizacion ?? count,
        activa: dto.activa !== false,
      }),
    );

    return toGaleriaRecord(saved);
    });
  }

  async updateGaleria(id: number, dto: UpdateGaleriaDto, file?: UploadedImageFile) {
    return withDbRetry(async () => {
    const current = await this.galeriaRepo.findOne({ where: { id } });
    if (!current) {
      throw new NotFoundException(`Fotografía con ID ${id} no encontrada`);
    }

    if (dto.titulo !== undefined) {
      current.titulo = emptyToNull(dto.titulo) ?? null;
    }
    if (dto.descripcion !== undefined) {
      current.descripcion = emptyToNull(dto.descripcion) ?? null;
    }
    if (dto.textoAlternativo !== undefined) {
      current.textoAlternativo =
        dto.textoAlternativo.trim() || current.textoAlternativo;
    }
    if (dto.ordenVisualizacion !== undefined) {
      current.ordenVisualizacion = dto.ordenVisualizacion;
    }
    if (dto.activa !== undefined) {
      current.activa = dto.activa;
    }
    current.url = file
      ? savePublicImage('galeria', file)
      : dto.url?.trim() || current.url;

    return toGaleriaRecord(await this.galeriaRepo.save(current));
    });
  }

  async removeGaleria(id: number) {
    return withDbRetry(async () => {
    const current = await this.galeriaRepo.findOne({ where: { id } });
    if (!current) {
      throw new NotFoundException(`Fotografía con ID ${id} no encontrada`);
    }

    await this.galeriaRepo.remove(current);
    return { deleted: true };
    });
  }

  async setGaleriaActiva(id: number, activa: boolean) {
    return withDbRetry(async () => {
      const current = await this.galeriaRepo.findOne({ where: { id } });
      if (!current) {
        throw new NotFoundException(`Fotografía con ID ${id} no encontrada`);
      }

      current.activa = activa;
      return toGaleriaRecord(await this.galeriaRepo.save(current));
    });
  }

  async getTransparencia() {
    return withDbRetry(async () => {
      const items = await this.transparenciaRepo.find({
        order: { ordenVisualizacion: 'ASC' },
      });
      return items
        .filter((item) => isActiveFlag(item.activa))
        .map(toTransparenciaRecord);
    });
  }

  async getTransparenciaAdmin() {
    return withDbRetry(async () => {
      const items = await this.transparenciaRepo.find({
        order: { ordenVisualizacion: 'ASC' },
      });
      return items.map(toTransparenciaRecord);
    });
  }

  async createTransparencia(
    dto: CreateTransparenciaDto,
    file?: UploadedImageFile,
  ) {
    const archivoUrl = file
      ? savePublicDocument('transparencia', file)
      : dto.archivoUrl?.trim();
    if (!archivoUrl) {
      throw new BadRequestException(
        'Debe adjuntar un archivo o indicar su URL.',
      );
    }

    return withDbRetry(async () => {
      const count = await this.transparenciaRepo.count();
      const saved = await this.transparenciaRepo.save(
        this.transparenciaRepo.create({
          nombre: dto.nombre.trim(),
          descripcionBreve: dto.descripcionBreve?.trim() || '',
          archivoUrl,
          tipoArchivo: dto.tipoArchivo || inferTipoArchivo(file),
          ordenVisualizacion: dto.ordenVisualizacion ?? count,
          activa: dto.activa !== false,
        }),
      );

      return toTransparenciaRecord(saved);
    });
  }

  async updateTransparencia(
    id: number,
    dto: UpdateTransparenciaDto,
    file?: UploadedImageFile,
  ) {
    return withDbRetry(async () => {
      const current = await this.transparenciaRepo.findOne({ where: { id } });
      if (!current) {
        throw new NotFoundException(`Publicación con ID ${id} no encontrada`);
      }

      if (dto.nombre !== undefined) {
        current.nombre = dto.nombre.trim() || current.nombre;
      }
      if (dto.descripcionBreve !== undefined) {
        current.descripcionBreve = dto.descripcionBreve.trim();
      }
      if (dto.ordenVisualizacion !== undefined) {
        current.ordenVisualizacion = dto.ordenVisualizacion;
      }
      if (dto.activa !== undefined) {
        current.activa = dto.activa;
      }
      if (file) {
        current.archivoUrl = savePublicDocument('transparencia', file);
        current.tipoArchivo = inferTipoArchivo(file, current.tipoArchivo);
      } else if (dto.archivoUrl !== undefined) {
        current.archivoUrl = dto.archivoUrl.trim() || current.archivoUrl;
      }
      if (dto.tipoArchivo !== undefined && !file) {
        current.tipoArchivo = dto.tipoArchivo;
      }

      return toTransparenciaRecord(await this.transparenciaRepo.save(current));
    });
  }

  async removeTransparencia(id: number) {
    return withDbRetry(async () => {
      const current = await this.transparenciaRepo.findOne({ where: { id } });
      if (!current) {
        throw new NotFoundException(`Publicación con ID ${id} no encontrada`);
      }

      await this.transparenciaRepo.remove(current);
      return { deleted: true };
    });
  }

  async setTransparenciaActiva(id: number, activa: boolean) {
    return withDbRetry(async () => {
      const current = await this.transparenciaRepo.findOne({ where: { id } });
      if (!current) {
        throw new NotFoundException(`Publicación con ID ${id} no encontrada`);
      }

      current.activa = activa;
      return toTransparenciaRecord(await this.transparenciaRepo.save(current));
    });
  }
}
