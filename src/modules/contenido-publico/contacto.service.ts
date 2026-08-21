import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactoPublico } from './entities/contacto-publico.entity';
import { UpdateContactoDto } from './dto/update-contacto.dto';
import {
  ContactoPublicoResponse,
  mapContactoPublicoToResponse,
  serializeTelefonosAdicionales,
} from './mappers/contacto-publico.mapper';

const DEFAULT_CONTACTO: Omit<
  ContactoPublico,
  'idContactoPublico' | 'creadoEn' | 'actualizadoEn'
> = {
  telefono: '8560-7584',
  telefonosAdicionalesJson: null,
  email: 'asadasanjuan24@gmail.com',
  horarioAtencion: 'Lunes a sábado de 7:30 a.m. – 11:30 a.m.',
  horarioVentanilla: 'Lunes a sábado de 7:30 a.m. – 11:30 a.m.',
  direccion: 'Costado norte de la Plaza de Deportes, San Juan, Santa Cruz.',
  referenciaUbicacion: null,
  regionResumen: 'San Juan de Santa Cruz, Guanacaste',
  mapaUrl: 'https://maps.app.goo.gl/2HtJjfvjTuLqVaFEA',
  mapaLatitud: 10.2188017,
  mapaLongitud: -85.5565018,
  mapaZoom: 19,
  textoUbicacionMapa: 'Encuentra nuestra oficina en San Juan de Santa Cruz.',
  urlFacebook: 'https://www.facebook.com/share/14kJoKE9tLm/',
  descripcionContacto:
    'Estamos para atenderte con información, orientación y atención a tus solicitudes.',
};

@Injectable()
export class ContactoService {
  constructor(
    @InjectRepository(ContactoPublico)
    private readonly contactoRepository: Repository<ContactoPublico>,
  ) {}

  async getContacto(): Promise<ContactoPublicoResponse> {
    const entity = await this.getOrCreateContacto();
    return mapContactoPublicoToResponse(entity);
  }

  async updateContacto(dto: UpdateContactoDto): Promise<ContactoPublicoResponse> {
    const entity = await this.getOrCreateContacto();

    entity.telefono = dto.telefono.trim();
    entity.telefonosAdicionalesJson = serializeTelefonosAdicionales(
      dto.telefonosAdicionales,
    );
    entity.email = dto.email.trim();
    entity.horarioAtencion = dto.horarioAtencion.trim();
    entity.horarioVentanilla = dto.horarioVentanilla?.trim() || null;
    entity.direccion = dto.direccion.trim();
    entity.referenciaUbicacion = dto.referenciaUbicacion?.trim() || null;
    entity.regionResumen = dto.regionResumen.trim();
    entity.mapaUrl = dto.mapaUrl?.trim() || null;
    entity.mapaLatitud = dto.mapaLatitud ?? null;
    entity.mapaLongitud = dto.mapaLongitud ?? null;
    entity.mapaZoom = dto.mapaZoom ?? entity.mapaZoom;
    entity.textoUbicacionMapa = dto.textoUbicacionMapa?.trim() || null;
    entity.urlFacebook = dto.urlFacebook?.trim() || null;
    entity.descripcionContacto = dto.descripcionContacto?.trim() || null;

    const saved = await this.contactoRepository.save(entity);
    return mapContactoPublicoToResponse(saved);
  }

  private async getOrCreateContacto(): Promise<ContactoPublico> {
    const existing = await this.contactoRepository.find({
      order: { idContactoPublico: 'ASC' },
      take: 1,
    });

    if (existing[0]) {
      return existing[0];
    }

    const created = this.contactoRepository.create(DEFAULT_CONTACTO);
    return this.contactoRepository.save(created);
  }
}
