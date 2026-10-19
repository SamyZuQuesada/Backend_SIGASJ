import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoSolicitudAusencia } from '../../../common/enums/estado-solicitud-ausencia.enum';
import { TipoSolicitudAusencia } from '../../../common/enums/tipo-solicitud-ausencia.enum';
import { SolicitudAusencia } from '../entities/solicitud-ausencia.entity';

/**
 * Vista Fontanero de SolicitudAusencia.
 * Omite datos de integración (jotformSubmissionId) y auditoría interna de revisor.
 */
export class SolicitudAusenciaFontaneroResponse {
  @ApiProperty()
  id: number;

  @ApiProperty({ enum: TipoSolicitudAusencia })
  tipo: TipoSolicitudAusencia;

  @ApiProperty({ example: '2026-11-01' })
  fechaInicio: string;

  @ApiProperty({ example: '2026-11-02' })
  fechaFin: string;

  @ApiPropertyOptional({ nullable: true })
  motivo: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Correo para notificar la aprobación',
  })
  correoNotificacion: string | null;

  @ApiPropertyOptional({ nullable: true })
  observaciones: string | null;

  @ApiProperty({ enum: EstadoSolicitudAusencia })
  estado: EstadoSolicitudAusencia;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Motivo de rechazo (si estado = RECHAZADA)',
  })
  motivoRechazo: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Momento de la revisión administrativa',
  })
  reviewedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export const toSolicitudAusenciaFontaneroResponse = (
  solicitud: SolicitudAusencia,
): SolicitudAusenciaFontaneroResponse => ({
  id: solicitud.id,
  tipo: solicitud.tipo,
  fechaInicio: solicitud.fechaInicio,
  fechaFin: solicitud.fechaFin,
  motivo: solicitud.motivo,
  correoNotificacion: solicitud.correoNotificacion,
  observaciones: solicitud.observaciones,
  estado: solicitud.estado,
  motivoRechazo: solicitud.motivoRechazo,
  reviewedAt: solicitud.reviewedAt,
  createdAt: solicitud.createdAt,
  updatedAt: solicitud.updatedAt,
});
