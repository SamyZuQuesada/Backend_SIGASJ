import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoSolicitud } from '../../../common/enums/estado-solicitud.enum';

/**
 * Evento de historial expuesto al ciudadano.
 * Nunca incluye notaInterna, usuario ni IDs internos.
 */
export class EventoSeguimientoPublicoDto {
  @ApiProperty({ example: '2026-10-20T10:00:00.000Z' })
  fecha!: Date;

  @ApiPropertyOptional({
    enum: EstadoSolicitud,
    nullable: true,
    description: 'Null en el evento inicial de registro',
  })
  estadoAnterior!: EstadoSolicitud | null;

  @ApiProperty({ enum: EstadoSolicitud })
  estadoNuevo!: EstadoSolicitud;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Su solicitud está en revisión.',
  })
  observacionPublica!: string | null;
}

export class TipoSolicitudSeguimientoPublicoDto {
  @ApiProperty({ example: 'Solicitud de Arreglo de Pago Domiciliar' })
  nombre!: string;

  @ApiProperty({ example: 'arreglo-pago' })
  slug!: string;
}

/**
 * Respuesta pública mínima de seguimiento.
 * Mapping explícito: no serializar entidad Solicitud ni HistorialSolicitud.
 */
export class SeguimientoSolicitudPublicoDto {
  @ApiProperty({ example: 'SOL-2026-00001' })
  codigoSeguimiento!: string;

  @ApiProperty({ enum: EstadoSolicitud })
  estado!: EstadoSolicitud;

  @ApiProperty({ example: '2026-10-20T10:30:00.000Z' })
  fechaIngreso!: Date;

  @ApiPropertyOptional({ type: TipoSolicitudSeguimientoPublicoDto })
  tipoSolicitud!: TipoSolicitudSeguimientoPublicoDto | null;

  @ApiProperty({ type: [EventoSeguimientoPublicoDto] })
  historial!: EventoSeguimientoPublicoDto[];
}
