import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SolicitudEstado } from '../../common/enums/solicitud-estado.enum';
import { SolicitudPendienteDto } from './dto/solicitud-pendiente.dto';
import { SolicitudesAprobadaPendientesResponseDto } from './dto/solicitudes-aprobada-pendientes-response.dto';
import { SolicitudServicio } from './entities/solicitud-servicio.entity';

const SIN_SOLICITUDES_MENSAJE =
  'No hay solicitudes aprobadas pendientes de registro.';

@Injectable()
export class SolicitudesService implements OnModuleInit {
  private readonly logger = new Logger(SolicitudesService.name);

  constructor(
    @InjectRepository(SolicitudServicio)
    private readonly solicitudRepository: Repository<SolicitudServicio>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    const total = await this.solicitudRepository.count();
    if (total > 0) {
      return;
    }

    await this.solicitudRepository.save([
      this.solicitudRepository.create({
        nombre: 'María',
        apellidos: 'Rodríguez Mora',
        cedula: '1-2345-6789',
        telefono: '8888-1234',
        correo: 'maria.rodriguez@correo.cr',
        direccion: 'San Juan, Desamparados',
        estado: SolicitudEstado.APROBADA,
        utilizada: false,
      }),
      this.solicitudRepository.create({
        nombre: 'Carlos',
        apellidos: 'Vargas Solís',
        cedula: '2-3456-7890',
        telefono: '7777-5678',
        correo: 'carlos.vargas@correo.cr',
        direccion: 'Barrio Los Ángeles, San Juan',
        estado: SolicitudEstado.APROBADA,
        utilizada: false,
      }),
      this.solicitudRepository.create({
        nombre: 'Ana',
        apellidos: 'Mora Chaves',
        cedula: '3-4567-8901',
        telefono: '6666-9012',
        correo: 'ana.mora@correo.cr',
        direccion: 'Residencial Las Palmas',
        estado: SolicitudEstado.APROBADA,
        utilizada: true,
      }),
    ]);

    this.logger.log(
      'Datos de demostración de solicitudes cargados para desarrollo',
    );
  }

  async findAprobadasPendientes(): Promise<SolicitudesAprobadaPendientesResponseDto> {
    const solicitudes = await this.solicitudRepository.find({
      where: {
        estado: SolicitudEstado.APROBADA,
        utilizada: false,
      },
      order: { idSolicitud: 'ASC' },
    });

    const items = solicitudes.map((solicitud) => this.toPendienteDto(solicitud));

    return {
      solicitudes: items,
      mensaje:
        items.length === 0 ? SIN_SOLICITUDES_MENSAJE : null,
    };
  }

  private toPendienteDto(solicitud: SolicitudServicio): SolicitudPendienteDto {
    return {
      idSolicitud: solicitud.idSolicitud,
      nombre: solicitud.nombre,
      apellidos: solicitud.apellidos,
      cedula: solicitud.cedula,
      telefono: solicitud.telefono,
      correo: solicitud.correo,
      direccion: solicitud.direccion,
      utilizada: solicitud.utilizada,
    };
  }
}
