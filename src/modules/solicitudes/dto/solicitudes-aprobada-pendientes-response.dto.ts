import { ApiProperty } from '@nestjs/swagger';
import { SolicitudPendienteDto } from './solicitud-pendiente.dto';

export class SolicitudesAprobadaPendientesResponseDto {
  @ApiProperty({ type: [SolicitudPendienteDto] })
  solicitudes: SolicitudPendienteDto[];

  @ApiProperty({
    nullable: true,
    example: 'No hay solicitudes aprobadas pendientes de registro.',
  })
  mensaje: string | null;
}
