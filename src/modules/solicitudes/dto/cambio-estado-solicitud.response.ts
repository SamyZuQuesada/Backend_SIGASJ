import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EstadoSolicitud } from '../../../common/enums/estado-solicitud.enum';

/**
 * Respuesta administrativa del cambio de estado con trazabilidad.
 * Endpoint solo ADMINISTRADORA/SECRETARIA → puede incluir notaInterna.
 */
export class CambioEstadoSolicitudResponseDto {
  @ApiProperty({ example: 12 })
  solicitudId!: number;

  @ApiProperty({ example: 'SOL-2026-ABCD12' })
  codigoSeguimiento!: string;

  @ApiProperty({ enum: EstadoSolicitud, nullable: true })
  estadoAnterior!: EstadoSolicitud | null;

  @ApiProperty({ enum: EstadoSolicitud })
  estadoNuevo!: EstadoSolicitud;

  @ApiPropertyOptional({ nullable: true })
  observacionPublica!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Solo en contexto administrativo; no exponer en DTOs públicos',
  })
  notaInterna!: string | null;

  @ApiProperty({ example: 3, description: 'idUsuario del JWT autenticado' })
  idUsuario!: number;

  @ApiProperty()
  fecha!: Date;

  @ApiProperty({
    example: 41,
    description: 'Id del evento en HistorialSolicitud',
  })
  historialId!: number;
}
