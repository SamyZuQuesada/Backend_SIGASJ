import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SolicitudEstado } from '../../common/enums/solicitud-estado.enum';
import { SolicitudPendienteDto } from './dto/solicitud-pendiente.dto';
import { SolicitudesAprobadaPendientesResponseDto } from './dto/solicitudes-aprobada-pendientes-response.dto';
import { SolicitudServicio } from './entities/solicitud-servicio.entity';

const SIN_SOLICITUDES_MENSAJE =
  'No hay solicitudes aprobadas pendientes de registro.';

@Injectable()
export class SolicitudesService {
  private readonly logger = new Logger(SolicitudesService.name);

  constructor(
    @InjectRepository(SolicitudServicio)
    private readonly solicitudRepository: Repository<SolicitudServicio>,
  ) {}

  async findAprobadasPendientes(): Promise<SolicitudesAprobadaPendientesResponseDto> {
    const solicitudes = await this.solicitudRepository.find({
      where: {
        estado: SolicitudEstado.APROBADA,
        utilizada: false,
      },
      order: { idSolicitud: 'ASC' },
    });

    const items = solicitudes.map((solicitud) =>
      this.toPendienteDto(solicitud),
    );

    return {
      solicitudes: items,
      mensaje: items.length === 0 ? SIN_SOLICITUDES_MENSAJE : null,
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
