import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  savePublicImage,
  type UploadedImageFile,
} from '../../common/media/public-media';
import { CreateGaleriaDto } from './dto/create-galeria.dto';
import { UpdateGaleriaDto } from './dto/update-galeria.dto';
import { UpdateContactoDto } from './dto/update-contacto.dto';
import { ContactoUbicacion } from './entities/contacto-ubicacion.entity';
import { GaleriaFoto } from './entities/galeria-foto.entity';

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

const TRANSPARENCIA_SEED = [
  {
    id: 1,
    titulo: 'Informe Anual de Gestión',
    ano: 2025,
    documentoUrl: '/docs/informe-2025.pdf',
  },
  {
    id: 2,
    titulo: 'Reglamento de Prestación de Servicios',
    ano: 2024,
    documentoUrl: '/docs/reglamento.pdf',
  },
];

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
  activa: Boolean(foto.activa),
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
  ) {}

  async onModuleInit() {
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
  }

  getInformacionInstitucional() {
    return INFORMACION_SEED;
  }

  async getContacto() {
    const row = await this.contactoRepo.findOne({ where: { id: 1 } });
    return row ? toContactoRecord(row) : CONTACTO_SEED;
  }

  async updateContacto(dto: UpdateContactoDto) {
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
  }

  async getGaleria() {
    const items = await this.galeriaRepo.find({
      where: { activa: true },
      order: { ordenVisualizacion: 'ASC' },
    });
    return items.map(toGaleriaRecord);
  }

  async getGaleriaAdmin() {
    const items = await this.galeriaRepo.find({
      order: { ordenVisualizacion: 'ASC' },
    });
    return items.map(toGaleriaRecord);
  }

  async createGaleria(dto: CreateGaleriaDto, file?: UploadedImageFile) {
    const url = file ? savePublicImage('galeria', file) : dto.url?.trim();
    if (!url) {
      throw new BadRequestException(
        'Debe adjuntar una imagen o indicar su URL.',
      );
    }

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
  }

  async updateGaleria(id: number, dto: UpdateGaleriaDto, file?: UploadedImageFile) {
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
  }

  async removeGaleria(id: number) {
    const current = await this.galeriaRepo.findOne({ where: { id } });
    if (!current) {
      throw new NotFoundException(`Fotografía con ID ${id} no encontrada`);
    }

    await this.galeriaRepo.remove(current);
    return { deleted: true };
  }

  getTransparencia() {
    return TRANSPARENCIA_SEED;
  }
}
