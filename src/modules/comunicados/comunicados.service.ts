import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import {
  savePublicImage,
  type UploadedImageFile,
} from '../../common/media/public-media';
import { CreateComunicadoDto } from './dto/create-comunicado.dto';
import { UpdateComunicadoDto } from './dto/update-comunicado.dto';
import { Comunicado } from './entities/comunicado.entity';

export type ComunicadoRecord = {
  id: string;
  titulo: string;
  descripcion: string;
  contenido: string | null;
  tipo: string;
  prioridad: string;
  estado: 'Activo' | 'Inactivo';
  esPublico: boolean;
  fechaPublicacion: string;
  fechaExpiracion: string | null;
  imagenUrl: string | null;
};

const emptyToNull = (value?: string | null) => {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
};

const toDate = (value?: string | null) => {
  if (!value?.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toIso = (value: Date | string | null) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const toRecord = (entity: Comunicado): ComunicadoRecord => ({
  id: entity.id,
  titulo: entity.titulo,
  descripcion: entity.descripcion,
  contenido: entity.contenido,
  tipo: entity.tipo,
  prioridad: entity.prioridad,
  estado: entity.estado === 'Inactivo' ? 'Inactivo' : 'Activo',
  esPublico: Boolean(entity.esPublico),
  fechaPublicacion: toIso(entity.fechaPublicacion) ?? new Date().toISOString(),
  fechaExpiracion: toIso(entity.fechaExpiracion),
  imagenUrl: entity.imagenUrl,
});

@Injectable()
export class ComunicadosService implements OnModuleInit {
  constructor(
    @InjectRepository(Comunicado)
    private readonly comunicados: Repository<Comunicado>,
  ) {}

  async onModuleInit() {
    const count = await this.comunicados.count();
    if (count > 0) {
      return;
    }

    await this.comunicados.save([
      this.comunicados.create({
        id: '1',
        titulo: 'Mantenimiento Programado de Red de Agua',
        descripcion:
          'Se realizará suspensión temporal del servicio por reparaciones en el sector principal.',
        contenido:
          'Se realizará suspensión temporal del servicio por reparaciones en el sector principal. El restablecimiento se comunicará al finalizar los trabajos.',
        tipo: 'Mantenimiento',
        prioridad: 'Alta',
        estado: 'Activo',
        esPublico: true,
        fechaPublicacion: new Date(),
        fechaExpiracion: null,
        imagenUrl: null,
      }),
      this.comunicados.create({
        id: '2',
        titulo: 'Asamblea General Ordinaria de Abonados',
        descripcion:
          'Invitación a todos los abonados a la asamblea anual de la ASADA San Juan.',
        contenido:
          'Invitación a todos los abonados a la asamblea anual de la ASADA San Juan.',
        tipo: 'Informativo',
        prioridad: 'Media',
        estado: 'Activo',
        esPublico: true,
        fechaPublicacion: new Date(),
        fechaExpiracion: null,
        imagenUrl: null,
      }),
    ]);
  }

  async findPublicos() {
    const now = Date.now();
    const items = await this.comunicados.find();

    return items
      .filter((comunicado) => {
        if (comunicado.estado !== 'Activo' || !comunicado.esPublico) {
          return false;
        }

        const expiresAt = toIso(comunicado.fechaExpiracion);
        if (expiresAt) {
          const parsed = Date.parse(expiresAt);
          if (!Number.isNaN(parsed) && parsed < now) {
            return false;
          }
        }

        return true;
      })
      .map(toRecord);
  }

  async findAllAdmin() {
    const items = await this.comunicados.find({
      order: { fechaPublicacion: 'DESC' },
    });
    return items.map(toRecord);
  }

  async findOne(id: string) {
    const comunicado = await this.comunicados.findOne({ where: { id } });
    if (!comunicado) {
      throw new NotFoundException(`Comunicado con ID ${id} no encontrado`);
    }
    return toRecord(comunicado);
  }

  async create(dto: CreateComunicadoDto, file?: UploadedImageFile) {
    const imagenUrl = file
      ? savePublicImage('comunicados', file)
      : (emptyToNull(dto.imagenUrl) ?? null);

    const saved = await this.comunicados.save(
      this.comunicados.create({
        id: randomUUID(),
        titulo: dto.titulo.trim(),
        descripcion: dto.descripcion?.trim() || '',
        contenido: emptyToNull(dto.contenido) ?? null,
        tipo: dto.tipo?.trim() || 'Informativo',
        prioridad: dto.prioridad || 'Media',
        estado: dto.estado === 'Inactivo' ? 'Inactivo' : 'Activo',
        esPublico: dto.esPublico !== false,
        fechaPublicacion: toDate(dto.fechaPublicacion) ?? new Date(),
        fechaExpiracion: toDate(dto.fechaExpiracion ?? null),
        imagenUrl,
      }),
    );

    return toRecord(saved);
  }

  async update(id: string, dto: UpdateComunicadoDto, file?: UploadedImageFile) {
    const current = await this.comunicados.findOne({ where: { id } });
    if (!current) {
      throw new NotFoundException(`Comunicado con ID ${id} no encontrado`);
    }

    current.titulo = dto.titulo?.trim() || current.titulo;
    current.descripcion =
      dto.descripcion !== undefined ? dto.descripcion.trim() : current.descripcion;
    current.contenido =
      dto.contenido !== undefined
        ? (emptyToNull(dto.contenido) ?? null)
        : current.contenido;
    current.tipo = dto.tipo?.trim() || current.tipo;
    current.prioridad = dto.prioridad || current.prioridad;
    current.estado =
      dto.estado === 'Inactivo' || dto.estado === 'Activo'
        ? dto.estado
        : current.estado;
    current.esPublico =
      dto.esPublico !== undefined ? dto.esPublico : current.esPublico;
    current.fechaPublicacion =
      toDate(dto.fechaPublicacion) ?? current.fechaPublicacion;
    current.fechaExpiracion =
      dto.fechaExpiracion !== undefined
        ? toDate(dto.fechaExpiracion)
        : current.fechaExpiracion;
    current.imagenUrl = file
      ? savePublicImage('comunicados', file)
      : dto.imagenUrl !== undefined
        ? (emptyToNull(dto.imagenUrl) ?? null)
        : current.imagenUrl;

    return toRecord(await this.comunicados.save(current));
  }

  async setEstado(id: string, estado: 'Activo' | 'Inactivo') {
    if (estado !== 'Activo' && estado !== 'Inactivo') {
      throw new BadRequestException('El estado debe ser Activo o Inactivo');
    }

    return this.update(id, { estado });
  }
}
